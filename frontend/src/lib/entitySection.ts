import type { TFunction } from "i18next";
import type {
  Artist,
  Album,
  DisplayItem,
  Hub,
  Playlist,
  Song,
  UserSectionItem,
} from "@/types";
import { getArtistNames, normalizeAlbumKind } from "@/lib/utils";
import { isGeneratedPlaylistType } from "@/lib/playlistKinds";
import i18n from "@/lib/i18n";
import { playlistOwnerLabel, SITE_NAME } from "@/lib/site-meta";

type LocalizedNames = Playlist["localizedNames"] | Hub["localizedNames"];

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

export function isPlaylistCoverOverlayItem(item: DisplayItem): boolean {
  if (item.itemType !== "playlist") return false;
  const k = (item as Playlist).type;
  return k === "GENRE_MIX" || k === "MOOD_MIX" || k === "PERSONAL_MIX";
}

export function isValidDisplayItem(item: DisplayItem): boolean {
  if (!item || !item._id || !item.itemType) return false;

  switch (item.itemType) {
    case "song":
    case "album":
    case "playlist":
      return !!(item as Song | Album | Playlist).title;
    case "artist":
      return (
        !!(item as Artist).name ||
        !!(item as Artist & { title?: string }).title
      );
    case "user":
      return !!(item as UserSectionItem).name;
    default:
      return false;
  }
}

export function getDisplayTitle(
  item: DisplayItem,
  lang?: string,
  t?: TFunction,
): string {
  if (item.itemType === "artist") {
    return (
      (item as Artist).name ||
      (item as Artist & { title?: string }).title ||
      "Unknown Artist"
    );
  }
  if (item.itemType === "user") {
    return (item as UserSectionItem).name || "Unknown";
  }
  if (item.itemType === "playlist") {
    const pl = item as Playlist;
    if (lang) {
      return getPlaylistDisplayTitle(pl, lang, t) || "Unknown Title";
    }
    return pl.title || "Unknown Title";
  }
  return item.title || "Unknown Title";
}

export function getSubtitle(
  item: DisplayItem,
  t: TFunction,
  allArtists: Artist[],
): string {
  switch (item.itemType) {
    case "song":
      return getArtistNames((item as Song).artist, allArtists);
    case "album": {
      const album = item as Album;
      const kind = normalizeAlbumKind(album.type);
      const albumArtists = album.artist
        ? getArtistNames(album.artist, allArtists)
        : t("common.unknownArtist");
      return `${t(`sidebar.subtitle.${kind}`)} • ${albumArtists}`;
    }
    case "playlist": {
      const playlist = item as Playlist;
      if (
        playlist.type === "GENRE_MIX" ||
        playlist.type === "MOOD_MIX" ||
        playlist.type === "PERSONAL_MIX"
      ) {
        if (!playlist.songs || playlist.songs.length === 0) {
          return t("sidebar.subtitle.dailyMix");
        }
        const songArtists = playlist.songs.flatMap((song) => song.artist);
        const uniqueArtists = songArtists.filter(
          (artist, index, self) =>
            index === self.findIndex((a) => a._id === artist._id),
        );
        const firstTwoUniqueArtists = uniqueArtists.slice(0, 2);
        const artistNames = getArtistNames(firstTwoUniqueArtists, allArtists);
        if (uniqueArtists.length > 2) {
          return `${artistNames} ${t("common.andMore")}`;
        }
        return artistNames;
      }
      if (
        playlist.type === "ON_REPEAT" ||
        playlist.type === "DISCOVER_WEEKLY" ||
        playlist.type === "ON_REPEAT_REWIND" ||
        playlist.type === "NEW_RELEASES"
      ) {
        return `${t("sidebar.subtitle.playlist")} • ${SITE_NAME}`;
      }
      if (playlist.owner == null) {
        return `${t("sidebar.subtitle.playlist")} • ${SITE_NAME}`;
      }
      return t("sidebar.subtitle.byUser", {
        name: playlistOwnerLabel(playlist.owner, t("sidebar.subtitle.user")),
      });
    }
    case "artist":
      return t("sidebar.subtitle.artist");
    case "user":
      return t("sidebar.subtitle.user");
    default:
      return "";
  }
}
