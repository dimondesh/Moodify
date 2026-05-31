// frontend/src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Artist, Playlist } from "../types";
import type { Hub } from "../types";
import type { TFunction } from "i18next";
import { isGeneratedPlaylistType } from "@/lib/playlistKinds";
import i18n from "@/lib/i18n";

type LocalizedNames = Playlist["localizedNames"] | Hub["localizedNames"];

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
  localizedNames: LocalizedNames | undefined,
  lang: string,
  fallback = "",
): string {
  const code = lang.split("-")[0] as "en" | "ru" | "uk";
  const localized =
    localizedNames?.[code]?.trim() || localizedNames?.en?.trim();
  return localized || fallback;
}

function mixSuffixForLang(lang: string, t?: TFunction): string {
  const lng = lang.split("-")[0];
  return t
    ? String(t("genreMoodMix.suffix", { lng }))
    : String(i18n.t("genreMoodMix.suffix", { lng }));
}

/** Strips trailing mix suffix (from i18n) — e.g. "Рок Микс" → "Рок". */
function stripGenreMoodMixSuffix(
  title: string,
  lang: string,
  t?: TFunction,
): string {
  const suffix = mixSuffixForLang(lang, t);
  if (!suffix || suffix === "genreMoodMix.suffix") {
    return title.trim();
  }
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return title.replace(new RegExp(`\\s+${escaped}\\s*$`, "iu"), "").trim();
}

function formatGenreMoodMixTitle(
  name: string,
  lang: string,
  t?: TFunction,
): string {
  const lng = lang.split("-")[0];
  return t
    ? String(t("genreMoodMix.title", { name, lng }))
    : String(i18n.t("genreMoodMix.title", { name, lng }));
}

/** Genre/mood label without mix suffix (for hubs and as base for mix playlists). */
function getCategoryBaseName(
  localizedNames: LocalizedNames | undefined,
  lang: string,
  fallback: string,
  t?: TFunction,
): string {
  const stored = pickPlaylistLocalizedTitle(localizedNames, lang, fallback);
  const stripped = stripGenreMoodMixSuffix(stored, lang, t);
  return stripped || fallback.trim();
}

export function getPlaylistDisplayTitle(
  playlist: Pick<
    Playlist,
    "title" | "type" | "localizedNames" | "sourceName"
  >,
  lang: string,
  t?: TFunction,
): string {
  if (playlist.type === "GENRE_MIX" || playlist.type === "MOOD_MIX") {
    const fallback =
      lang.split("-")[0] === "en"
        ? (playlist.sourceName?.trim() || playlist.title?.trim() || "")
        : "";
    const base = getCategoryBaseName(
      playlist.localizedNames,
      lang,
      fallback,
      t,
    );
    if (base) {
      return formatGenreMoodMixTitle(base, lang, t);
    }
  }

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

export function getHubDisplayName(
  hub: Pick<Hub, "name" | "localizedNames">,
  lang: string,
  t?: TFunction,
): string {
  return getCategoryBaseName(hub.localizedNames, lang, hub.name, t);
}

/** Описания сгенерированных плейлистов — только из i18n (в БД `description` пустой). */
export function getPlaylistDisplayDescription(
  playlist: Pick<Playlist, "type" | "description">,
  t: TFunction,
): string {
  if (!playlist.type) {
    return playlist.description?.trim() || "";
  }

  switch (playlist.type) {
    case "LIKED_SONGS":
      return t("pages.likedSongs.systemDescription");
    case "ON_REPEAT":
      return t("generatedPlaylists.onRepeat.description");
    case "DISCOVER_WEEKLY":
      return t("generatedPlaylists.discoverWeekly.description");
    case "ON_REPEAT_REWIND":
      return t("generatedPlaylists.onRepeatRewind.description");
    case "PERSONAL_MIX":
      return t("personalMix.desc");
    case "GENRE_MIX":
    case "MOOD_MIX":
    case "NEW_RELEASES":
      return "";
    default:
      return playlist.description?.trim() || "";
  }
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
