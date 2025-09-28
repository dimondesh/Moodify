// backend/src/lib/activeUploads.service.js
import fs from "fs";
import path from "path";

// Map для отслеживания активных загрузок
// Ключ: userId, Значение: Set с путями к временным папкам
const activeUploads = new Map();

// Map для отслеживания временных папок, используемых в загрузках
// Ключ: путь к папке, Значение: { userId, startTime, type }
const tempDirectoriesInUse = new Map();

/**
 * Регистрирует активную загрузку для пользователя
 * @param {string} userId - ID пользователя
 * @param {string} tempDirPath - Путь к временной папке
 * @param {string} type - Тип загрузки (album, song, etc.)
 */
export const registerActiveUpload = (userId, tempDirPath, type = "unknown") => {
  console.log(
    `[ActiveUploads] Регистрация активной загрузки: пользователь ${userId}, папка ${tempDirPath}, тип ${type}`
  );

  // Добавляем в активные загрузки пользователя
  if (!activeUploads.has(userId)) {
    activeUploads.set(userId, new Set());
  }
  activeUploads.get(userId).add(tempDirPath);

  // Регистрируем папку как используемую
  tempDirectoriesInUse.set(tempDirPath, {
    userId,
    startTime: Date.now(),
    type,
  });
};

/**
 * Отменяет регистрацию активной загрузки
 * @param {string} userId - ID пользователя
 * @param {string} tempDirPath - Путь к временной папке
 */
export const unregisterActiveUpload = (userId, tempDirPath) => {
  console.log(
    `[ActiveUploads] Отмена регистрации загрузки: пользователь ${userId}, папка ${tempDirPath}`
  );

  // Удаляем из активных загрузок пользователя
  if (activeUploads.has(userId)) {
    activeUploads.get(userId).delete(tempDirPath);
    if (activeUploads.get(userId).size === 0) {
      activeUploads.delete(userId);
    }
  }

  // Удаляем из используемых папок
  tempDirectoriesInUse.delete(tempDirPath);
};

/**
 * Отменяет все активные загрузки пользователя
 * @param {string} userId - ID пользователя
 */
export const unregisterAllUserUploads = (userId) => {
  console.log(`[ActiveUploads] Отмена всех загрузок пользователя: ${userId}`);

  if (activeUploads.has(userId)) {
    const userUploads = activeUploads.get(userId);
    for (const tempDirPath of userUploads) {
      tempDirectoriesInUse.delete(tempDirPath);
    }
    activeUploads.delete(userId);
  }
};

/**
 * Проверяет, используется ли папка в активных загрузках
 * @param {string} tempDirPath - Путь к временной папке
 * @returns {boolean} - true если папка используется
 */
export const isDirectoryInUse = (tempDirPath) => {
  return tempDirectoriesInUse.has(tempDirPath);
};

/**
 * Проверяет, есть ли активные загрузки у пользователя
 * @param {string} userId - ID пользователя
 * @returns {boolean} - true если есть активные загрузки
 */
export const hasActiveUploads = (userId) => {
  return activeUploads.has(userId) && activeUploads.get(userId).size > 0;
};

/**
 * Получает все активные загрузки
 * @returns {Map} - Map с активными загрузками
 */
export const getAllActiveUploads = () => {
  return new Map(activeUploads);
};

/**
 * Получает все используемые временные папки
 * @returns {Map} - Map с используемыми папками
 */
export const getUsedTempDirectories = () => {
  return new Map(tempDirectoriesInUse);
};

/**
 * Очищает устаревшие записи (старше 1 часа)
 */
export const cleanupStaleUploads = () => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const staleDirs = [];

  for (const [dirPath, info] of tempDirectoriesInUse) {
    if (info.startTime < oneHourAgo) {
      staleDirs.push(dirPath);
    }
  }

  for (const dirPath of staleDirs) {
    const info = tempDirectoriesInUse.get(dirPath);
    if (info) {
      unregisterActiveUpload(info.userId, dirPath);
      console.log(
        `[ActiveUploads] Удалена устаревшая запись: ${dirPath} (пользователь ${info.userId})`
      );
    }
  }

  return staleDirs.length;
};

/**
 * Проверяет, есть ли какие-либо активные загрузки
 * @returns {boolean} - true если есть активные загрузки
 */
export const hasAnyActiveUploads = () => {
  return tempDirectoriesInUse.size > 0;
};

/**
 * Получает статистику активных загрузок
 * @returns {Object} - Статистика загрузок
 */
export const getUploadStats = () => {
  return {
    totalActiveUsers: activeUploads.size,
    totalActiveUploads: tempDirectoriesInUse.size,
    activeUsers: Array.from(activeUploads.keys()),
    usedDirectories: Array.from(tempDirectoriesInUse.keys()),
  };
};
