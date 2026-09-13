// backend/src/lib/zipHandler.js
import yauzl from "yauzl";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import iconv from "iconv-lite";

export const extractZip = (zipFilePath, tempDir) => {
  return new Promise(async (resolve, reject) => {
    try {
      await fsp.mkdir(tempDir, { recursive: true });
      const extractedFilePaths = [];

      yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
        if (err)
          return reject(
            new Error(`[ZipHandler] Ошибка открытия ZIP: ${err.message}`),
          );

        zipfile.readEntry();

        zipfile.on("entry", (entry) => {
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
            return;
          }

          const isUtf8 = (entry.generalPurposeBitFlag & 0x800) !== 0;
          const decodedFileName = isUtf8
            ? entry.fileName
            : iconv.decode(entry.fileName, "cp437");

          const destPath = path.join(tempDir, decodedFileName);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err)
              return reject(
                new Error(`[ZipHandler] Ошибка чтения записи: ${err.message}`),
              );

            const writeStream = fs.createWriteStream(destPath);
            readStream.pipe(writeStream);

            writeStream.on("finish", () => {
              extractedFilePaths.push(destPath);
              zipfile.readEntry();
            });
            writeStream.on("error", (writeErr) => {
              reject(
                new Error(
                  `[ZipHandler] Ошибка записи файла: ${writeErr.message}`,
                ),
              );
            });
          });
        });

        zipfile.on("end", () => {
          console.log(`[ZipHandler] ZIP-файл успешно распакован в: ${tempDir}`);
          resolve(extractedFilePaths);
        });

        zipfile.on("error", (zipErr) => {
          reject(
            new Error(`[ZipHandler] Критическая ошибка ZIP: ${zipErr.message}`),
          );
        });
      });
    } catch (error) {
      reject(
        new Error(`[ZipHandler] Не удалось начать распаковку: ${error.message}`),
      );
    }
  });
};

/**
 * Parses a track filename to identify its type (audio or lyrics).
 * @param {string} filename - The full path to the file.
 * @returns {{songName: string, trackType: 'audio' | 'lrc'} | null}
 */
export const parseTrackFileName = (filename) => {
  const baseName = path.basename(filename, path.extname(filename));
  const extension = path.extname(filename).toLowerCase();

  const audioExtensions = [
    ".mp3",
    ".wav",
    ".flac",
    ".aac",
    ".m4a",
    ".ogg",
    ".opus",
  ];

  if (extension === ".lrc") {
    const songName = baseName.replace(/[-_](lyrics|lrc)$/i, "").trim();
    return { songName, trackType: "lrc" };
  }

  if (audioExtensions.includes(extension)) {
    const songName = baseName
      .replace(/[-_](instrumental|instr|vocals|vocal)$/i, "")
      .trim();
    return { songName, trackType: "audio" };
  }

  console.warn(
    `[ZipHandler] Не удалось распознать формат файла: ${filename}. Пропускаем.`,
  );
  return null;
};

/** Feat / featuring / ft / (with …) — paren, dash, or trailing bare. */
const FEAT_PAREN_RE =
  /\s*[([{]\s*(?:feat(?:uring)?|ft|with)\b\.?[^)\]}]*[)\]}]/gi;
const FEAT_DASH_RE = /\s*[-–—]\s*(?:feat(?:uring)?|ft)\.?\s+.+$/i;
const FEAT_TRAIL_RE = /\s+(?:feat(?:uring)?|ft)\.?\s+.+$/i;

/** Version tags: remaster(ed) (±year before/after), remix, radio edit, live, … */
const REMASTER_TAG = "(?:\\d{2,4}\\s+)?re-?masters?(?:ed)?(?:\\s+\\d{2,4})?";
const VERSION_TAG = `(?:${REMASTER_TAG}|re-?mix(?:es)?|radio\\s*edit|live(?:\\s+[^)\\]}\\-–—]+)?|explicit|clean|deluxe|extended(?:\\s+mix)?|bonus(?:\\s+track)?|instrumental|acoustic)`;
const VERSION_PAREN_RE = new RegExp(
  `\\s*[([{]\\s*${VERSION_TAG}\\s*[)\\]}]`,
  "gi",
);
const VERSION_DASH_RE = new RegExp(`\\s*[-–—]\\s*${VERSION_TAG}\\s*$`, "i");
const VERSION_TRAIL_RE = new RegExp(
  `\\s+(?:${REMASTER_TAG}|re-?mix(?:es)?)\\s*$`,
  "i",
);

/**
 * Canonicalize Spotify ↔ Deezer/ZIP title differences (feat wording,
 * remaster vs remastered, paren vs dash vs bare suffixes).
 */
const normalizeTrackName = (name) => {
  let s = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  // ponytail: stacked suffixes like "(feat. X) - Remastered 2011"; 3 passes is enough
  for (let i = 0; i < 3; i++) {
    const prev = s;
    s = s
      .replace(FEAT_PAREN_RE, "")
      .replace(VERSION_PAREN_RE, "")
      .replace(FEAT_DASH_RE, "")
      .replace(VERSION_DASH_RE, "")
      .replace(FEAT_TRAIL_RE, "")
      .replace(VERSION_TRAIL_RE, "");
    if (s === prev) break;
  }

  return s.replace(/[^\p{L}\p{N}]/gu, "");
};

/** @param {string[]} extractedFilePaths */
export const buildTrackFilesMap = (extractedFilePaths) => {
  const trackFilesMap = {};
  for (const filePath of extractedFilePaths) {
    const parsed = parseTrackFileName(filePath);
    if (!parsed) continue;
    const normalizedSongName = normalizeTrackName(parsed.songName);
    if (!trackFilesMap[normalizedSongName]) {
      trackFilesMap[normalizedSongName] = {};
    }
    trackFilesMap[normalizedSongName][`${parsed.trackType}Path`] = filePath;
  }
  return trackFilesMap;
};

/** @param {Record<string, Record<string, string>>} trackFilesMap */
export const findTrackFiles = (trackFilesMap, trackName) => {
  const normalizedName = normalizeTrackName(trackName);
  if (!normalizedName) return null;
  if (trackFilesMap[normalizedName]) {
    return trackFilesMap[normalizedName];
  }

  let bestKey = null;
  for (const fileKey in trackFilesMap) {
    if (
      !fileKey ||
      !(normalizedName.includes(fileKey) || fileKey.includes(normalizedName))
    ) {
      continue;
    }
    if (!bestKey || fileKey.length > bestKey.length) {
      bestKey = fileKey;
    }
  }
  return bestKey ? trackFilesMap[bestKey] : null;
};

/** Recursively list all files under dirPath. */
export const listFilesRecursive = async (dirPath) => {
  const results = [];
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursive(full)));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
};

export const cleanUpTempDir = async (dirPath) => {
  try {
    await fsp.rm(dirPath, { recursive: true, force: true });
    console.log(`[ZipHandler] Временная директория удалена: ${dirPath}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        `[ZipHandler] Ошибка при удалении ${dirPath}:`,
        error.message,
      );
    }
  }
};
