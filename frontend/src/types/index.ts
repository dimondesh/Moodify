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
export interface Mix {
  _id: string;
  name: string;
  type: "Genre" | "Mood";
  sourceName: string;
  songs: Song[];
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  addedAt?: string;
  generatedOn: string;
  searchableNames?: string[];
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
  instrumentalUrl: string;
  vocalsUrl?: string;
  duration: number;
  playCount: number;
  genres: Genre[];
  moods: Mood[];
  createdAt: string;
  updatedAt: string;
  albumTitle?: string;
  likedAt?: string;
  lyrics?: string;
}

export interface RecentSearchItem {
  _id: string;
  searchId: string;
  itemType: "Artist" | "Album" | "Playlist" | "User" | "Mix" | "Song";

  name?: string;
  title?: string;
  imageUrl: string;

  artist?: Artist[];
  owner?: User;

  albumId?: string | null;
}

export interface GeneratedPlaylist {
  _id: string;
  user: string;
  type: "ON_REPEAT";
  songs: Song[];
  nameKey: string;
  descriptionKey: string;
  imageUrl: string;
  generatedOn: string;
  addedAt?: string;
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
    entityType: "song" | "album" | "playlist" | "mix";
    entityId: string;
  };
}

export interface User {
  _id: string;
  firebaseUid: string;
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
}

export interface SearchState {
  query: string;
  songs: Song[];
  albums: Album[];
  playlists: Playlist[];
  artists: Artist[];
  mixes: Mix[];

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

export interface Playlist {
  _id: string;
  title: string;
  description?: string;
  isPublic: boolean;
  owner: User;
  songs: Song[];
  type: "playlist";
  imageUrl?: string;
  likes: number;
  createdAt: string;
  updatedAt: string;
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
  owner: User;
  isGenerated?: boolean;
}
export interface MixItem extends BaseLibraryItem {
  type: "mix";
  sourceName: string;
}
export interface FollowedArtistItem extends BaseLibraryItem {
  type: "artist";
  artistId: string;
  addedAt?: string;
}
export interface GeneratedPlaylistItem extends BaseLibraryItem {
  type: "generated-playlist";
  sourceName: string;
}

export type LibraryItem =
  | LikedSongsItem
  | AlbumItem
  | PlaylistItem
  | FollowedArtistItem
  | MixItem
  | GeneratedPlaylistItem;
export interface LibraryPlaylist extends Playlist {
  addedAt?: string;
}
