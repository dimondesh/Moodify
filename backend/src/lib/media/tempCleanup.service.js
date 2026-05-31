// backend/src/lib/tempCleanup.service.js
import fs from "fs";
import path from "path";
import {
  isGlobalTempCleanupBlocked,
  isPathUnderChunkAssemblyLease,
} from "./adminUploadLease.service.js";

const CHUNKS_ROOT = () => path.join(process.cwd(), "temp", "chunks");

function cleanChunkSessionsOnly(chunksRoot) {
  if (!fs.existsSync(chunksRoot)) return;
  fs.readdir(chunksRoot, (err, uploadDirs) => {
    if (err) {
      console.log(`[TempCleanup] Ошибка чтения ${chunksRoot}:`, err);
      return;
    }
    for (const uid of uploadDirs) {
      const sessionPath = path.join(chunksRoot, uid);
      if (!shouldCleanPath(sessionPath)) {
        console.log(`[TempCleanup] Сохраняем chunked-сессию: ${sessionPath}`);
        continue;
      }
      fs.rm(sessionPath, { recursive: true, force: true }, (rmErr) => {
        if (rmErr) {
          console.log(
            `[TempCleanup] Ошибка удаления сессии чанков ${sessionPath}:`,
            rmErr,
          );
        } else {
          console.log(`[TempCleanup] Удалена chunked-сессия: ${sessionPath}`);
        }
      });
    }
  });
}

function shouldCleanPath(absPath) {
  const normalized = path.resolve(absPath);
  if (isPathUnderChunkAssemblyLease(normalized)) {
    console.log(`[TempCleanup] Пропуск (активная chunked-сессия): ${normalized}`);
    return false;
  }
  return true;
}

const cleanDirectoryContents = (tempDir) => {
  if (!fs.existsSync(tempDir)) return;

  fs.readdir(tempDir, (err, files) => {
    if (err) {
      console.log(`[TempCleanup] Ошибка чтения ${tempDir}:`, err);
      return;
    }

    for (const file of files) {
      const filePath = path.join(tempDir, file);

      fs.stat(filePath, (err, stats) => {
        if (err) return;

        if (
          stats.isDirectory() &&
          path.resolve(filePath) === path.resolve(CHUNKS_ROOT())
        ) {
          cleanChunkSessionsOnly(filePath);
          return;
        }

        if (!shouldCleanPath(filePath)) return;

        if (stats.isDirectory()) {
          fs.rm(filePath, { recursive: true, force: true }, (rmErr) => {
            if (rmErr) {
              console.log(
                `[TempCleanup] Ошибка удаления директории ${filePath}:`,
                rmErr,
              );
            } else {
              console.log(`[TempCleanup] Удалена директория: ${filePath}`);
            }
          });
        } else {
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
              console.log(
                `[TempCleanup] Ошибка удаления файла ${filePath}:`,
                unlinkErr,
              );
            } else {
              console.log(`[TempCleanup] Удалён файл: ${filePath}`);
            }
          });
        }
      });
    }
  });
};

const cleanAllTempDirectories = () => {
  if (isGlobalTempCleanupBlocked()) {
    console.log(
      "[TempCleanup] Пропуск — выполняется админская загрузка через очередь",
    );
    return;
  }

  console.log("[TempCleanup] Очистка временных директорий…");

  const tempDirs = [
    path.join(process.cwd(), "temp"),
    path.join(process.cwd(), "temp_hls"),
    path.join(process.cwd(), "temp_unzip_albums"),
  ];

  for (const tempDir of tempDirs) {
    cleanDirectoryContents(tempDir);
  }
};

export { cleanAllTempDirectories };
