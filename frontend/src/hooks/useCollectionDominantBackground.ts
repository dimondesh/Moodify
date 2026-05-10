import { useEffect, useRef, useState } from "react";
import { useDominantColor } from "@/hooks/useDominantColor";

export interface BackgroundLayer {
  key: number;
  color: string;
}

const DEFAULT_COLOR = "#18181b";

export function useCollectionDominantBackground(
  imageUrl: string | null | undefined,
  entityKey: string | null | undefined,
) {
  const { extractColor } = useDominantColor();
  const [isColorLoading, setIsColorLoading] = useState(true);
  const backgroundKeyRef = useRef(0);
  const [backgrounds, setBackgrounds] = useState<BackgroundLayer[]>([
    { key: 0, color: DEFAULT_COLOR },
  ]);

  useEffect(() => {
    const updateBackgroundColor = (color: string) => {
      backgroundKeyRef.current += 1;
      const newKey = backgroundKeyRef.current;
      setBackgrounds((prev) => [{ key: newKey, color }, ...prev.slice(0, 1)]);
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
