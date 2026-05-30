import type { TFunction } from "i18next";
import {
  CDN_LIKED_PLAYLIST_COVER,
} from "@/lib/cdn";
import { buildStaticCdnImages } from "@/lib/imageUrl";
import { getArtistNames, getPlaylistDisplayTitle } from "@/lib/utils";
import type {
  Album,
  AlbumItem,
  Artist,
  FollowedArtistItem,
  LibraryItem,
  LibraryPlaylist,
  Playlist,
  PlaylistItem,
} from "@/types";

export type EntityTypeFilter = "playlists" | "albums" | "artists" | "downloaded";

export interface BuildLibraryItemsInput {
  albums: Album[];
  myPlaylists: Playlist[];
  playlists: LibraryPlaylist[];
  followedArtists: Artist[];
  t: TFunction;
  lang: string;
}

export function buildLibraryItems({
  albums,
  myPlaylists,
  playlists,
  followedArtists,
  t,
  lang,
}: BuildLibraryItemsInput): LibraryItem[] {
  const libraryItemsMap = new Map<string, LibraryItem>();

  (albums || []).forEach((album) =>
    libraryItemsMap.set(album._id, {
      _id: album._id,
      type: "album",
      title: album.title,
      images: album.images,
      createdAt: new Date(album.addedAt ?? new Date()),
      artist: album.artist,
      albumType: album.type,
    } as AlbumItem),
  );

  [...(myPlaylists || []), ...(playlists || [])].forEach((playlist) => {
    if (!libraryItemsMap.has(playlist._id)) {
      libraryItemsMap.set(playlist._id, {
        _id: playlist._id,
        type: "playlist",
        title:
          playlist.type === "LIKED_SONGS"
            ? t("sidebar.likedSongs")
            : getPlaylistDisplayTitle(playlist, lang, t),
        images:
          playlist.images?.length
            ? playlist.images
            : playlist.type === "LIKED_SONGS"
              ? buildStaticCdnImages(CDN_LIKED_PLAYLIST_COVER)
              : undefined,
        createdAt: new Date(
          (playlist as { addedAt?: string }).addedAt ||
            playlist.updatedAt ||
            new Date(),
        ),
        owner: playlist.owner ?? null,
        playlistKind: playlist.type,
      } as PlaylistItem);
    }
  });

  (followedArtists || []).forEach((artist) =>
    libraryItemsMap.set(artist._id, {
      _id: artist._id,
      type: "artist",
      title: artist.name,
      images: artist.images,
      createdAt: new Date(artist.addedAt || artist.createdAt),
      artistId: artist._id,
    } as FollowedArtistItem),
  );

  return Array.from(libraryItemsMap.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export function transformDownloadedItems(
  items: (Album | Playlist)[],
  t: TFunction,
  lang: string,
): LibraryItem[] {
  const downloadedLibraryItemsMap = new Map<string, LibraryItem>();

  items.forEach((item) => {
    const raw = item as unknown as Record<string, unknown>;
    if (
      Array.isArray(raw.artist) &&
      raw.releaseYear !== undefined &&
      raw.title
    ) {
      downloadedLibraryItemsMap.set(item._id, {
        _id: item._id,
        type: "album",
        title: (item as Album).title,
        images: (item as Album).images,
        createdAt: new Date((item as Album).updatedAt),
        artist: (item as Album).artist,
        albumType: (item as Album).type,
      } as AlbumItem);
      return;
    }

    const playlist = item as Playlist;
    const title = getPlaylistDisplayTitle(playlist, lang, t);

    downloadedLibraryItemsMap.set(item._id, {
      _id: item._id,
      type: "playlist",
      title,
      images: item.images,
      createdAt: new Date(
        (raw.updatedAt as string) ||
          (raw.generatedOn as string) ||
          (raw.addedAt as string) ||
          Date.now(),
      ),
      owner: (raw.owner as Playlist["owner"]) ?? null,
      playlistKind: raw.type as Playlist["type"],
    } as PlaylistItem);
  });

  return Array.from(downloadedLibraryItemsMap.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export interface FilterLibraryItemsInput {
  libraryItems: LibraryItem[];
  downloadedItems: LibraryItem[];
  entityTypeFilter: EntityTypeFilter | null;
  librarySearchQuery: string;
  artists: Artist[];
  unknownArtistLabel: string;
}

export function filterLibraryItems({
  libraryItems,
  downloadedItems,
  entityTypeFilter,
  librarySearchQuery,
  artists,
  unknownArtistLabel,
}: FilterLibraryItemsInput): LibraryItem[] {
  let filtered = libraryItems;

  if (entityTypeFilter) {
    switch (entityTypeFilter) {
      case "playlists":
        filtered = filtered.filter((item) => item.type === "playlist");
        break;
      case "albums":
        filtered = filtered.filter((item) => item.type === "album");
        break;
      case "artists":
        filtered = filtered.filter((item) => item.type === "artist");
        break;
      case "downloaded":
        filtered = downloadedItems;
        break;
      default:
        break;
    }
  }

  if (librarySearchQuery.trim()) {
    const query = librarySearchQuery.toLowerCase().trim();
    filtered = filtered.filter((item) => {
      const title = item.title.toLowerCase();
      const artistNames =
        item.type === "album"
          ? resolveArtistNames((item as AlbumItem).artist, artists, unknownArtistLabel)
          : unknownArtistLabel;
      const subtitle = artistNames.toLowerCase();

      return title.includes(query) || subtitle.includes(query);
    });
  }

  return filtered;
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
