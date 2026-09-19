// backend/src/lib/media/tempCleanup.service.js
import fs from "fs";
import path from "path";
import { isUploadInProgress } from "./activeUploads.service.js";

/** Don't touch freshly written temp dirs even if lock is missing. */
const MIN_AGE_MS = 2 * 60 * 60 * 1000; // 2h

const cleanAllTempDirectories = () => {
  if (isUploadInProgress()) {
    console.log("[TempCleanup] Skip: upload in progress");
    return;
  }

  console.log("[TempCleanup] Cleaning temp dirs...");

  const tempDirs = [
    path.join(process.cwd(), "temp"),
    path.join(process.cwd(), "temp_hls"),
    path.join(process.cwd(), "temp_unzip_albums"),
  ];

  const now = Date.now();

  tempDirs.forEach((tempDir) => {
    if (!fs.existsSync(tempDir)) return;

    fs.readdir(tempDir, (err, files) => {
      if (err) {
        console.log(`[TempCleanup] Readdir failed ${tempDir}:`, err);
        return;
      }

      files.forEach((file) => {
        // Keep the cross-process upload lock itself
        if (file === ".upload-in-progress") return;

        const filePath = path.join(tempDir, file);

        fs.stat(filePath, (statErr, stats) => {
          if (statErr) return;

          const ageMs = now - stats.mtimeMs;
          if (ageMs < MIN_AGE_MS) {
            console.log(`[TempCleanup] Skip fresh (<2h): ${filePath}`);
            return;
          }

          if (stats.isDirectory()) {
            fs.rm(filePath, { recursive: true, force: true }, (rmErr) => {
              if (rmErr) {
                console.log(`[TempCleanup] Rm dir failed ${filePath}:`, rmErr);
              } else {
                console.log(`[TempCleanup] Removed dir: ${filePath}`);
              }
            });
          } else {
            fs.unlink(filePath, (unlinkErr) => {
              if (unlinkErr) {
                console.log(
                  `[TempCleanup] Unlink failed ${filePath}:`,
                  unlinkErr,
                );
              } else {
                console.log(`[TempCleanup] Removed file: ${filePath}`);
              }
            });
          }
        });
      });
    });
  });
};

export { cleanAllTempDirectories };
