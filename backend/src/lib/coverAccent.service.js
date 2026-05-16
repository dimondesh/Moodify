// backend/src/lib/coverAccent.service.js
import { Vibrant } from "node-vibrant/node";
import axios from "axios";
import sharp from "sharp";

const DEFAULT_COVER_SUBSTR = "default-album-cover";
const FALLBACK_ACCENT_HEX = "#3f3f46";

/** Scoring: prefer darker, muted accents (ambient UI, not neon) */
const QC = 2.4;
const QD = 2.6;
const QR = 0.79;
const LIGHTNESS_PENALTY_START = 48;

const MIN_CHROMA_NORM = 0.03;
const MIN_DOMINANCE = 0.01;
const MAX_CHROMA_FOR_NORM = 128;

/** Cap saturation / lightness for dark-theme gradients */
const SATURATION_FACTOR = 0.74;
const SATURATION_MAX = 0.54;
const TARGET_LIGHTNESS_MAX = 0.3;
const TARGET_LIGHTNESS_MIN = 0.13;
const LIGHTNESS_DAMPEN = 0.9;

/** Prefer muted / dark swatches; skip highlights */
const PALETTE_KEYS = [
  "DarkVibrant",
  "DarkMuted",
  "Muted",
  "Vibrant",
];

/** @param {string | null | undefined} url */
export function isSkippableCoverImageUrl(url) {
  if (!url || typeof url !== "string") return true;
  const u = url.toLowerCase();
  return u.includes(DEFAULT_COVER_SUBSTR);
}

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
export function hexToRgb(hex) {
  const h = hex.replace(/^#/, "");
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
  const c = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** @param {number} c 0–255 */
function srgbToLinear(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ L: number, chroma: number }}
 */
export function rgbToLabMetrics(r, g, b) {
  const rL = srgbToLinear(r);
  const gL = srgbToLinear(g);
  const bL = srgbToLinear(b);

  let x = rL * 0.4124564 + gL * 0.3575761 + bL * 0.1804375;
  let y = rL * 0.2126729 + gL * 0.7151522 + bL * 0.072175;
  let z = rL * 0.0193339 + gL * 0.119192 + bL * 0.9503041;

  x /= 0.95047;
  y /= 1.0;
  z /= 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const L = 116 * f(y) - 16;
  const a = 500 * (f(x) - f(y));
  const bStar = 200 * (f(y) - f(z));
  const chroma = Math.sqrt(a * a + bStar * bStar);

  return { L, chroma };
}

/**
 * HSP perceived brightness, 0–1
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function perceivedBrightness(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  return Math.sqrt(0.299 * rn * rn + 0.587 * gn * gn + 0.114 * bn * bn);
}

/** @param {number} L CIELAB L* */
export function isNearBlackOrWhiteLab(L) {
  return L < 8 || L > 92;
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} dominance 0–1
 */
export function scoreSwatch(r, g, b, dominance) {
  if (dominance < MIN_DOMINANCE) return -Infinity;

  const { L, chroma } = rgbToLabMetrics(r, g, b);
  if (isNearBlackOrWhiteLab(L)) return -Infinity;

  const chromaNorm = Math.min(chroma / MAX_CHROMA_FOR_NORM, 1);
  if (chromaNorm < MIN_CHROMA_NORM) return -Infinity;

  const darkness = 1 - perceivedBrightness(r, g, b);
  const lightnessPenalty =
    L > LIGHTNESS_PENALTY_START
      ? ((L - LIGHTNESS_PENALTY_START) / 52) * 3.5
      : 0;

  return (
    QC * chromaNorm + QD * darkness + QR * dominance - lightnessPenalty
  );
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {[number, number, number]}
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h, s, l];
}

/**
 * @param {number} h 0–1
 * @param {number} s 0–1
 * @param {number} l 0–1
 * @returns {[number, number, number]}
 */
function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }

  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ r: number, g: number, b: number }}
 */
export function tuneForDarkUi(r, g, b) {
  let [h, s, l] = rgbToHsl(r, g, b);

  s = Math.min(s * SATURATION_FACTOR, SATURATION_MAX);
  l = Math.min(l * LIGHTNESS_DAMPEN, TARGET_LIGHTNESS_MAX);
  if (l < TARGET_LIGHTNESS_MIN) l = TARGET_LIGHTNESS_MIN;

  const [nr, ng, nb] = hslToRgb(h, s, l);
  const { L } = rgbToLabMetrics(nr, ng, nb);

  if (isNearBlackOrWhiteLab(L)) {
    return hexToRgb(FALLBACK_ACCENT_HEX);
  }

  return { r: nr, g: ng, b: nb };
}

/**
 * @param {import('@vibrant/color').Palette} palette
 * @returns {string | null}
 */
export function pickAccentHexFromPalette(palette) {
  const swatches = [];
  let totalPop = 0;

  for (const key of PALETTE_KEYS) {
    const sw = palette[key];
    if (sw && typeof sw.hex === "string") {
      swatches.push(sw);
      totalPop += sw.population || 0;
    }
  }

  if (swatches.length === 0) return null;
  if (totalPop <= 0) totalPop = swatches.length;

  let bestRgb = null;
  let bestScore = -Infinity;

  for (const sw of swatches) {
    const hex = sw.hex.startsWith("#") ? sw.hex : `#${sw.hex}`;
    const { r, g, b } = hexToRgb(hex);
    const dominance = (sw.population || 1) / totalPop;
    const score = scoreSwatch(r, g, b, dominance);
    if (score > bestScore) {
      bestScore = score;
      bestRgb = { r, g, b };
    }
  }

  if (!bestRgb || bestScore === -Infinity) {
    return FALLBACK_ACCENT_HEX;
  }

  const tuned = tuneForDarkUi(bestRgb.r, bestRgb.g, bestRgb.b);
  return rgbToHex(tuned.r, tuned.g, tuned.b).toLowerCase();
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
async function preprocessCoverBuffer(buffer) {
  return sharp(buffer)
    .resize(128, 128, { fit: "inside", withoutEnlargement: true })
    .toBuffer();
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<string | null>}
 */
export async function extractCoverAccentHexFromBuffer(buffer) {
  if (!buffer || buffer.length === 0) return null;
  try {
    const preprocessed = await preprocessCoverBuffer(buffer);
    const palette = await Vibrant.from(preprocessed).getPalette();
    return pickAccentHexFromPalette(palette);
  } catch (err) {
    console.warn(
      "[coverAccent] extract from buffer failed:",
      err?.message || err,
    );
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
