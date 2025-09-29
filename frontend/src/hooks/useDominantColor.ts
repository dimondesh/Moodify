// frontend/src/hooks/useDominantColor.ts

import { useCallback } from "react";
import { FastAverageColor } from "fast-average-color";
import { axiosInstance } from "@/lib/axios";
import { useOfflineStore } from "@/stores/useOfflineStore";

const fac = new FastAverageColor();

// Глобальный кэш для цветов
const colorCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

export const useDominantColor = () => {
  const extractColor = useCallback(
    async (imageUrl: string | null | undefined): Promise<string> => {
      if (!imageUrl) {
        return "#18181b";
      }

      // Проверяем кэш
      if (colorCache.has(imageUrl)) {
        return colorCache.get(imageUrl)!;
      }

      if (useOfflineStore.getState().isOffline) {
        console.log("[Offline] Skipping dominant color extraction.");
        return "#18181b";
      }

      const fallbackColor = "#18181b";

      try {
        const proxyUrl = `/songs/image-proxy?url=${encodeURIComponent(
          imageUrl
        )}`;
        const response = await axiosInstance.get(proxyUrl, {
          responseType: "blob",
        });

        const imageBlob = response.data;
        const objectUrl = URL.createObjectURL(imageBlob);

        try {
          const imageElement = await new Promise<HTMLImageElement>(
            (resolve, reject) => {
              const img = new Image();
              img.crossOrigin = "Anonymous";
              img.onload = () => resolve(img);
              img.onerror = (err) => reject(err);
              img.src = objectUrl;
            }
          );
          const color = await fac.getColorAsync(imageElement);
          const hexColor = color.hex;

          // Сохраняем в кэш
          colorCache.set(imageUrl, hexColor);

          // Ограничиваем размер кэша
          if (colorCache.size > MAX_CACHE_SIZE) {
            const firstKey = colorCache.keys().next().value;
            if (firstKey) {
              colorCache.delete(firstKey);
            }
          }

          return hexColor;
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (error) {
        console.warn(`Ошибка при извлечении цвета для ${imageUrl}:`, error);
        return fallbackColor;
      }
    },
    []
  );

  return { extractColor };
};
