// frontend/src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Artist, Playlist } from "../types";
import type { TFunction } from "i18next";
import { isGeneratedPlaylistType } from "@/lib/playlistKinds";

/** Album `type` from API: Album | Single | EP */
const ALBUM_KINDS = ["Album", "Single", "EP"] as const;
export type AlbumKind = (typeof ALBUM_KINDS)[number];

export function normalizeAlbumKind(raw?: string | null): AlbumKind {
  if (raw && (ALBUM_KINDS as readonly string[]).includes(raw)) {
    return raw as AlbumKind;
  }
  return "Album";
}

export const getArtistNames = (
  artistData: (Artist | string) | (Artist | string)[] | undefined,
  allArtists: Artist[] = []
): string => {
  if (!artistData || (Array.isArray(artistData) && artistData.length === 0)) {
    return "Unknown artist";
  }

  const artistsArray = Array.isArray(artistData) ? artistData : [artistData];

  const names = artistsArray
    .map((item) => {
      if (typeof item === "object" && item !== null && "name" in item) {
        return item.name;
      }
      if (typeof item === "string" && allArtists.length > 0) {
        const foundArtist = allArtists.find((artist) => artist._id === item);
        return foundArtist ? foundArtist.name : null;
      }
      return null;
    })
    .filter(Boolean);

  return names.join(", ") || "Unknown artist";
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pickPlaylistLocalizedTitle(
  localizedNames: Playlist["localizedNames"] | undefined,
  lang: string,
  fallback = "",
): string {
  const code = lang.split("-")[0] as "en" | "ru" | "uk";
  const localized =
    localizedNames?.[code]?.trim() || localizedNames?.en?.trim();
  return localized || fallback;
}

export function getPlaylistDisplayTitle(
  playlist: Pick<Playlist, "title" | "type" | "localizedNames">,
  lang: string,
  t?: TFunction,
): string {
  if (playlist.type && isGeneratedPlaylistType(playlist.type)) {
    return pickPlaylistLocalizedTitle(
      playlist.localizedNames,
      lang,
      playlist.title,
    );
  }

  if (t && playlist.type === "LIKED_SONGS") {
    return t("sidebar.likedSongs");
  }

  return playlist.title;
}

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

type DurationTranslate = (
  key: string,
  options?: Record<string, number>,
) => string;

/** Total length for playlist headers (not per-track m:ss). */
export const formatPlaylistTotalDuration = (
  totalSeconds: number,
  t: DurationTranslate,
): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return minutes > 0
      ? t("duration.hoursMinutes", { hours, minutes })
      : t("duration.hoursOnly", { hours });
  }
  if (minutes > 0) {
    return t("duration.minutesOnly", { minutes });
  }
  return formatDuration(seconds);
};
