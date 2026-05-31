// backend/src/lib/adminUploadLease.service.js
// Защита временных файлов админских загрузок от фоновой очистки (cron).
// Глобальная блокировка — пока выполняется тяжёлая операция через очередь.
// По uploadId для chunked ZIP — между чанками и финальным импортом альбома.

import path from "path";

/** @type {number} сколько активных задач через очередь (глобальный «стоп очистке») */
let globalLeaseCount = 0;

/** uploadId или спец-ключ '*' не используется; карта chunked-сессий */
/** @type {Map<string, number>} — uploadId → expiresAt (timestamp ms) */
const chunkAssemblyLeases = new Map();

/** Автоматическое снятие «забытых» сборок чанков после отсутствия активности */
const CHUNK_LEASE_TTL_MS = 6 * 60 * 60 * 1000;

export function enterGlobalUploadLease() {
  globalLeaseCount++;
  console.log(
    `[AdminUploadLease] Глобальная блокировка очистки +1 (активно: ${globalLeaseCount})`,
  );
}

export function leaveGlobalUploadLease() {
  globalLeaseCount = Math.max(0, globalLeaseCount - 1);
  console.log(
    `[AdminUploadLease] Глобальная блокировка очистки -1 (активно: ${globalLeaseCount})`,
  );
}

/**
 * Обновляет (или создаёт) защиту каталога temp/chunks/{uploadId} от удаления cron-ом.
 * Вызывать на каждый принятый чанк.
 */
export function touchChunkAssemblyLease(uploadId) {
  if (!uploadId || typeof uploadId !== "string") {
    throw new Error("uploadId обязателен для сборки chunked ZIP");
  }
  const safe = sanitizeChunkUploadId(uploadId);
  const now = Date.now();
  pruneExpiredChunkLeases(now);
  chunkAssemblyLeases.set(safe, now + CHUNK_LEASE_TTL_MS);
}

/**
 * Явно снять защиту после успешного/неуспешного завершения upload-full-album.
 */
export function releaseChunkAssemblyLease(uploadId) {
  if (!uploadId || typeof uploadId !== "string") return;
  chunkAssemblyLeases.delete(sanitizeChunkUploadId(uploadId));
}

/** Одна строка для каталога temp/chunks и ключа карты лицензий */
export function sanitizeChunkUploadId(id) {
  return path.basename(String(id)).replace(/[^\w\-]/g, "");
}

export function pruneExpiredChunkLeases(now = Date.now()) {
  for (const [uploadId, expiresAt] of chunkAssemblyLeases) {
    if (expiresAt < now) {
      chunkAssemblyLeases.delete(uploadId);
    }
  }
}

/** Блокировать всю временную очистку (глобально) */
export function isGlobalTempCleanupBlocked() {
  pruneExpiredChunkLeases();
  return globalLeaseCount > 0;
}

/**
 * Путь под защитой chunked-сессии (абсолютный путь внутри temp/chunks/…)
 */
export function isPathUnderChunkAssemblyLease(absPathNormalized) {
  pruneExpiredChunkLeases();
  const chunksRoot = path.join(process.cwd(), "temp", "chunks");
  let rel = null;
  try {
    rel = path.relative(chunksRoot, absPathNormalized);
  } catch {
    return false;
  }
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  const first = rel.split(path.sep)[0];
  if (!first) return false;
  const exp = chunkAssemblyLeases.get(first);
  return typeof exp === "number" && exp >= Date.now();
}

export function getChunkAssemblyLeaseStats() {
  pruneExpiredChunkLeases();
  return {
    sessions: chunkAssemblyLeases.size,
    uploadIds: [...chunkAssemblyLeases.keys()],
  };
}

export function getGlobalLeaseStats() {
  return { activeCount: globalLeaseCount };
}
