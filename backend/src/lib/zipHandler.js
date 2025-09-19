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

export const parseTrackFileName = (filename) => {
  const baseName = path.basename(filename, path.extname(filename));

  const patterns = {
    vocals: /(.*)[_-](vocals|vocal)$/i,
    instrumental: /(.*)[_-](instrumental|instr)$/i,
    lrc: /(.*)[_-](lyrics|lrc)$/i,
  };

  for (const [trackType, regex] of Object.entries(patterns)) {
    const match = baseName.match(regex);
    if (match && match[1]) {
      const songName = match[1].replace(/[_-]/g, " ").trim();
      return { songName, trackType };
    }
  }

  const spacePatterns = {
    vocals: /(.*)\s-\s(vocals|vocal)$/i,
    instrumental: /(.*)\s-\s(instrumental|instr)$/i,
    lrc: /(.*)\s-\s(lyrics|lrc)$/i,
  };

  for (const [trackType, regex] of Object.entries(spacePatterns)) {
    const match = baseName.match(regex);
    if (match && match[1]) {
      const songName = match[1].trim();
      return { songName, trackType };
    }
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
