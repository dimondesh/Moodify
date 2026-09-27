/**
 * Locks the ensureSongData guard: list/persist payloads have hlsUrl but omit lyrics.
 * Run: node frontend/src/stores/ensureSongDataGuard.selfcheck.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const storePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "usePlayerStore.ts",
);
const src = readFileSync(storePath, "utf8");

const good =
  /if \(song\.hlsUrl && song\.lyrics !== undefined\) return song;/.test(src);
const bad = /if \(song\.hlsUrl\) return song;/.test(src);

if (!good || bad) {
  console.error(
    "ensureSongData must skip fetch only when hlsUrl AND lyrics are present",
  );
  process.exit(1);
}

/** Same completeness rule as ensureSongData early-return. */
const isComplete = (song) =>
  Boolean(song.hlsUrl) && song.lyrics !== undefined;

const cases = [
  [{ hlsUrl: "x" }, false],
  [{ hlsUrl: "x", lyrics: "" }, true],
  [{ hlsUrl: "x", lyrics: "[00:01]a" }, true],
  [{}, false],
];
for (const [song, want] of cases) {
  if (isComplete(song) !== want) {
    console.error("completeness mismatch", song, want);
    process.exit(1);
  }
}
console.log("ok");
