export interface Artist {
  _id: string;
  name: string;
  bio?: string;
  imageUrl: string;
  songs: Song[];
  albums: Album[];
  addedAt?: string;
  bannerUrl?: string;

  createdAt: string;
  updatedAt: string;
}
export interface Genre {
  _id: string;
  name: string;
}

export interface Mood {
  _id: string;
  name: string;
}
export interface Song {
  _id: string;
  title: string;
  artist: Artist[];
  albumId: string | null;
  imageUrl: string;
  hlsUrl?: string;
  canvasUrl?: string;
  duration: number;
  playCount: number;
  coverAccentHex?: string | null;
  genres?: Genre[];
  moods?: Mood[];
  createdAt: string;
  updatedAt: string;
  albumTitle?: string;
  likedAt?: string;
  addedAt?: string;
  lyrics?: string;
}

export interface RecentSearchItem {
  _id: string;
  searchId: string;
  itemType: "Artist" | "Album" | "Playlist" | "User" | "Song";

  name?: string;
  title?: string;
  imageUrl: string;

  artist?: Artist[];
  owner?: User;

  albumId?: string | null;
}

export interface Album {
  _id: string;
  title: string;
  artist: Artist[];
  imageUrl: string;
  releaseYear: number;
  songs: Song[];
  type: string;
  createdAt: string;
  updatedAt: string;
  addedAt?: string;
  coverAccentHex?: string | null;
}

export interface Stats {
  totalSongs: number;
  totalAlbums: number;
  totalUsers: number;
  totalArtists: number;
}

export interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  type: "text" | "share";
  isRead: boolean;

  shareDetails?: {
    entityType: "song" | "album" | "playlist";
    entityId: string;
  };
}

export interface User {
  _id: string;
  fullName: string;
  imageUrl: string;
  email: string;
  isAdmin?: boolean;
  playlists?: Playlist[];

  followers: string[];
  followingUsers: string[];
  followingArtists: string[];

  followersCount?: number;
  followingUsersCount?: number;
  followingArtistsCount?: number;
  publicPlaylistsCount?: number;
  showRecentlyListenedArtists?: boolean;
  coverAccentHex?: string | null;
}

export interface SearchState {
  query: string;
  songs: Song[];
  albums: Album[];
  playlists: Playlist[];
  artists: Artist[];

  users: User[];

  loading: boolean;
  error: string | null;
  setQuery: (q: string) => void;
  search: (q: string) => Promise<void>;
}

export interface UserLibrary {
  userId: string;
  likedSongs: Song[];
  albums: Album[];
}

export type PlaylistKind =
  | "USER_CREATED"
  | "GENRE_MIX"
  | "MOOD_MIX"
  | "PERSONAL_MIX"
  | "ON_REPEAT"
  | "DISCOVER_WEEKLY"
  | "ON_REPEAT_REWIND"
  | "NEW_RELEASES"
  | "LIKED_SONGS";

export interface Playlist {
  _id: string;
  title: string;
  description?: string;
  isPublic: boolean;
  owner: User | null;
  songs: Song[];
  /** Server playlist category (not the library UI discriminator) */
  type?: PlaylistKind;
  imageUrl?: string;
  likes?: number;
  createdAt: string;
  updatedAt: string;
  isSystem?: boolean;
  sourceName?: string;
  sourceId?: string;
  searchableNames?: string[];
  lastGeneratedAt?: string;
  coverAccentHex?: string | null;
}

export interface BaseLibraryItem {
  _id: string;
  title: string;
  imageUrl?: string | null;
  createdAt: Date;
}

export interface LikedSongsItem extends BaseLibraryItem {
  type: "liked-songs";
  songsCount: number;
}

export interface AlbumItem extends BaseLibraryItem {
  type: "album";
  artist: Artist[];
  albumType?: string;
}
export interface PlaylistItem extends BaseLibraryItem {
  type: "playlist";
  owner: User | null;
  playlistKind?: PlaylistKind;
}

export interface FollowedArtistItem extends BaseLibraryItem {
  type: "artist";
  artistId: string;
  addedAt?: string;
}

export type LibraryItem =
  | LikedSongsItem
  | AlbumItem
  | PlaylistItem
  | FollowedArtistItem;
export interface LibraryPlaylist extends Playlist {
  addedAt?: string;
}

/** Row in profile followers/following or home horizontal sections */
export type UserSectionItem = {
  _id: string;
  name: string;
  imageUrl: string;
  itemType: "user";
};

export type DisplayItem =
  | (Song & { itemType: "song" })
  | (Album & { itemType: "album" })
  | (Playlist & { itemType: "playlist" })
  | (Artist & { itemType: "artist" })
  | UserSectionItem;
