// Exclusive upload lock shared with cron via lock file.
import fs from "fs";
import path from "path";

const LOCK_PATH = path.join(process.cwd(), "temp", ".upload-in-progress");
// Heartbeat keeps mtime fresh while a job runs; after crash, ~15m is enough.
const STALE_LOCK_MS = 15 * 60 * 1000;

/** In-process nesting (outer acquire + ingest retain, etc.) */
let lockDepth = 0;

const ensureLockDir = () => {
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
};

/** Rewrite lock contents / mtime while held (cron + stale detection). */
export const touchUploadLock = () => {
  if (lockDepth <= 0) return;
  try {
    ensureLockDir();
    fs.writeFileSync(LOCK_PATH, `${Date.now()}\n`, "utf8");
  } catch (err) {
    console.error("[ActiveUploads] Failed to touch lock:", err.message);
  }
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

/** Atomic create; returns false if another holder exists. */
const tryCreateLockFile = () => {
  ensureLockDir();
  try {
    fs.writeFileSync(LOCK_PATH, `${Date.now()}\n`, { flag: "wx" });
    return true;
  } catch (err) {
    if (err.code !== "EEXIST") {
      console.error("[ActiveUploads] Lock create failed:", err.message);
      return false;
    }
    // Race loser, or leftover — drop only if stale, then one retry.
    if (hasFreshLockFile()) return false;
    try {
      fs.writeFileSync(LOCK_PATH, `${Date.now()}\n`, { flag: "wx" });
      return true;
    } catch (retryErr) {
      if (retryErr.code !== "EEXIST") {
        console.error("[ActiveUploads] Lock retry failed:", retryErr.message);
      }
      return false;
    }
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
  if (lockDepth > 0) {
    console.log("[ActiveUploads] Lock busy");
    return false;
  }
  if (!tryCreateLockFile()) {
    console.log("[ActiveUploads] Lock busy");
    return false;
  }
  lockDepth = 1;
  console.log("[ActiveUploads] Lock acquired");
  return true;
};

/** Nested retain while an outer lock is already held (e.g. ingest inside job). */
export const setUploadInProgress = () => {
  lockDepth += 1;
  touchUploadLock();
  console.log(`[ActiveUploads] Lock retain (depth=${lockDepth})`);
};

export const clearUploadInProgress = () => {
  lockDepth = Math.max(0, lockDepth - 1);
  if (lockDepth === 0) {
    removeLockFile();
    console.log("[ActiveUploads] Lock released");
  } else {
    console.log(`[ActiveUploads] Lock release (depth=${lockDepth})`);
  }
};

/**
 * After API process boot there is no live upload in this process — drop leftover
 * lock file so cron/temp cleanup and new uploads are not blocked for STALE_LOCK_MS.
 */
export const resetUploadLockOnBoot = () => {
  lockDepth = 0;
  removeLockFile();
  console.log("[ActiveUploads] Lock cleared on boot");
};

export const uploadBusyError = () => {
  const err = new Error(
    "Another upload is already in progress. Try again when it finishes.",
  );
  err.statusCode = 409;
  return err;
};
