// backend/testLrclibService.js
import { getLrcLyricsFromLrclib } from "../../lib/integrations/lyricsService.js";

const TEST_SONG_DATA = {
  artistName: "Queen",
  songName: "Bohemian Rhapsody",
  albumName: "A Night at the Opera",
  // lrclib expects seconds (Bohemian Rhapsody ≈ 5:55)
  songDuration: 355,
};

async function runTest() {
  console.log(
    `[test] LRC for "${TEST_SONG_DATA.songName}" - "${TEST_SONG_DATA.artistName}"`
  );

  const lyrics = await getLrcLyricsFromLrclib(TEST_SONG_DATA);

  if (lyrics) {
    console.log("[test] Synced LRC:");
    console.log(lyrics);
    console.log("[test] OK");
  } else {
    console.log("[test] FAIL: no synced LRC");
    console.log("[test] Hint: no synced lyrics, bad metadata, or network error");
  }
}

runTest();
