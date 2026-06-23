import axios from "axios";
import fs from "fs";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

const JAMENDO_API_BASE = "https://api.jamendo.com/v3.0";
const REQUEST_DELAY_MS = 1100;
const MAX_RETRIES = 6;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getClientId = () => {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    throw new Error("JAMENDO_CLIENT_ID is not set in environment");
  }
  return clientId;
};

const fetchJamendo = async (endpoint, params = {}, attempt = 0) => {
  await sleep(REQUEST_DELAY_MS);

  try {
    const response = await axios.get(`${JAMENDO_API_BASE}${endpoint}`, {
      params: {
        client_id: getClientId(),
        format: "json",
        ...params,
      },
      timeout: 45000,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 429) {
      if (attempt >= MAX_RETRIES) {
        throw new Error(
          `Jamendo rate limit exceeded after ${MAX_RETRIES} retries`,
        );
      }
      const retryAfterHeader = parseInt(response.headers["retry-after"], 10);
      const retryAfterBody = response.data?.retry_after;
      const waitSec = retryAfterHeader || retryAfterBody || 30 + attempt * 15;
      console.warn(
        `[Jamendo] Rate limited on ${endpoint}, waiting ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await sleep(waitSec * 1000);
      return fetchJamendo(endpoint, params, attempt + 1);
    }

    if (response.status !== 200) {
      throw new Error(
        response.data?.detail ||
          response.data?.title ||
          `Jamendo HTTP ${response.status}: ${endpoint}`,
      );
    }

    const headers = response.data?.headers;
    if (headers?.status !== "success") {
      throw new Error(headers?.error_message || `Jamendo API error: ${endpoint}`);
    }

    return {
      results: response.data?.results || [],
      resultsCount: headers?.results_count ?? 0,
    };
  } catch (error) {
    if (error.response?.status === 429 && attempt < MAX_RETRIES) {
      const waitSec =
        parseInt(error.response.headers?.["retry-after"], 10) ||
        error.response.data?.retry_after ||
        30 + attempt * 15;
      console.warn(
        `[Jamendo] Rate limited, waiting ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await sleep(waitSec * 1000);
      return fetchJamendo(endpoint, params, attempt + 1);
    }
    throw error;
  }
};

/** @returns {string | null} block reason or null if importable */
export const getTrackImportBlockReason = (track) => {
  if (!track) return "no_track";

  const downloadUrl = track.audiodownload || track.track_audiodownload;
  const licenseUrl = track.license_ccurl || track.track_license_ccurl;

  const downloadExplicitlyDenied =
    track.audiodownload_allowed === false ||
    track.audiodownload_allowed === "false" ||
    track.audiodownload_allowed === 0;

  if (downloadExplicitlyDenied) return "download_not_allowed";
  if (!downloadUrl || String(downloadUrl).trim() === "") return "no_download_url";

  if (!licenseUrl || !String(licenseUrl).includes("creativecommons.org")) {
    return "no_cc_license";
  }

  const licenses = track.licenses || track.track_licenses;
  if (licenses?.prolicensing === true || licenses?.prolicensing === "true") {
    return "pro_licensing";
  }

  return null;
};

export const isImportableTrack = (track) => !getTrackImportBlockReason(track);

export const validateFullAlbum = (tracks) => {
  if (!tracks?.length) {
    return { ok: false, reason: "no_tracks" };
  }

  const sorted = [...tracks].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  for (const track of sorted) {
    const blockReason = getTrackImportBlockReason(track);
    if (blockReason) {
      return {
        ok: false,
        reason: "track_not_importable",
        blockReason,
        trackName: track.name,
        trackId: track.id,
      };
    }
  }

  return { ok: true, tracks: sorted };
};

export const hasValidAlbumCover = (album) => {
  const image = album?.image || album?.album_image;
  return Boolean(image && typeof image === "string" && image.trim());
};

export const fetchTracksByTag = async ({
  tag,
  offset = 0,
  limit = 200,
  order = "popularity_total",
}) => {
  const { results } = await fetchJamendo("/tracks/", {
    tags: tag,
    offset,
    limit,
    order,
    include: "musicinfo+licenses",
    audiodlformat: "mp32",
    imagesize: 600,
  });
  return results;
};

/** Group importable tracks into unique album summaries (newest/popular catalog first). */
export const buildAlbumSummariesFromTracks = (tracks) => {
  const byAlbumId = new Map();

  for (const track of tracks) {
    if (!isImportableTrack(track)) continue;
    const albumId = String(track.album_id || "");
    if (!albumId) continue;

    if (!byAlbumId.has(albumId)) {
      byAlbumId.set(albumId, {
        id: albumId,
        name: track.album_name,
        image: track.album_image || track.image,
        artist_id: track.artist_id,
        artist_name: track.artist_name,
        releasedate: track.releasedate,
      });
    }
  }

  return Array.from(byAlbumId.values());
};

export const fetchAlbumsByTag = async ({ tag, offset = 0, limit = 200 }) => {
  const { results } = await fetchJamendo("/albums/", {
    tags: tag,
    offset,
    limit,
    imagesize: 600,
  });
  return results;
};

export const fetchAlbumById = async (albumId) => {
  const { results } = await fetchJamendo("/albums/", {
    id: albumId,
    imagesize: 600,
  });
  return results[0] || null;
};

export const fetchAlbumTracks = async (albumId) => {
  const allTracks = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const { results, resultsCount } = await fetchJamendo("/tracks/", {
      album_id: albumId,
      offset,
      limit,
      include: "musicinfo+licenses",
      audiodlformat: "mp32",
      imagesize: 600,
      track_type: "albumtrack single",
    });

    allTracks.push(...results);
    offset += limit;

    if (!results.length || allTracks.length >= resultsCount) {
      break;
    }
  }

  return allTracks;
};

export const fetchArtistById = async (artistId) => {
  const { results } = await fetchJamendo("/artists/", {
    id: artistId,
    imagesize: 600,
  });
  return results[0] || null;
};

export const downloadToFile = async (url, destPath) => {
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 300000,
    maxRedirects: 5,
  });

  await pipeline(response.data, createWriteStream(destPath));
};

export const downloadAlbumZip = async (zipUrl, destPath) => {
  await downloadToFile(zipUrl, destPath);
  const stats = fs.statSync(destPath);
  if (!stats.size) {
    throw new Error("Downloaded album ZIP is empty");
  }
};

export const downloadTrackAudio = async (url, destPath) => {
  await downloadToFile(url, destPath);
};

export const resolveAlbumType = (trackCount) => {
  if (trackCount === 1) return "Single";
  if (trackCount >= 2 && trackCount <= 6) return "EP";
  return "Album";
};

export const parseReleaseYear = (releaseDate) => {
  if (!releaseDate) return null;
  const year = parseInt(String(releaseDate).split("-")[0], 10);
  return Number.isFinite(year) ? year : null;
};

export const formatLicenseLabel = (licenseCcUrl) => {
  if (!licenseCcUrl) return null;
  const match = String(licenseCcUrl).match(/licenses\/([^/]+)\//);
  if (!match) return "Creative Commons";
  return `CC ${match[1].toUpperCase().replace(/-/g, " ")}`;
};
