// backend/src/lib/media/activeUploads.service.js
// Exclusive upload lock shared with cron via lock file.
import fs from "fs";
import path from "path";

const LOCK_PATH = path.join(process.cwd(), "temp", ".upload-in-progress");
const STALE_LOCK_MS = 3 * 60 * 60 * 1000; // 3h — crashed job leftover

/** In-process nesting (outer acquire + ingest retain, etc.) */
let lockDepth = 0;

const writeLockFile = () => {
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
  fs.writeFileSync(LOCK_PATH, `${Date.now()}\n`, "utf8");
};

const removeLockFile = () => {
  try {
    fs.unlinkSync(LOCK_PATH);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[ActiveUploads] Failed to remove lock file:", err.message);
    }
  }
};

const hasFreshLockFile = () => {
  try {
    const stat = fs.statSync(LOCK_PATH);
    if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
      console.warn(
        "[ActiveUploads] Stale upload lock found — treating as idle",
      );
      removeLockFile();
      return false;
    }
    return true;
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[ActiveUploads] Lock check failed:", err.message);
    }
    return false;
  }
};

export const isUploadInProgress = () => {
  if (lockDepth > 0) return true;
  return hasFreshLockFile();
};

/**
 * Exclusive acquire for a top-level upload (song/ZIP/URL job).
 * @returns {boolean} false if another upload already holds the lock
 */
export const tryAcquireUploadLock = () => {
  if (lockDepth > 0 || hasFreshLockFile()) {
    console.log("[ActiveUploads] Upload lock busy — reject concurrent upload");
    return false;
  }
  lockDepth = 1;
  writeLockFile();
  console.log("[ActiveUploads] Upload lock acquired (exclusive)");
  return true;
};

/** Nested retain while an outer lock is already held (e.g. ingest inside job). */
export const setUploadInProgress = () => {
  lockDepth += 1;
  writeLockFile();
  console.log(
    `[ActiveUploads] Upload lock retained (depth=${lockDepth}) — cleanup blocked`,
  );
};

export const clearUploadInProgress = () => {
  lockDepth = Math.max(0, lockDepth - 1);
  if (lockDepth === 0) {
    removeLockFile();
    console.log("[ActiveUploads] Upload lock released — cleanup allowed");
  } else {
    console.log(
      `[ActiveUploads] Upload lock nested release (depth=${lockDepth})`,
    );
  }
};

export const uploadBusyError = () => {
  const err = new Error(
    "Another upload is already in progress. Try again when it finishes.",
  );
  err.statusCode = 409;
  return err;
};
