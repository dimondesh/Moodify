// frontend/src/hooks/useDominantColor.ts

import { useCallback } from "react";

export const DEFAULT_DOMINANT_COLOR = "#18181b";

function normalizeAccentHex(hex: string): string | null {
  const t = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`;
  return null;
}


export const useDominantColor = () => {
  const extractColor = useCallback(
    async (
      _imageUrl: string | null | undefined,
      coverAccentHex?: string | null,
    ): Promise<string> => {
      const fromServer = coverAccentHex
        ? normalizeAccentHex(coverAccentHex)
        : null;
      if (fromServer) return fromServer;
      return DEFAULT_DOMINANT_COLOR;
    },
    [],
  );

  return { extractColor };
};
