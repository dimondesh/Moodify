// backend/src/services/spotifyService.js
import axios from "axios";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token";

let accessToken = null;
let tokenExpiresAt = 0;

/** @type {((retryAfterSec: number) => void | Promise<void>) | null} */
let rateLimitHandler = null;

export class SpotifyRateLimitError extends Error {
  /**
   * @param {number} retryAfterSec
   */
  constructor(retryAfterSec) {
    const sec = Math.max(1, Number(retryAfterSec) || 30);
    super(`Spotify rate limited (429), retry after ${sec}s`);
    this.name = "SpotifyRateLimitError";
    this.isSpotifyRateLimit = true;
    this.statusCode = 429;
    this.retryAfterSec = sec;
  }
}

/**
 * Register a handler invoked as soon as Spotify returns 429
 * (e.g. pause the album-ingest queue).
 * @param {(retryAfterSec: number) => void | Promise<void>} handler
 */
export const onSpotifyRateLimit = (handler) => {
  rateLimitHandler = typeof handler === "function" ? handler : null;
};

const parseRetryAfterSec = (error) => {
  const raw = error?.response?.headers?.["retry-after"];
  const sec = Number(raw);
  return Number.isFinite(sec) && sec > 0 ? sec : 30;
};

/**
 * @param {unknown} error
 * @param {string} context
 * @returns {Promise<null>}
 */
const handleSpotifyRequestError = async (error, context) => {
  if (error?.isSpotifyRateLimit) throw error;

  if (error?.response?.status === 429) {
    const retryAfterSec = parseRetryAfterSec(error);
    console.warn(
      `[SpotifyService] 429 rate limit (${context}), retry-after=${retryAfterSec}s`,
    );
    try {
      await rateLimitHandler?.(retryAfterSec);
    } catch (handlerErr) {
      console.error(
        "[SpotifyService] rate limit handler failed:",
        handlerErr?.message || handlerErr,
      );
    }
    throw new SpotifyRateLimitError(retryAfterSec);
  }

  console.error(`[SpotifyService] ${context}:`, error?.message || error);
  if (error?.response) {
    console.error(
      "Status:",
      error.response.status,
      "Data:",
      error.response.data,
    );
  }
  return null;
};

const getAccessToken = async () => {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  try {
    const response = await axios.post(
      SPOTIFY_AUTH_URL,
      "grant_type=client_credentials",
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET
            ).toString("base64"),
        },
      }
    );

    accessToken = response.data.access_token;
    tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

    console.log("[Spotify] Access token refreshed");
    return accessToken;
  } catch (error) {
    await handleSpotifyRequestError(error, "token");
    throw new Error("Не удалось получить токен доступа Spotify.");
  }
};

const getAlbumIdFromUrl = (albumUrl) => {
  const match = albumUrl.match(/spotify\.com\/album\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

export const getAlbumDataFromSpotify = async (albumUrl) => {
  const albumId = getAlbumIdFromUrl(albumUrl);
  if (!albumId) {
    console.error("[Spotify] Invalid album URL:", albumUrl);
    return null;
  }

  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `http://api.spotify.com/v1/albums/${albumId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const albumData = response.data;

    const extractedData = {
      id: albumData.id,
      name: albumData.name,
      artists: albumData.artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
      })),
      release_date: albumData.release_date,
      images: albumData.images,
      album_type: albumData.album_type,
      total_tracks: albumData.total_tracks,
      tracks: albumData.tracks.items.map((track) => ({
        id: track.id,
        name: track.name,
        duration_ms: track.duration_ms,
        track_number: track.track_number,
        disc_number: track.disc_number,
        explicit: Boolean(track.explicit),

        artists: track.artists.map((artist) => ({
          id: artist.id,
          name: artist.name,
        })),
      })),
    };

    console.log(`[Spotify] Album fetched: ${extractedData.name}`);
    return extractedData;
  } catch (error) {
    return handleSpotifyRequestError(
      error,
      `album ${albumId}`,
    );
  }
};
export const getArtistDataFromSpotify = async (artistId) => {
  if (!artistId) {
    console.error("[Spotify] Artist id missing");
    return null;
  }

  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `https://api.spotify.com/v1/artists/${artistId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(`[Spotify] Artist fetched: ${response.data.name}`);
    return response.data;
  } catch (error) {
    return handleSpotifyRequestError(error, `artist ${artistId}`);
  }
};
