// backend/testLrclibService.js
import { getLrcLyricsFromLrclib } from "./lyricsService.js";

const TEST_SONG_DATA = {
  artistName: "Queen",
  songName: "Bohemian Rhapsody",
  albumName: "A Night at the Opera",
  songDuration: 354000,
};

async function runTest() {
  console.log(
    `Тестируем получение LRC для песни: "${TEST_SONG_DATA.songName}" - "${TEST_SONG_DATA.artistName}"`
  );

  const lyrics = await getLrcLyricsFromLrclib(TEST_SONG_DATA);

  if (lyrics) {
    console.log("\n--- Полученные LRC тексты ---");
    console.log(lyrics);
    console.log("------------------------------");
    console.log("\nТест пройден успешно: LRC тексты получены с lrclib.net.");
  } else {
    console.log(
      "\n!!! Тест не пройден: Не удалось получить LRC тексты с lrclib.net или произошла ошибка. !!!"
    );
    console.log("Возможные причины:");
    console.log(
      "  - Для этой песни нет синхронизированных текстов на lrclib.net."
    );
    console.log(
      "  - Неправильно указаны название песни/артиста/альбома/длительность."
    );
    console.log("  - Проблемы с интернет-соединением.");
  }
}

runTest();
