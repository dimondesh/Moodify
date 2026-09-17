/**
 * Assert search helpers stay cheap: regex escape + no unbounded artist-song fanout.
 * Run: node src/controller/search.selfcheck.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "search.controller.js"), "utf8");

assert.match(src, /escapeRegex/, "search must escape regex metacharacters");
assert.doesNotMatch(
  src,
  /attachTopSongsToArtists/,
  "search must not fan out all songs for matching artists",
);
assert.doesNotMatch(
  src,
  /attachSongsToAlbums/,
  "search must not embed full album tracklists",
);
assert.match(
  src,
  /ARTIST_LIST_SELECT/,
  "search must project artists without embeddings",
);

console.log("search.selfcheck: ok");
