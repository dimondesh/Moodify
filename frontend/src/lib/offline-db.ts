// frontend/src/lib/offline-db.ts

import { openDB, DBSchema, IDBPDatabase, StoreNames } from "idb";
import type { Song, Album, Playlist, Mix } from "@/types";

const DB_NAME = "MoodifyStudioOfflineDB";
const DB_VERSION = 5;

type StoredSong = Song & { userId: string };
type StoredAlbum = Album & { songsData: Song[]; userId: string };
type StoredPlaylist = Playlist & {
  songsData: Song[];
  userId: string;
  isGenerated?: boolean;
  nameKey?: string;
  descriptionKey?: string;
};
type StoredMix = Mix & { songsData: Song[]; userId: string };

interface MoodifyDB extends DBSchema {
  songs: { key: string; value: StoredSong; indexes: { "by-user": string } };
  albums: { key: string; value: StoredAlbum; indexes: { "by-user": string } };
  playlists: {
    key: string;
    value: StoredPlaylist;
    indexes: { "by-user": string };
  };
  mixes: { key: string; value: StoredMix; indexes: { "by-user": string } };
}

let dbPromise: Promise<IDBPDatabase<MoodifyDB>>;

const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<MoodifyDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 2) {
          const stores: StoreNames<MoodifyDB>[] = [
            "songs",
            "albums",
            "playlists",
            "mixes",
          ];
          for (const storeName of stores) {
            if (db.objectStoreNames.contains(storeName)) {
              const store = tx.objectStore(storeName);
              if (!store.indexNames.contains("by-user")) {
                store.createIndex("by-user", "userId");
              }
            } else {
              const store = db.createObjectStore(storeName, { keyPath: "_id" });
              store.createIndex("by-user", "userId");
            }
          }
        }
      },
    });
  }
  return dbPromise;
};

export const getDb = initDB;

export const saveUserItem = async <T extends StoreNames<MoodifyDB>>(
  storeName: T,
  item: MoodifyDB[T]["value"]
): Promise<void> => {
  const db = await getDb();
  await db.put(storeName, item);
};

export const deleteUserItem = async <T extends StoreNames<MoodifyDB>>(
  storeName: T,
  key: string
): Promise<void> => {
  const db = await getDb();
  await db.delete(storeName, key);
};

export const getAllUserAlbums = async (
  userId: string
): Promise<StoredAlbum[]> => {
  if (!userId) return [];
  const db = await getDb();
  return db.getAllFromIndex("albums", "by-user", userId);
};

export const getAllUserPlaylists = async (
  userId: string
): Promise<StoredPlaylist[]> => {
  if (!userId) return [];
  const db = await getDb();
  return db.getAllFromIndex("playlists", "by-user", userId);
};

export const getAllUserMixes = async (userId: string): Promise<StoredMix[]> => {
  if (!userId) return [];
  const db = await getDb();
  return db.getAllFromIndex("mixes", "by-user", userId);
};

export const getAllUserSongs = async (
  userId: string
): Promise<StoredSong[]> => {
  if (!userId) return [];
  const db = await getDb();
  return db.getAllFromIndex("songs", "by-user", userId);
};

export const getUserItem = async <T extends StoreNames<MoodifyDB>>(
  storeName: T,
  key: string,
  userId: string
): Promise<MoodifyDB[T]["value"] | undefined> => {
  const db = await getDb();
  const item = await db.get(storeName, key);
  if (item && item.userId === userId) {
    return item;
  }
  return undefined;
};
