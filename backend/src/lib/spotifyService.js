// backend/src/services/spotifyService.js
import axios from "axios";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token";

let accessToken = null;
let tokenExpiresAt = 0;

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

    console.log(
      "[SpotifyService] Токен доступа Spotify успешно получен/обновлен."
    );
    return accessToken;
  } catch (error) {
    console.error(
      "[SpotifyService] Ошибка при получении/обновлении токена доступа Spotify:",
      error.message
    );
    if (error.response) {
      console.error(
        "Status:",
        error.response.status,
        "Data:",
        error.response.data
      );
    }
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
    console.error(
      "[SpotifyService] Недействительный Spotify URL альбома:",
      albumUrl
    );
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

        artists: track.artists.map((artist) => ({
          id: artist.id,
          name: artist.name,
        })),
      })),
    };

    console.log(
      `[SpotifyService] Данные альбома "${extractedData.name}" успешно получены со Spotify.`
    );
    return extractedData;
  } catch (error) {
    console.error(
      `[SpotifyService] Ошибка при получении данных альбома ${albumId} со Spotify:`,
      error.message
    );
    if (error.response) {
      console.error(
        "Status:",
        error.response.status,
        "Data:",
        error.response.data
      );
    }
    return null;
  }
};
export const getArtistDataFromSpotify = async (artistId) => {
  if (!artistId) {
    console.error("[SpotifyService] ID артиста не предоставлен.");
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

    console.log(
      `[SpotifyService] Данные для артиста ${response.data.name} успешно получены.`
    );
    return response.data;
  } catch (error) {
    console.error(
      `[SpotifyService] Ошибка при получении данных артиста ${artistId} со Spotify:`,
      error.message
    );
    if (error.response) {
      console.error(
        "Status:",
        error.response.status,
        "Data:",
        error.response.data
      );
    }
    return null;
  }
};
