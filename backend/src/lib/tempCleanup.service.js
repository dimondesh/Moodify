// backend/src/lib/tempCleanup.service.js
import fs from "fs";
import path from "path";

const cleanAllTempDirectories = () => {
  const tempDirs = [
    path.join(process.cwd(), "temp"),
    path.join(process.cwd(), "temp_hls"),
    path.join(process.cwd(), "temp_unzip_albums"),
  ];

  tempDirs.forEach((tempDir) => {
    if (fs.existsSync(tempDir)) {
      fs.readdir(tempDir, (err, files) => {
        if (err) {
          console.log(
            `[TempCleanup] Ошибка чтения директории ${tempDir}:`,
            err
          );
          return;
        }

        files.forEach((file) => {
          const filePath = path.join(tempDir, file);
          fs.stat(filePath, (err, stats) => {
            if (err) return;

            if (stats.isDirectory()) {
              fs.rm(filePath, { recursive: true, force: true }, (err) => {
                if (err) {
                  console.log(
                    `[TempCleanup] Ошибка удаления директории ${filePath}:`,
                    err
                  );
                } else {
                  console.log(`[TempCleanup] Удалена директория: ${filePath}`);
                }
              });
            } else {
              fs.unlink(filePath, (err) => {
                if (err) {
                  console.log(
                    `[TempCleanup] Ошибка удаления файла ${filePath}:`,
                    err
                  );
                } else {
                  console.log(`[TempCleanup] Удален файл: ${filePath}`);
                }
              });
            }
          });
        });
      });
    }
  });
};

export { cleanAllTempDirectories };
