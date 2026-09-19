// backend/testSpotifyService.js
import { getAlbumDataFromSpotify } from "../../lib/integrations/spotifyService.js";

const TEST_ALBUM_URL = "https://open.spotify.com/album/47rlABSBChwZC7qxAKzOWw"; 

async function runTest() {
  console.log(`[test] Album from Spotify: ${TEST_ALBUM_URL}`);

  const albumData = await getAlbumDataFromSpotify(TEST_ALBUM_URL);

  if (albumData) {
    console.log("[test] Album data:");
    console.log("Album:", albumData.name);
    console.log("Artists:", albumData.artists.map((a) => a.name).join(", "));
    console.log("Year:", albumData.release_date.split("-")[0]); 
    console.log(
      "Cover URL:",
      albumData.images.length > 0 ? albumData.images[0].url : "none"
    );
    console.log("Tracks:", albumData.total_tracks);
    console.log("[test] Track list:");
    albumData.tracks.forEach((track) => {
      console.log(`- ${track.name} (${track.duration_ms} ms)`);
    });
    console.log("[test] OK");
  } else {
    console.log("[test] FAIL: no album data");
    console.log("[test] Hint: check Spotify env, album URL, or network/API");
  }
}

runTest();
