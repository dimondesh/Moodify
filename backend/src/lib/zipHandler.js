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
            new Error(`[ZipHandler] Ошибка открытия ZIP: ${err.message}`)
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
                new Error(`[ZipHandler] Ошибка чтения записи: ${err.message}`)
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
                  `[ZipHandler] Ошибка записи файла: ${writeErr.message}`
                )
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
            new Error(`[ZipHandler] Критическая ошибка ZIP: ${zipErr.message}`)
          );
        });
      });
    } catch (error) {
      reject(
        new Error(`[ZipHandler] Не удалось начать распаковку: ${error.message}`)
      );
    }
  });
};

/**
 * Parses a track filename to identify its type (audio or lyrics).
 * Now expects a single audio file per song.
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

  // Если это файл текста, обрабатываем его
  if (extension === ".lrc") {
    const songName = baseName.replace(/[-_](lyrics|lrc)$/i, "").trim();
    return { songName, trackType: "lrc" };
  }

  // Если это аудиофайл, обрабатываем его
  if (audioExtensions.includes(extension)) {
    // Убираем возможные старые суффиксы для чистого имени
    const songName = baseName
      .replace(/[-_](instrumental|instr|vocals|vocal)$/i, "")
      .trim();
    return { songName, trackType: "audio" };
  }

  console.warn(
    `[ZipHandler] Не удалось распознать формат файла: ${filename}. Пропускаем.`
  );
  return null;
};

export const cleanUpTempDir = async (dirPath) => {
  try {
    await fsp.rm(dirPath, { recursive: true, force: true });
    console.log(`[ZipHandler] Временная директория удалена: ${dirPath}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        `[ZipHandler] Ошибка при удалении ${dirPath}:`,
        error.message
      );
    }
  }
};
