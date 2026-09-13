/**
 * Self-check: Spotify ↔ Deezer/ZIP title matching after feat/remaster normalize.
 * Run: node backend/src/lib/media/normalizeTrackName.check.js
 */
import path from "path";
import { fileURLToPath } from "url";
import { buildTrackFilesMap, findTrackFiles } from "./zipHandler.js";

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const match = (spotifyName, fileBaseName) => {
  const filePath = path.join("/tmp", `${fileBaseName}.mp3`);
  const map = buildTrackFilesMap([filePath]);
  const hit = findTrackFiles(map, spotifyName);
  return Boolean(hit?.audioPath);
};

const cases = [
  // feat variants
  ["Song (feat. Artist)", "Song featuring Artist"],
  ["Song ft. Artist", "Song (feat. Artist)"],
  ["Song (with Artist)", "Song (feat. Artist)"],
  ["Song feat. Artist", "Song (feat. Artist)"],
  ["Song - feat. Artist", "Song (feat. Artist)"],
  ["Song (feat. A & B)", "Song featuring A and B"],

  // remaster variants: paren / dash / bare, remaster vs remastered
  ["Song - Remastered", "Song (Remastered)"],
  ["Song Remastered", "Song - Remaster"],
  ["Song (Remastered 2011)", "Song - Remastered"],
  ["Song - Remastered 2011", "Song (Remastered)"],

  // stacked
  ["Song (feat. X) - Remastered", "Song featuring X"],
  ["Song (feat. X) [Remastered]", "Song ft. X"],

  // radio edit delimiter variants
  ["Song - Radio Edit", "Song (Radio Edit)"],

  // remix + ft + artist-prefixed filename (Deemix)
  [
    "California Love (remix) (ft. Dr. Dre, Roger Troutman) - Remix",
    "2Pac - California Love (Remix)",
  ],
  ["Song (Remix)", "Song - Remix"],
  ["Song Remix", "Song (remix)"],
];

for (const [spotify, file] of cases) {
  assert(
    match(spotify, file),
    `expected match: Spotify "${spotify}" ↔ file "${file}"`,
  );
}

// bare "with" in the title is not a credit marker — still matches itself
assert(
  match("Sleeping with Ghosts", "Sleeping with Ghosts"),
  "exact title with bare 'with' should match itself",
);

// longest includes: prefer more specific file when both match
{
  const map = buildTrackFilesMap([
    "/tmp/Love.mp3",
    "/tmp/Love Song.mp3",
  ]);
  const hit = findTrackFiles(map, "Love Song (feat. X)");
  assert(
    hit?.audioPath?.endsWith("Love Song.mp3"),
    `expected longest match Love Song.mp3, got ${hit?.audioPath}`,
  );
}

console.log(`ok: ${cases.length} match cases + negatives (${path.basename(fileURLToPath(import.meta.url))})`);
