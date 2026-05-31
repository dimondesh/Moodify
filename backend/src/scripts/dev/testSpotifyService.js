// backend/testSpotifyService.js
import { getAlbumDataFromSpotify } from "./spotifyService.js";

const TEST_ALBUM_URL = "https://open.spotify.com/album/47rlABSBChwZC7qxAKzOWw"; 

async function runTest() {
  console.log(
    `Тестируем получение данных альбома из Spotify по URL: ${TEST_ALBUM_URL}`
  );

  const albumData = await getAlbumDataFromSpotify(TEST_ALBUM_URL);

  if (albumData) {
    console.log("\n--- Полученные данные альбома ---");
    console.log("Название альбома:", albumData.name);
    console.log("Артисты:", albumData.artists.map((a) => a.name).join(", "));
    console.log("Год выпуска:", albumData.release_date.split("-")[0]); 
    console.log(
      "URL обложки (первый):",
      albumData.images.length > 0 ? albumData.images[0].url : "Нет"
    );
    console.log("Количество треков:", albumData.total_tracks);
    console.log("\n--- Треки ---");
    albumData.tracks.forEach((track) => {
      console.log(`- ${track.name} (Длительность: ${track.duration_ms} мс)`);
    });
    console.log("------------------------------");
    console.log("\nТест пройден успешно: Данные альбома получены из Spotify.");
  } else {
    console.log(
      "\n!!! Тест не пройден: Не удалось получить данные альбома из Spotify или произошла ошибка. !!!"
    );
    console.log("Возможные причины:");
    console.log(
      "  - Неправильный SPOTIFY_CLIENT_ID или SPOTIFY_CLIENT_SECRET в .env."
    );
    console.log("  - Неверный Spotify URL альбома.");
    console.log("  - Проблемы с интернет-соединением или API Spotify.");
    console.log("  - Проверьте логи выше на наличие ошибок от SpotifyService.");
  }
}

runTest();
