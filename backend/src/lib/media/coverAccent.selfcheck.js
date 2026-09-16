/**
 * Self-check: WebP covers must yield an accent (Vibrant has no WebP).
 * Run: node src/lib/media/coverAccent.selfcheck.js
 */
import sharp from "sharp";
import { extractCoverAccentHexFromBuffer } from "./coverAccent.service.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const webp = await sharp({
  create: {
    width: 64,
    height: 64,
    channels: 3,
    background: { r: 180, g: 40, b: 60 },
  },
})
  .webp()
  .toBuffer();

const hex = await extractCoverAccentHexFromBuffer(webp);
assert(typeof hex === "string" && /^#[0-9a-f]{6}$/.test(hex), `expected #rrggbb, got ${hex}`);
console.log("coverAccent.selfcheck: ok", hex);
