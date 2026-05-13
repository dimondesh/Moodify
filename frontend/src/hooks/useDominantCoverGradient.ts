import { useEffect, useRef, useState } from "react";
import { useDominantColor } from "@/hooks/useDominantColor";

export interface CoverGradientLayer {
  key: number;
  color: string;
}

const DEFAULT_COLOR = "#18181b";

/** Dominant color from cover art for album / playlist page gradients. */
export function useDominantCoverGradient(
  imageUrl: string | null | undefined,
  entityKey: string | null | undefined,
) {
  const { extractColor } = useDominantColor();
  const [isColorLoading, setIsColorLoading] = useState(true);
  const backgroundKeyRef = useRef(0);
  const [backgrounds, setBackgrounds] = useState<CoverGradientLayer[]>([
    { key: 0, color: DEFAULT_COLOR },
  ]);

  useEffect(() => {
    const updateBackgroundColor = (color: string) => {
      backgroundKeyRef.current += 1;
      const newKey = backgroundKeyRef.current;
      setBackgrounds([{ key: newKey, color }]);
    };

    if (imageUrl) {
      setIsColorLoading(true);
      extractColor(imageUrl)
        .then((color) => updateBackgroundColor(color || DEFAULT_COLOR))
        .finally(() => setIsColorLoading(false));
    } else if (entityKey) {
      updateBackgroundColor(DEFAULT_COLOR);
      setIsColorLoading(false);
    }
  }, [imageUrl, entityKey, extractColor]);

  return { backgrounds, isColorLoading };
}
