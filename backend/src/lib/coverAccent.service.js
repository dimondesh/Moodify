// backend/src/lib/coverAccent.service.js
import { Vibrant } from "node-vibrant/node";
import axios from "axios";

const DEFAULT_COVER_SUBSTR = "default-album-cover";

/** @param {string | null | undefined} url */
export function isSkippableCoverImageUrl(url) {
  if (!url || typeof url !== "string") return true;
  const u = url.toLowerCase();
  return u.includes(DEFAULT_COVER_SUBSTR);
}

export function pickAccentHexFromPalette(palette) {
  const order = [
    "DarkVibrant",
    "Vibrant",
    "DarkMuted",
    "Muted",
    "LightVibrant",
    "LightMuted",
  ];
  for (const key of order) {
    const swatch = palette[key];
    if (swatch && typeof swatch.hex === "string") {
      const h = swatch.hex.startsWith("#") ? swatch.hex : `#${swatch.hex}`;
      return h.toLowerCase();
    }
  }
  return null;
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<string | null>}
 */
export async function extractCoverAccentHexFromBuffer(buffer) {
  if (!buffer || buffer.length === 0) return null;
  try {
    const palette = await Vibrant.from(buffer).getPalette();
    return pickAccentHexFromPalette(palette);
  } catch (err) {
    console.warn("[coverAccent] extract from buffer failed:", err?.message || err);
    return null;
  }
}

/**
 * @param {string} imageUrl
 * @returns {Promise<string | null>}
 */
export async function extractCoverAccentHexFromUrl(imageUrl) {
  if (isSkippableCoverImageUrl(imageUrl)) return null;
  try {
    const res = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      maxContentLength: 8 * 1024 * 1024,
    });
    const buffer = Buffer.from(res.data);
    return extractCoverAccentHexFromBuffer(buffer);
  } catch (err) {
    console.warn(
      `[coverAccent] extract from URL failed (${imageUrl}):`,
      err?.message || err,
    );
    return null;
  }
}
