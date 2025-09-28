// backend/src/lib/activeUploads.service.js
// Простой глобальный флаг для блокировки очистки временных папок
let uploadInProgress = false;

/**
 * Устанавливает флаг активной загрузки
 */
export const setUploadInProgress = () => {
  uploadInProgress = true;
  console.log(
    "[ActiveUploads] Флаг загрузки установлен - очистка заблокирована"
  );
};

/**
 * Снимает флаг активной загрузки
 */
export const clearUploadInProgress = () => {
  uploadInProgress = false;
  console.log("[ActiveUploads] Флаг загрузки снят - очистка разрешена");
};

/**
 * Проверяет, идет ли загрузка
 * @returns {boolean} - true если идет загрузка
 */
export const isUploadInProgress = () => {
  return uploadInProgress;
};
