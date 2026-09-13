#!/usr/bin/env node
/**
 * Backfill Song.explicit from Spotify for existing albums.
 * Albums have no stored Spotify id — searches by album title + primary artist,
 * then matches tracks by disc/track number or normalized title.
 *
 * Run:
 *   cd backend && npm run migrate:song-explicit
 *   cd backend && npm run migrate:song-explicit -- --dry-run
 *   cd backend && npm run migrate:song-explicit -- --limit=5
 */
import "dotenv/config";
import axios from "axios";
import mongoose from "mongoose";
import { Album } from "../../models/album.model.js";
import { Artist } from "../../models/artist.model.js";
import { Song } from "../../models/song.model.js";

// Ensure Artist model is registered for Album.populate("artist").
void Artist;

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let accessToken = null;
let tokenExpiresAt = 0;

const normalizeTitle = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) {
    return accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required");
  }

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
    },
  );

  accessToken = response.data.access_token;
  tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
  return accessToken;
}

async function spotifyGet(url, params = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const token = await getAccessToken();
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      if (status === 429) {
        const retryAfter = Number(error.response.headers["retry-after"] || 1);
        console.warn(
          `[migrate:song-explicit] rate limited, waiting ${retryAfter}s...`,
        );
        await sleep(retryAfter * 1000 + 250);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Spotify GET failed after retries: ${url}`);
}

async function searchSpotifyAlbum(albumTitle, artistName) {
  const q = artistName
    ? `album:${albumTitle} artist:${artistName}`
    : `album:${albumTitle}`;
  const data = await spotifyGet("https://api.spotify.com/v1/search", {
    q,
    type: "album",
    limit: 5,
  });

  const items = data.albums?.items || [];
  if (!items.length) return null;

  const wantAlbum = normalizeTitle(albumTitle);
  const wantArtist = normalizeTitle(artistName);

  const exact = items.find((item) => {
    const nameOk = normalizeTitle(item.name) === wantAlbum;
    if (!nameOk) return false;
    if (!wantArtist) return true;
    return (item.artists || []).some(
      (a) => normalizeTitle(a.name) === wantArtist,
    );
  });
  if (exact) return exact;

  // Name must match; do not fall back to an unrelated first hit.
  return items.find((item) => normalizeTitle(item.name) === wantAlbum) || null;
}

async function fetchAllAlbumTracks(spotifyAlbumId) {
  const tracks = [];
  let offset = 0;
  const limitPage = 50;

  for (;;) {
    const data = await spotifyGet(
      `https://api.spotify.com/v1/albums/${spotifyAlbumId}/tracks`,
      { limit: limitPage, offset, market: "US" },
    );
    const items = data.items || [];
    tracks.push(...items);
    if (!data.next || items.length === 0) break;
    offset += items.length;
    await sleep(120);
  }

  return tracks;
}

function matchSongToSpotifyTrack(song, spotifyTracks, usedIds) {
  const byNumber = spotifyTracks.find((track) => {
    if (usedIds.has(track.id)) return false;
    if (song.trackNumber == null || track.track_number == null) return false;
    const songDisc = song.discNumber ?? 1;
    const trackDisc = track.disc_number ?? 1;
    return (
      songDisc === trackDisc && Number(song.trackNumber) === track.track_number
    );
  });
  if (byNumber) return byNumber;

  const want = normalizeTitle(song.title);
  if (!want) return null;

  const exactTitle = spotifyTracks.find(
    (track) =>
      !usedIds.has(track.id) && normalizeTitle(track.name) === want,
  );
  if (exactTitle) return exactTitle;

  // Titles like "Song (feat. X)" vs "Song"
  return (
    spotifyTracks.find((track) => {
      if (usedIds.has(track.id)) return false;
      const got = normalizeTitle(track.name);
      return got.startsWith(want) || want.startsWith(got);
    }) || null
  );
}

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGO_URI or MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  let albumQuery = Album.find()
    .populate("artist", "name")
    .sort({ createdAt: 1 })
    .lean();
  if (limit && Number.isFinite(limit) && limit > 0) {
    albumQuery = albumQuery.limit(limit);
  }

  const albums = await albumQuery;
  console.log(
    `[migrate:song-explicit] ${albums.length} album(s)` +
      `${dryRun ? " (dry-run)" : ""}`,
  );

  let albumsMatched = 0;
  let albumsMissed = 0;
  let songsUpdated = 0;
  let songsExplicitTrue = 0;
  let songsUnmatched = 0;
  let songsSkippedSame = 0;

  for (const album of albums) {
    const artistName = album.artist?.[0]?.name || "";
    const label = `"${album.title}"${artistName ? ` — ${artistName}` : ""}`;

    let spotifyAlbum;
    try {
      spotifyAlbum = await searchSpotifyAlbum(album.title, artistName);
    } catch (error) {
      console.warn(
        `  ! search failed for ${label}: ${error.message}`,
      );
      albumsMissed += 1;
      await sleep(200);
      continue;
    }

    if (!spotifyAlbum?.id) {
      console.warn(`  - no Spotify album for ${label}`);
      albumsMissed += 1;
      await sleep(150);
      continue;
    }

    const spotifyName = spotifyAlbum.name;
    if (normalizeTitle(spotifyName) !== normalizeTitle(album.title)) {
      console.warn(
        `  ~ weak match ${label} → Spotify "${spotifyName}" (still using)`,
      );
    }

    let spotifyTracks;
    try {
      spotifyTracks = await fetchAllAlbumTracks(spotifyAlbum.id);
    } catch (error) {
      console.warn(
        `  ! tracks fetch failed for ${label}: ${error.message}`,
      );
      albumsMissed += 1;
      await sleep(200);
      continue;
    }

    albumsMatched += 1;

    const songs = await Song.find({ albumId: album._id })
      .select("_id title trackNumber discNumber explicit")
      .lean();

    const usedIds = new Set();
    let albumExplicitHits = 0;

    for (const song of songs) {
      const track = matchSongToSpotifyTrack(song, spotifyTracks, usedIds);
      if (!track) {
        songsUnmatched += 1;
        continue;
      }
      usedIds.add(track.id);

      const explicit = Boolean(track.explicit);
      if (explicit) albumExplicitHits += 1;

      if (Boolean(song.explicit) === explicit) {
        songsSkippedSame += 1;
        continue;
      }

      if (!dryRun) {
        await Song.updateOne({ _id: song._id }, { $set: { explicit } });
      }
      songsUpdated += 1;
      if (explicit) songsExplicitTrue += 1;
    }

    console.log(
      `  ✓ ${label} → ${spotifyTracks.length} spotify / ${songs.length} local` +
        `, explicit=${albumExplicitHits}` +
        `${dryRun ? " (dry-run)" : ""}`,
    );

    await sleep(150);
  }

  console.log(
    `[migrate:song-explicit] done.` +
      ` albumsMatched=${albumsMatched} albumsMissed=${albumsMissed}` +
      ` songsUpdated=${songsUpdated} explicitSetTrue=${songsExplicitTrue}` +
      ` unmatched=${songsUnmatched} unchanged=${songsSkippedSame}` +
      `${dryRun ? " (dry-run, no writes)" : ""}`,
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[migrate:song-explicit] Failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
