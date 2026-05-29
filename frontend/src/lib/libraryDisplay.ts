import type { TFunction } from "i18next";
import {
  CDN_DEFAULT_ALBUM_COVER,
  CDN_DEFAULT_ARTIST_IMAGE,
  CDN_LIKED_PLAYLIST_COVER,
} from "@/lib/cdn";
import { getArtistNames, normalizeAlbumKind } from "@/lib/utils";
import type {
  AlbumItem,
  Artist,
  FollowedArtistItem,
  LibraryItem,
  Playlist,
  PlaylistItem,
} from "@/types";

export interface LibraryItemDisplay {
  linkPath: string;
  subtitle: string;
  coverDefault: string;
  imageClass: string;
}

export interface LibraryItemDisplayContext {
  t: TFunction;
  artists: Artist[];
  myPlaylists: Playlist[];
}

export function getLibraryItemDisplay(
  item: LibraryItem,
  { t, artists, myPlaylists }: LibraryItemDisplayContext,
): LibraryItemDisplay {
  const unknownArtist = t("common.unknownArtist");
  let linkPath = "#";
  let subtitle = "";
  let coverDefault = CDN_DEFAULT_ALBUM_COVER;
  let imageClass = "rounded-md";

  switch (item.type) {
    case "album": {
      const albumItem = item as AlbumItem;
      linkPath = `/albums/${albumItem._id}`;
      const artistNames = resolveArtistNames(albumItem.artist, artists, unknownArtist);
      subtitle = `${t(`sidebar.subtitle.${normalizeAlbumKind(albumItem.albumType)}`)} • ${artistNames}`;
      break;
    }
    case "playlist": {
      const playlistItem = item as PlaylistItem;
      linkPath = `/playlists/${playlistItem._id}`;
      if (playlistItem.playlistKind === "LIKED_SONGS") {
        const likedPl = myPlaylists.find((p) => p._id === playlistItem._id);
        const count = likedPl?.songs?.length ?? 0;
        subtitle = `${t("sidebar.subtitle.playlist")} • ${count} ${
          count !== 1
            ? t("sidebar.subtitle.songs")
            : t("sidebar.subtitle.song")
        }`;
        coverDefault = CDN_LIKED_PLAYLIST_COVER;
      } else {
        subtitle = `${t("sidebar.subtitle.playlist")} • ${
          playlistItem.owner?.fullName || unknownArtist
        }`;
      }
      break;
    }
    case "artist": {
      const artistItem = item as FollowedArtistItem;
      linkPath = `/artists/${artistItem._id}`;
      subtitle = t("sidebar.subtitle.artist");
      coverDefault = CDN_DEFAULT_ARTIST_IMAGE;
      imageClass = "rounded-full";
      break;
    }
  }

  return { linkPath, subtitle, coverDefault, imageClass };
}

function resolveArtistNames(
  artistsInput: (string | Artist)[] | undefined,
  artists: Artist[],
  unknownArtistLabel: string,
): string {
  if (!artistsInput || artistsInput.length === 0) {
    return unknownArtistLabel;
  }

  const names = getArtistNames(artistsInput, artists);
  return names === "Unknown artist" ? unknownArtistLabel : names;
}
