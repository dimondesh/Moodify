// backend/src/lib/lyricsService.js
import axios from "axios";

export const getLrcLyricsFromLrclib = async (songData) => {
  const { artistName, songName, albumName, songDuration } = songData;

  if (!songName || !artistName) {
    console.warn(
      "Недостаточно данных (название песни или артист) для поиска текстов на lrclib.net."
    );
    return null;
  }

  let lyricsResult = null;

  try {
    console.log(`[Lrclib] Поиск по сигнатуре: ${artistName} - ${songName}`);
    lyricsResult = await getLyricsBySignature(
      artistName,
      songName,
      albumName,
      songDuration
    );

    if (lyricsResult && lyricsResult.foundSyncedLyrics) {
      return lyricsResult.syncedLyrics.join("\n");
    }

    console.log(
      `[Lrclib] Поиск по запросу: ${artistName} - ${songName} ${albumName}`
    );
    lyricsResult = await getLyricsByQuery(artistName, songName, albumName);

    if (lyricsResult && lyricsResult.foundSyncedLyrics) {
      return lyricsResult.syncedLyrics.join("\n");
    }

    console.warn(
      `[Lrclib] Синхронизированные LRC-тексты не найдены для "${songName}" - "${artistName}".`
    );
    return null;
  } catch (error) {
    console.error(`[Lrclib] Ошибка при получении текстов:`, error.message);
    return null;
  }
};

const getLyricsBySignature = async (
  artistName,
  songName,
  albumName,
  songDuration
) => {
  try {
    const encodedArtistName = encodeURIComponent(artistName);
    const encodedSongName = encodeURIComponent(songName);
    const encodedAlbumName = encodeURIComponent(albumName);

    const url = `https://lrclib.net/api/search?artist_name=${encodedArtistName}&track_name=${encodedSongName}&album_name=${encodedAlbumName}&duration=${songDuration}`;
    const res = await axios.get(url);
    if (res.data.length !== 0) {
      return {
        syncedLyrics:
          res.data[0].syncedLyrics !== null
            ? res.data[0].syncedLyrics.split("\n")
            : ["Synced Lyrics Not Found!"],
        plainLyrics:
          res.data[0].plainLyrics !== null
            ? res.data[0].plainLyrics.split("\n")
            : ["Plain Lyrics not found!"],
        foundSyncedLyrics: res.data[0].syncedLyrics != null,
        foundPlainLyrics: res.data[0].plainLyrics != null,
      };
    }
    return null;
  } catch (error) {
    console.error(`[Lrclib] Ошибка в getLyricsBySignature:`, error.message);
    return null;
  }
};

export { getLyricsBySignature };

const getLyricsByQuery = async (artistName, songName, albumName) => {
  try {
    const encodedArtistName = encodeURIComponent(artistName);
    const encodedSongName = encodeURIComponent(songName);
    const encodedAlbumName = encodeURIComponent(albumName || "");

    let query = `${encodedArtistName} ${encodedSongName}`;
    if (encodedAlbumName) {
      query += ` ${encodedAlbumName}`;
    }

    const reqUrl = `https://lrclib.net/api/search?q=${query}`;
    const res = await axios.get(reqUrl);

    if (res.data.length === 0) return null;

    const bestMatch = res.data[0];

    return {
      syncedLyrics:
        bestMatch.syncedLyrics != null
          ? bestMatch.syncedLyrics.split("\n")
          : ["Synced Lyrics Not Found!"],
      plainLyrics:
        bestMatch.plainLyrics != null
          ? bestMatch.plainLyrics.split("\n")
          : ["Plain Lyrics Not Found!"],
      foundSyncedLyrics: bestMatch.syncedLyrics != null,
      foundPlainLyrics: bestMatch.plainLyrics != null,
    };
  } catch (error) {
    console.error(`[Lrclib] Ошибка в getLyricsByQuery:`, error.message);
    return null;
  }
};

export { getLyricsByQuery };
