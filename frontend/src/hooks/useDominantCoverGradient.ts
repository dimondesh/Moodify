import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface CoverGradientLayer {
  key: number;
  color: string;
}

const DEFAULT_COLOR = "#18181b";

function validAccentHex(hex: string): string | null {
  const t = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`;
  return null;
}

/** Фон страницы альбома / плейлиста: только `coverAccentHex` с API или дефолт. */
export function useDominantCoverGradient(
  imageUrl: string | null | undefined,
  entityKey: string | null | undefined,
  coverAccentHex?: string | null,
) {
  const [isColorLoading, setIsColorLoading] = useState(true);
  const backgroundKeyRef = useRef(0);
  const [backgrounds, setBackgrounds] = useState<CoverGradientLayer[]>([
    { key: 0, color: DEFAULT_COLOR },
  ]);

  useLayoutEffect(() => {
    setIsColorLoading(false);
  }, [imageUrl, coverAccentHex, entityKey]);

  useEffect(() => {
    const updateBackgroundColor = (color: string) => {
      backgroundKeyRef.current += 1;
      const newKey = backgroundKeyRef.current;
      setBackgrounds([{ key: newKey, color }]);
    };

    const validHex = coverAccentHex ? validAccentHex(coverAccentHex) : null;
    if (validHex) {
      updateBackgroundColor(validHex);
      return;
    }

    if (imageUrl || entityKey) {
      updateBackgroundColor(DEFAULT_COLOR);
    }
  }, [imageUrl, entityKey, coverAccentHex]);

  return { backgrounds, isColorLoading };
}
