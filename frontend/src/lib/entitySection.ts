import type { TFunction } from "i18next";
import type {
  Artist,
  Album,
  DisplayItem,
  Playlist,
  Song,
  UserSectionItem,
} from "@/types";
import { getArtistNames, normalizeAlbumKind } from "@/lib/utils";

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

export function getDisplayTitle(item: DisplayItem): string {
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
        return `${t("sidebar.subtitle.playlist")} • Moodify`;
      }
      return t("sidebar.subtitle.byUser", {
        name: playlist.owner?.fullName || t("sidebar.subtitle.user"),
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
