// frontend/src/hooks/useDominantColor.ts

import { useCallback } from "react";

export const DEFAULT_DOMINANT_COLOR = "#18181b";

export function normalizeAccentHex(hex: string): string | null {
  const t = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`;
  return null;
}

/** Accent color from API (`coverAccentHex`) or app default — no client image sampling. */
export const useDominantColor = () => {
  const resolveAccentColor = useCallback(
    (coverAccentHex?: string | null): string => {
      const fromServer = coverAccentHex
        ? normalizeAccentHex(coverAccentHex)
        : null;
      return fromServer ?? DEFAULT_DOMINANT_COLOR;
    },
    [],
  );

  return { resolveAccentColor };
};
