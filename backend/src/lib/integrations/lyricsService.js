// backend/src/lib/integrations/lyricsService.js
import axios from "axios";

const LRCLIB_API = "https://lrclib.net/api";

const hasSyncedLyrics = (record) =>
  typeof record?.syncedLyrics === "string" &&
  record.syncedLyrics.trim().length > 0;

/** First search hit that actually has synced LRC (not just plain text). */
const pickSyncedLyrics = (records) => {
  if (!Array.isArray(records)) return null;
  const hit = records.find(hasSyncedLyrics);
  return hit ? hit.syncedLyrics : null;
};

/**
 * Exact match — same path LRCGET prefers.
 * lrclib duration is seconds (integer).
 */
const getLyricsByExact = async (
  artistName,
  songName,
  albumName,
  durationSec,
) => {
  if (!albumName || !Number.isFinite(durationSec) || durationSec <= 0) {
    return null;
  }

  try {
    const { data, status } = await axios.get(`${LRCLIB_API}/get`, {
      params: {
        artist_name: artistName,
        track_name: songName,
        album_name: albumName,
        duration: Math.round(durationSec),
      },
      validateStatus: (s) => s === 200 || s === 404,
    });

    if (status === 200 && hasSyncedLyrics(data)) {
      return data.syncedLyrics;
    }
    return null;
  } catch (error) {
    console.error(`[Lrclib] /api/get failed:`, error.message);
    return null;
  }
};

const searchSyncedLyrics = async (params) => {
  try {
    const { data } = await axios.get(`${LRCLIB_API}/search`, { params });
    return pickSyncedLyrics(data);
  } catch (error) {
    console.error(`[Lrclib] /api/search failed:`, error.message);
    return null;
  }
};

/**
 * @param {{ artistName: string, songName: string, albumName?: string, songDuration?: number }} songData
 * songDuration must be in seconds (same unit as Song.duration / ffprobe).
 */
export const getLrcLyricsFromLrclib = async (songData) => {
  const { artistName, songName, albumName, songDuration } = songData;

  if (!songName || !artistName) {
    console.warn("[Lrclib] Missing song or artist name");
    return null;
  }

  const durationSec = Number(songDuration);

  try {
    console.log(`[Lrclib] Exact get: ${artistName} - ${songName}`);
    let synced = await getLyricsByExact(
      artistName,
      songName,
      albumName,
      durationSec,
    );
    if (synced) return synced;

    console.log(`[Lrclib] Search by fields: ${artistName} - ${songName}`);
    synced = await searchSyncedLyrics({
      artist_name: artistName,
      track_name: songName,
      ...(albumName ? { album_name: albumName } : {}),
    });
    if (synced) return synced;

    const q = [artistName, songName, albumName].filter(Boolean).join(" ");
    console.log(`[Lrclib] Search by query: ${q}`);
    synced = await searchSyncedLyrics({ q });
    if (synced) return synced;

    console.warn(`[Lrclib] No synced LRC for "${songName}" - "${artistName}"`);
    return null;
  } catch (error) {
    console.error(`[Lrclib] Lyrics fetch failed:`, error.message);
    return null;
  }
};
