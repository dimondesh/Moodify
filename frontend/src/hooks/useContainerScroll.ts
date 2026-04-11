import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Глобальное хранилище позиций скролла для каждого URL
const scrollMap = new Map<string, number>();

export function useContainerScroll() {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  // 1. Сохраняем позицию при каждом скролле
  // Используем debounce (задержку 100мс), чтобы не нагружать браузер частыми вызовами
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (ref.current) {
          scrollMap.set(location.pathname, ref.current.scrollTop);
        }
      }, 100);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, [location.pathname]);

  // 2. Восстанавливаем позицию при возврате
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const savedPos = scrollMap.get(location.pathname) || 0;

    // Попытка 1: Сразу пытаемся восстановить (сработает для статических страниц)
    el.scrollTop = savedPos;

    // Попытка 2: Для асинхронных страниц (где контент подгружается)
    // Ждем, пока высота контейнера станет достаточной для скролла
    const observer = new MutationObserver(() => {
      if (el.scrollHeight >= savedPos) {
        el.scrollTop = savedPos;

        // Как только скролл успешно применился, отключаем наблюдатель
        if (el.scrollTop === savedPos) {
          observer.disconnect();
        }
      }
    });

    observer.observe(el, { childList: true, subtree: true });

    // Жестко отключаем слежку через 500мс, чтобы не мешать пользователю,
    // если он сам начнет скроллить до того, как данные загрузятся полностью
    const timeoutId = setTimeout(() => {
      observer.disconnect();
    }, 500);

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [location.pathname]);

  return ref;
}
