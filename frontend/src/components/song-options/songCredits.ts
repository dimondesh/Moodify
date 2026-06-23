import type { Song } from "@/types";

export function songHasCredits(song: Song): boolean {
  return Boolean(
    song.licenseCcUrl ||
      song.sourceShareUrl ||
      song.sourceProvider === "jamendo",
  );
}

export function formatLicenseLabel(licenseCcUrl?: string | null): string | null {
  if (!licenseCcUrl) return null;
  const match = licenseCcUrl.match(/licenses\/([^/]+)\//);
  if (!match) return "Creative Commons";
  return `CC ${match[1].toUpperCase().replace(/-/g, " ")}`;
}
