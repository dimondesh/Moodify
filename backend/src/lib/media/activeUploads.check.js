/**
 * Self-check: atomic upload lock (O_EXCL) — two acquires cannot both win.
 * Run: node src/lib/media/activeUploads.check.js
 */
import fs from "fs";
import path from "path";
import {
  tryAcquireUploadLock,
  clearUploadInProgress,
  resetUploadLockOnBoot,
} from "./activeUploads.service.js";

const LOCK_PATH = path.join(process.cwd(), "temp", ".upload-in-progress");

resetUploadLockOnBoot();

const a = tryAcquireUploadLock();
const b = tryAcquireUploadLock();

if (!a) {
  console.error("FAIL: first acquire should succeed");
  process.exit(1);
}
if (b) {
  console.error("FAIL: second acquire must lose (atomic wx)");
  process.exit(1);
}

clearUploadInProgress();
if (fs.existsSync(LOCK_PATH)) {
  console.error("FAIL: lock file should be gone after clear");
  process.exit(1);
}

const c = tryAcquireUploadLock();
if (!c) {
  console.error("FAIL: acquire after clear should succeed");
  process.exit(1);
}
clearUploadInProgress();

console.log("OK: activeUploads atomic lock");
