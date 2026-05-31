/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Song } from "../types";
import toast from "react-hot-toast";
import { useOfflineStore } from "./useOfflineStore";
import { silentAudioService } from "@/lib/silentAudioService";
import {
  fetchSongById,
  fetchAlbumTitle,
  fetchAutoplayTracks,
} from "@/lib/api/music";
import i18n from "@/lib/i18n";
import { fetchPlaylistSmartShuffle } from "@/lib/api/playlists";
import { getUserItem } from "@/lib/offline-db";
import { useAuthStore } from "./useAuthStore";
import {
  computeSmartShuffleLimit,
  LARGE_PLAYLIST_THRESHOLD,
  pinIdAtFront,
  shuffleIds,
  type SmartShuffleRepeatMode,
} from "@/lib/smartShuffleContext";
import {
  readEntityShufflePref,
  writeEntityShufflePref,
  cycleEntityShufflePrefValue,
  type EntityShuffleMode,
  type EntityType,
} from "@/lib/entityShufflePrefs";

const migrateLocalStorageKey = (fromKey: string, toKey: string) => {
  try {
    if (typeof window === "undefined") return;
    const existingNew = localStorage.getItem(toKey);
    if (existingNew) return;
    const old = localStorage.getItem(fromKey);
    if (!old) return;
    localStorage.setItem(toKey, old);
    localStorage.removeItem(fromKey);
  } catch {
    // ignore
  }
};

migrateLocalStorageKey(
  "moodify-studio-player-storage",
  "moodify-player-storage",
);

/** Lyrics are large; persisting them blocks the main thread on every store write. */
const stripLyricsForPersistence = (song: Song): Song => {
  const rest = { ...song };
  delete rest.lyrics;
  return rest;
};

const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};

interface PlayerStore {
  currentSong: Song | null;
  isPlaying: boolean;
  queue: Song[];
  /** Tracks manually added by the user; played before the regular queue. */
  userQueue: Song[];
  currentIndex: number;
  repeatMode: "off" | "all" | "one";
  isShuffle: boolean;
  shuffleHistory: number[];
  shufflePointer: number;
  isFullScreenPlayerOpen: boolean;
  masterVolume: number;
  currentTime: number;
  duration: number;
  isDesktopLyricsOpen: boolean;
  isFetchingLyrics: boolean;
  isMobileLyricsFullScreen: boolean;
  originalDuration: number;
  seekVersion: number;
  currentPlaybackContext: {
    type: "song" | "album" | "playlist" | "artist";
    entityId?: string;
    entityTitle?: string;
    supportsSmartShuffle?: boolean;
  } | null;
  shuffleMode: "off" | "regular" | "smart";
  smartShuffleRepeatMode: SmartShuffleRepeatMode;
  /** Song IDs from the entity queue at play start (for smart shuffle sparkles). */
  contextSourceSongIds: string[];
  /** IDs of one-shot smart shuffle recommendations mixed into the current queue. */
  smartShuffleTrackIds: string[];
  /** ID playback order for large shuffled playlists (avoids full in-memory queue). */
  playbackOrderIds: string[] | null;
  playbackPointer: number;
  /** Bumped when entity shuffle prefs change in localStorage (for UI reactivity). */
  entityShufflePrefsRevision: number;
  currentSongFromUserQueue: boolean;
  autoplayEnabled: boolean;
  isAutoplayActive: boolean;
  autoplayPlayedIds: string[];
  /** Entity context active when autoplay was triggered (for shuffle UI). */
  autoplaySourceContext: PlayerStore["currentPlaybackContext"];

  setAutoplayEnabled: (enabled: boolean) => void;
  disableRepeatAndShuffleForAutoplay: () => void;
  startAutoplay: (sourceSong: Song) => Promise<void>;
  handleQueueEnd: () => Promise<void>;
  setRepeatMode: (mode: "off" | "all" | "one") => void;
  setSmartShuffleRepeatMode: (mode: SmartShuffleRepeatMode) => void;
  toggleShuffle: () => void;
  getEntityShufflePref: (
    entityType: EntityType,
    entityId: string,
    supportsSmartShuffle: boolean,
  ) => EntityShuffleMode;
  cycleEntityShufflePref: (
    entityType: EntityType,
    entityId: string,
    supportsSmartShuffle: boolean,
  ) => void;
  applyShuffleMode: (mode: EntityShuffleMode) => void;
  isActiveEntityContext: (type: EntityType, entityId: string) => boolean;
  isCurrentSongFromSmartShuffle: () => boolean;
  initializeQueue: (songs: Song[]) => void;
  /** Fetches missing hlsUrl/lyrics for the persisted or queue-seeded current track. */
  hydrateCurrentSong: () => Promise<void>;
  mixSmartShuffleTracksIntoQueue: () => Promise<void>;
  stripSmartShuffleTracksFromQueue: () => void;
  playAlbum: (
    songs: Song[],
    startIndex?: number,
    context?: {
      type: string;
      entityId?: string;
      entityTitle?: string;
      supportsSmartShuffle?: boolean;
    },
  ) => Promise<void>;
  setCurrentSong: (song: Song | null) => Promise<void>;
  togglePlay: () => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  setIsFullScreenPlayerOpen: (isOpen: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setCurrentTime: (time: number, isPlayerUpdate?: boolean) => void;
  setDuration: (duration: number, originalDuration?: number) => void;
  setIsDesktopLyricsOpen: (isOpen: boolean) => void;
  setIsMobileLyricsFullScreen: (isOpen: boolean) => void;
  seekToTime: (time: number) => void;
  setPlaybackContext: (
    context: {
      type: string;
      entityId?: string;
      entityTitle?: string;
      supportsSmartShuffle?: boolean;
    } | null,
  ) => void;
  removeFromQueue: (songId: string) => void;
  moveSongInQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  appendAutoplayTracks: () => Promise<void>;
  addToQueue: (song: Song) => void;
  addSongsToQueue: (songs: Song[]) => void;
  /** Inserts a track into the user queue (next after current, before regular upcoming). */
  addToQueueNext: (
    song: Song,
  ) => "added" | "already-playing" | "already-in-queue" | "started";
  moveSongInUserQueue: (fromIndex: number, toIndex: number) => void;
  clearUserQueue: () => void;
  promoteUpcomingToUserQueue: (songId: string, userIndex: number) => void;
  demoteUserQueueToUpcoming: (songId: string, beforeSongId: string) => void;
  getNextSongsInShuffle: (count?: number) => Song[];
}

type StoredPlaybackType = NonNullable<
  PlayerStore["currentPlaybackContext"]
>["type"];

function normalizePlaybackContextType(
  raw?: string,
): StoredPlaybackType | undefined {
  if (!raw) return undefined;
  if (
    raw === "mix" ||
    raw === "generated-playlist" ||
    raw === "personal-mix"
  ) {
    return "playlist";
  }
  if (
    raw === "song" ||
    raw === "album" ||
    raw === "playlist" ||
    raw === "artist"
  ) {
    return raw;
  }
  return undefined;
}

const shuffleQueue = (length: number) => {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const buildShuffleHistoryForIndex = (
  queueLength: number,
  currentIndex: number,
): { shuffleHistory: number[]; shufflePointer: number } => {
  if (queueLength === 0) {
    return { shuffleHistory: [], shufflePointer: -1 };
  }
  const shuffleHistory = shuffleQueue(queueLength);
  if (currentIndex === -1) {
    return { shuffleHistory, shufflePointer: -1 };
  }
  const currentPosInShuffle = shuffleHistory.indexOf(currentIndex);
  if (currentPosInShuffle !== -1) {
    [shuffleHistory[0], shuffleHistory[currentPosInShuffle]] = [
      shuffleHistory[currentPosInShuffle],
      shuffleHistory[0],
    ];
  } else {
    shuffleHistory.unshift(currentIndex);
    shuffleHistory.pop();
  }
  return { shuffleHistory, shufflePointer: 0 };
};

const isEntityPlaybackType = (
  type: StoredPlaybackType | undefined,
): type is EntityType =>
  type === "album" || type === "playlist" || type === "artist";

async function fetchSmartTracksForPlaylist(
  playlistId: string,
  sourceCount: number,
  repeatMode: SmartShuffleRepeatMode,
): Promise<Song[]> {
  if (useOfflineStore.getState().isOffline) return [];
  const limit = computeSmartShuffleLimit(sourceCount);
  if (limit <= 0) return [];
  try {
    return await fetchPlaylistSmartShuffle(playlistId, {
      repeatMode,
      limit,
    });
  } catch (error) {
    console.error("Smart shuffle fetch error:", error);
    return [];
  }
}

function mergeSongIntoQueueCache(queue: Song[], song: Song): Song[] {
  if (queue.some((s) => s._id === song._id)) return queue;
  return [...queue, song];
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => {
      const enrichSongWithAlbumTitleIfNeeded = async (song: Song) => {
        if (
          song.albumTitle ||
          !song.albumId ||
          useOfflineStore.getState().isOffline
        )
          return;
        try {
          const albumTitle = await fetchAlbumTitle(song.albumId);
          if (albumTitle && get().currentSong?._id === song._id) {
            set((state) => ({
              currentSong: { ...state.currentSong!, albumTitle },
            }));
          }
        } catch (error) {
          console.warn(
            `Could not fetch album title for song ${song._id}`,
            error,
          );
        }
      };

      // Умная функция подгрузки недостающих данных трека (HLS, Canvas, Lyrics)
      const ensureSongData = async (song: Song): Promise<Song | null> => {
        // Онлайн: догружаем с сервера
        // Оффлайн: пытаемся взять из IndexedDB (songs), иначе возвращаем как есть
        const songId = song?._id;
        if (!songId || songId === "undefined" || typeof songId !== "string") {
          console.error("ensureSongData: invalid song id", song);
          return null;
        }

        if (song.hlsUrl && song.lyrics) return song;

        if (useOfflineStore.getState().isOffline) {
          try {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) return song;
            const localSong = await getUserItem("songs", song._id, userId);
            if (localSong?.hlsUrl) return { ...song, ...localSong };
            return song;
          } catch {
            return song;
          }
        }

        set({ isFetchingLyrics: true });
        try {
          const fullData = await fetchSongById(songId);

          const completeSong = {
            ...song,
            hlsUrl: fullData.hlsUrl,
            canvasUrl: fullData.canvasUrl,
            lyrics: fullData.lyrics,
            genres: fullData.genres,
            moods: fullData.moods,
            // Если song уже пришёл с populated artist (name), не затираем его
            artist:
              Array.isArray((song as any).artist) &&
              typeof (song as any).artist?.[0] === "object" &&
              (song as any).artist?.[0]?.name
                ? (song as any).artist
                : (fullData.artist ?? song.artist),
          };

          // Обновляем песню в очереди, чтобы данные закэшировались локально
          set((state) => ({
            queue: state.queue.map((s) =>
              s._id === song._id ? completeSong : s,
            ),
            userQueue: state.userQueue.map((s) =>
              s._id === song._id ? completeSong : s,
            ),
            isFetchingLyrics: false,
          }));

          return completeSong;
        } catch (error) {
          console.error(
            `Could not fetch full data for song ${song._id}`,
            error,
          );
          set({ isFetchingLyrics: false });
          return null;
        }
      };

      const resolveSongForPlayback = async (
        songId: string,
        localPool: Song[],
        queue: Song[],
      ): Promise<Song | null> => {
        const cached =
          queue.find((s) => s._id === songId) ??
          localPool.find((s) => s._id === songId);
        if (cached) {
          return ensureSongData(cached);
        }
        try {
          const fetched = await fetchSongById(songId);
          return ensureSongData(fetched);
        } catch {
          return null;
        }
      };

      const pauseAtEntityFirstTrack = async () => {
        const state = get();
        silentAudioService.pause();

        const firstEntityId =
          state.contextSourceSongIds[0] ?? state.queue[0]?._id ?? null;

        if (!firstEntityId) {
          set({
            isPlaying: false,
            currentSong: null,
            currentIndex: -1,
            currentTime: 0,
          });
          return;
        }

        const fullSong = await resolveSongForPlayback(
          firstEntityId,
          state.queue,
          state.queue,
        );

        if (!fullSong) {
          set({
            isPlaying: false,
            currentSong: null,
            currentIndex: -1,
            currentTime: 0,
          });
          return;
        }

        const newQueue = mergeSongIntoQueueCache(state.queue, fullSong);
        const currentIndex = newQueue.findIndex((s) => s._id === fullSong._id);

        let playbackPointer = state.playbackPointer;
        if (state.playbackOrderIds) {
          const ptr = state.playbackOrderIds.indexOf(firstEntityId);
          playbackPointer = ptr >= 0 ? ptr : 0;
        }

        let shufflePointer = state.shufflePointer;
        if (
          state.shuffleMode !== "off" &&
          state.shuffleHistory.length > 0 &&
          currentIndex >= 0
        ) {
          const pos = state.shuffleHistory.indexOf(currentIndex);
          if (pos >= 0) shufflePointer = pos;
        }

        set({
          isPlaying: false,
          currentSong: fullSong,
          queue: newQueue,
          currentIndex: currentIndex >= 0 ? currentIndex : 0,
          playbackPointer: state.playbackOrderIds
            ? playbackPointer
            : state.playbackPointer,
          shufflePointer,
          currentTime: 0,
          currentSongFromUserQueue: false,
        });
      };

      const disableRepeatAndShuffleForAutoplay = () => {
        const state = get();
        set({ repeatMode: "off" });

        const contexts = [
          state.currentPlaybackContext,
          state.autoplaySourceContext,
        ];
        let bumped = false;
        for (const ctx of contexts) {
          if (ctx?.entityId && isEntityPlaybackType(ctx.type)) {
            writeEntityShufflePref(ctx.type, ctx.entityId, "off");
            bumped = true;
          }
        }
        if (bumped) {
          set((s) => ({
            entityShufflePrefsRevision: s.entityShufflePrefsRevision + 1,
          }));
        }

        get().applyShuffleMode("off");
      };

      const handleQueueEnd = async () => {
        const state = get();
        const { isOffline } = useOfflineStore.getState();

        if (state.autoplayEnabled && !isOffline && state.currentSong) {
          if (state.isAutoplayActive) {
            // Если автоплей уже активен, пытаемся дозагрузить треки
            const oldLength = state.queue.length;
            await appendAutoplayTracks();

            const newState = get();
            // Если треки успешно добавились — переключаем на следующий
            if (newState.queue.length > oldLength) {
              await get().playNext();
            } else {
              // Если больше похожих треков нет — останавливаем
              await pauseAtEntityFirstTrack();
            }
          } else {
            // Если автоплей был выключен — стартуем его с нуля
            await startAutoplay(state.currentSong);
          }
        } else {
          await pauseAtEntityFirstTrack();
        }
      };

      const appendAutoplayTracks = async () => {
        const state = get();
        const { isOffline } = useOfflineStore.getState();

        // Проверяем, включен ли автоплей и активен ли он прямо сейчас
        if (
          isOffline ||
          !state.autoplayEnabled ||
          !state.currentSong ||
          !state.isAutoplayActive
        ) {
          return;
        }

        // Исключаем все уже проигранные и добавленные в очередь треки
        const excludeIds = [
          ...new Set([
            ...state.contextSourceSongIds,
            ...state.queue.map((s) => s._id),
            ...state.autoplayPlayedIds,
          ]),
        ];

        try {
          const tracks = await fetchAutoplayTracks(state.currentSong._id, {
            excludeIds,
            repeatMode: state.smartShuffleRepeatMode,
          });

          if (tracks.length > 0) {
            set((s) => {
              const newQueue = [...s.queue];
              let added = false;

              for (const track of tracks) {
                if (!newQueue.some((q) => q._id === track._id)) {
                  newQueue.push(track);
                  added = true;
                }
              }

              if (!added) return s;

              return {
                queue: newQueue,
                autoplayPlayedIds: [
                  ...new Set([
                    ...s.autoplayPlayedIds,
                    ...tracks.map((t) => t._id),
                  ]),
                ],
              };
            });
          }
        } catch (error) {
          console.error("Failed to append autoplay tracks:", error);
        }
      };

      // 1. Обновляем startAutoplay, чтобы она умела дописывать треки в конец очереди
      const startAutoplay = async (sourceSong: Song) => {
        const state = get();
        const { isOffline } = useOfflineStore.getState();

        if (isOffline) {
          await pauseAtEntityFirstTrack();
          return;
        }

        const isAlreadyActive = state.isAutoplayActive;

        const autoplaySourceContext =
          state.isAutoplayActive && state.autoplaySourceContext
            ? state.autoplaySourceContext
            : state.currentPlaybackContext?.entityId &&
                isEntityPlaybackType(state.currentPlaybackContext.type)
              ? {
                  type: state.currentPlaybackContext.type,
                  entityId: state.currentPlaybackContext.entityId,
                  entityTitle: state.currentPlaybackContext.entityTitle,
                  supportsSmartShuffle:
                    state.currentPlaybackContext.supportsSmartShuffle,
                }
              : state.autoplaySourceContext;

        if (autoplaySourceContext) {
          set({ autoplaySourceContext });
        }

        disableRepeatAndShuffleForAutoplay();

        const excludeIds = [
          ...new Set([
            ...state.contextSourceSongIds,
            ...state.queue.map((s) => s._id),
            ...state.autoplayPlayedIds,
            sourceSong._id,
          ]),
        ];

        let tracks: Song[];
        try {
          tracks = await fetchAutoplayTracks(sourceSong._id, {
            excludeIds,
            repeatMode: get().smartShuffleRepeatMode,
          });
        } catch {
          if (!isAlreadyActive) await pauseAtEntityFirstTrack();
          return;
        }

        if (tracks.length === 0) {
          if (!isAlreadyActive) await pauseAtEntityFirstTrack();
          return;
        }

        // Если автоплей уже активен — берем текущую очередь, иначе создаем пустую
        let queueCache = isAlreadyActive ? [...state.queue] : [];
        for (const track of tracks) {
          queueCache = mergeSongIntoQueueCache(queueCache, track);
        }

        // ЕСЛИ АВТОПЛЕЙ УЖЕ РАБОТАЕТ: просто дописываем треки в хвост
        if (isAlreadyActive) {
          const autoplayPlayedIds = [
            ...new Set([
              ...state.autoplayPlayedIds,
              ...tracks.map((t) => t._id),
            ]),
          ];
          set({
            queue: queueCache,
            autoplayPlayedIds,
          });
          return;
        }

        // Первоначальный запуск автоплея (первый раз перешли из обычной очереди)
        const firstTrack = await ensureSongData(queueCache[0]);
        if (!firstTrack?.hlsUrl) {
          await pauseAtEntityFirstTrack();
          return;
        }

        queueCache[0] = firstTrack;
        const autoplayPlayedIds = [
          ...new Set([
            ...state.autoplayPlayedIds,
            sourceSong._id,
            ...tracks.map((t) => t._id),
          ]),
        ];

        silentAudioService.play();
        set({
          isAutoplayActive: true,
          autoplayPlayedIds,
          playbackOrderIds: null,
          playbackPointer: -1,
          contextSourceSongIds: [],
          smartShuffleTrackIds: [],
          queue: queueCache,
          userQueue: [],
          currentSong: firstTrack,
          currentIndex: 0,
          isPlaying: true,
          currentTime: 0,
          currentSongFromUserQueue: false,
          shuffleHistory: [],
          shufflePointer: -1,
          currentPlaybackContext: {
            type: "song",
            entityTitle: i18n.t("player.autoplay"),
          },
        });

        enrichSongWithAlbumTitleIfNeeded(firstTrack);
      };

      return {
        currentSong: null,
        isPlaying: false,
        isFetchingLyrics: false,
        queue: [],
        userQueue: [],
        currentIndex: -1,
        repeatMode: "off",
        isShuffle: false,
        shuffleHistory: [],
        shufflePointer: -1,
        isFullScreenPlayerOpen: false,
        masterVolume: isMobileDevice() ? 100 : 75,
        currentPlaybackContext: null,
        currentTime: 0,
        duration: 0,
        originalDuration: 0,
        seekVersion: 0,
        shuffleMode: "off",
        smartShuffleRepeatMode: "default",
        contextSourceSongIds: [],
        smartShuffleTrackIds: [],
        playbackOrderIds: null,
        playbackPointer: -1,
        entityShufflePrefsRevision: 0,
        currentSongFromUserQueue: false,
        autoplayEnabled: true,
        isAutoplayActive: false,
        autoplayPlayedIds: [],
        autoplaySourceContext: null,

        isDesktopLyricsOpen: false,
        isMobileLyricsFullScreen: false,

        initializeQueue: (songs: Song[]) => {
          set((state) => {
            const newQueue = songs;
            const currentSong =
              state.currentSong &&
              newQueue.some((s) => s._id === state.currentSong!._id)
                ? state.currentSong
                : newQueue.length > 0
                  ? newQueue[0]
                  : null;

            const currentIndex = currentSong
              ? newQueue.findIndex((s) => s._id === currentSong._id)
              : -1;
            let newShuffleHistory = state.shuffleHistory;
            let newShufflePointer = state.shufflePointer;

            if (state.shuffleMode !== "off" && newQueue.length > 0) {
              newShuffleHistory = shuffleQueue(newQueue.length);
              if (currentSong && currentIndex !== -1) {
                const currentPosInShuffle =
                  newShuffleHistory.indexOf(currentIndex);
                if (currentPosInShuffle !== -1) {
                  [
                    newShuffleHistory[0],
                    newShuffleHistory[currentPosInShuffle],
                  ] = [
                    newShuffleHistory[currentPosInShuffle],
                    newShuffleHistory[0],
                  ];
                } else {
                  newShuffleHistory.unshift(currentIndex);
                  newShuffleHistory.pop();
                }
                newShufflePointer = 0;
              } else {
                newShufflePointer = -1;
              }
            } else {
              newShuffleHistory = [];
              newShufflePointer = -1;
            }

            return {
              queue: newQueue,
              currentSong: currentSong,
              currentIndex: currentIndex,
              shuffleHistory: newShuffleHistory,
              shufflePointer: newShufflePointer,
            };
          });
          queueMicrotask(() => {
            void get().hydrateCurrentSong();
          });
        },

        hydrateCurrentSong: async () => {
          const song = get().currentSong;
          if (!song) return;

          const fullSong = await ensureSongData(song);
          if (!fullSong || get().currentSong?._id !== song._id) return;

          set((state) => ({
            currentSong: fullSong,
            queue: state.queue.map((s) =>
              s._id === fullSong._id ? fullSong : s,
            ),
            userQueue: state.userQueue.map((s) =>
              s._id === fullSong._id ? fullSong : s,
            ),
          }));
        },

        playAlbum: async (songs: Song[], startIndex = 0, context) => {
          if (songs.length === 0) {
            silentAudioService.pause();
            set({
              currentSong: null,
              isPlaying: false,
              queue: [],
              userQueue: [],
              currentIndex: -1,
              shuffleHistory: [],
              shufflePointer: -1,
              contextSourceSongIds: [],
              smartShuffleTrackIds: [],
              playbackOrderIds: null,
              playbackPointer: -1,
              currentSongFromUserQueue: false,
              isAutoplayActive: false,
              autoplayPlayedIds: [],
              autoplaySourceContext: null,
            });
            return;
          }

          const normalizedType = context
            ? normalizePlaybackContextType(context.type)
            : undefined;
          const contextSourceSongIds = songs.map((s) => s._id);
          let shuffleMode = get().shuffleMode;
          let smartShuffleTrackIds: string[] = [];
          let smartTracks: Song[] = [];

          if (
            context?.entityId &&
            normalizedType &&
            isEntityPlaybackType(normalizedType)
          ) {
            const supportsSmartShuffle = context.supportsSmartShuffle ?? false;
            shuffleMode = readEntityShufflePref(
              normalizedType,
              context.entityId,
              supportsSmartShuffle,
            );
          }

          const shouldFetchSmartMix =
            shuffleMode === "smart" &&
            (context?.supportsSmartShuffle ?? false) &&
            normalizedType === "playlist" &&
            context?.entityId;

          if (shouldFetchSmartMix) {
            smartTracks = await fetchSmartTracksForPlaylist(
              context.entityId!,
              contextSourceSongIds.length,
              get().smartShuffleRepeatMode,
            );
            const existingIds = new Set(contextSourceSongIds);
            const unique = smartTracks.filter((t) => !existingIds.has(t._id));
            smartShuffleTrackIds = unique.map((t) => t._id);
            smartTracks = unique;
          }

          const useIdBasedPlayback =
            shuffleMode !== "off" &&
            contextSourceSongIds.length > LARGE_PLAYLIST_THRESHOLD;

          const normalizedTypeForContext = context
            ? normalizePlaybackContextType(context.type)
            : undefined;

          const playbackContext =
            context && normalizedTypeForContext
              ? {
                  type: normalizedTypeForContext,
                  entityId: context.entityId,
                  entityTitle: context.entityTitle,
                  supportsSmartShuffle: context.supportsSmartShuffle,
                }
              : null;

          if (useIdBasedPlayback) {
            const sourceIds = contextSourceSongIds;
            const smartIds = smartShuffleTrackIds;
            let playbackOrderIds = shuffleIds([...sourceIds, ...smartIds]);
            const startId = sourceIds[startIndex] ?? sourceIds[0];
            playbackOrderIds = pinIdAtFront(playbackOrderIds, startId);

            const fullSong = await resolveSongForPlayback(
              startId,
              songs,
              smartTracks,
            );

            if (!fullSong || !fullSong.hlsUrl) {
              toast.error("Cannot start playback: missing audio file");
              return;
            }

            silentAudioService.play();

            let queueCache = mergeSongIntoQueueCache([], fullSong);
            for (const track of smartTracks) {
              queueCache = mergeSongIntoQueueCache(queueCache, track);
            }

            set({
              queue: queueCache,
              userQueue: [],
              isPlaying: true,
              currentSong: fullSong,
              currentIndex: queueCache.findIndex((s) => s._id === fullSong._id),
              shuffleHistory: [],
              shufflePointer: -1,
              playbackOrderIds,
              playbackPointer: 0,
              shuffleMode,
              contextSourceSongIds,
              smartShuffleTrackIds,
              currentSongFromUserQueue: false,
              currentTime: 0,
              currentPlaybackContext: playbackContext,
              isAutoplayActive: false,
              autoplayPlayedIds: [],
              autoplaySourceContext: null,
            });

            enrichSongWithAlbumTitleIfNeeded(fullSong);
            return;
          }

          let queueSongs = [...songs, ...smartTracks];
          let targetIndexInQueue = startIndex;
          let newShuffleHistory: number[] = [];
          let newShufflePointer: number = -1;

          if (shuffleMode !== "off") {
            newShuffleHistory = shuffleQueue(queueSongs.length);
            const currentPosInShuffle = newShuffleHistory.indexOf(startIndex);
            if (currentPosInShuffle !== -1) {
              [newShuffleHistory[0], newShuffleHistory[currentPosInShuffle]] = [
                newShuffleHistory[currentPosInShuffle],
                newShuffleHistory[0],
              ];
            } else {
              newShuffleHistory.unshift(startIndex);
              newShuffleHistory.pop();
            }
            newShufflePointer = 0;
            targetIndexInQueue = newShuffleHistory[newShufflePointer];
          }

          const songToPlay = queueSongs[targetIndexInQueue];
          const fullSong = await ensureSongData(songToPlay);

          if (!fullSong || !fullSong.hlsUrl) {
            console.error(
              "Cannot start playback: missing audio file",
              fullSong,
            );
            toast.error("Cannot start playback: missing audio file");
            return;
          }

          silentAudioService.play();

          const updatedQueue = [...queueSongs];
          updatedQueue[targetIndexInQueue] = fullSong;

          set({
            queue: updatedQueue,
            userQueue: [],
            isPlaying: true,
            currentSong: fullSong,
            currentIndex: targetIndexInQueue,
            shuffleHistory: newShuffleHistory,
            shufflePointer: newShufflePointer,
            playbackOrderIds: null,
            playbackPointer: -1,
            shuffleMode,
            contextSourceSongIds,
            smartShuffleTrackIds,
            currentSongFromUserQueue: false,
            currentTime: 0,
            currentPlaybackContext: playbackContext,
            isAutoplayActive: false,
            autoplayPlayedIds: [],
            autoplaySourceContext: null,
          });

          enrichSongWithAlbumTitleIfNeeded(fullSong);
        },

        setAutoplayEnabled: (enabled) => set({ autoplayEnabled: enabled }),
        disableRepeatAndShuffleForAutoplay,
        startAutoplay,
        appendAutoplayTracks,
        handleQueueEnd,

        setCurrentSong: async (song: Song | null) => {
          if (!song) {
            silentAudioService.pause();
            set({
              currentSong: null,
              isPlaying: false,
              currentIndex: -1,
              currentTime: 0,
              duration: 0,
            });
            return;
          }

          const fullSong = await ensureSongData(song);

          if (!fullSong || !fullSong.hlsUrl) {
            console.error(
              "Song has no hlsUrl, cannot start playback:",
              fullSong,
            );
            toast.error("Cannot start playback: missing audio file");
            return;
          }

          silentAudioService.play();

          set((state) => {
            const userQueueIndex = state.userQueue.findIndex(
              (s) => s._id === fullSong._id,
            );
            if (userQueueIndex !== -1) {
              return {
                currentSong: fullSong,
                isPlaying: true,
                userQueue: state.userQueue.slice(userQueueIndex + 1),
                currentTime: 0,
                currentSongFromUserQueue: true,
              };
            }

            const songIndex = state.queue.findIndex(
              (s) => s._id === fullSong._id,
            );
            let newShufflePointer = state.shufflePointer;
            let newShuffleHistory = state.shuffleHistory;

            if (state.shuffleMode !== "off") {
              if (songIndex !== -1) {
                newShuffleHistory = shuffleQueue(state.queue.length);
                const currentPos = newShuffleHistory.indexOf(songIndex);
                if (currentPos !== -1) {
                  [newShuffleHistory[0], newShuffleHistory[currentPos]] = [
                    newShuffleHistory[currentPos],
                    newShuffleHistory[0],
                  ];
                } else {
                  newShuffleHistory.unshift(songIndex);
                  newShuffleHistory.pop();
                }
                newShufflePointer = 0;
              } else {
                newShuffleHistory = [];
                newShufflePointer = -1;
              }
            }

            return {
              currentSong: fullSong,
              isPlaying: true,
              currentIndex: songIndex !== -1 ? songIndex : state.currentIndex,
              shuffleHistory: newShuffleHistory,
              shufflePointer: newShufflePointer,
              currentTime: 0,
              currentSongFromUserQueue: false,
            };
          });

          enrichSongWithAlbumTitleIfNeeded(fullSong);

          const afterState = get();
          if (
            afterState.isAutoplayActive &&
            afterState.currentIndex >= afterState.queue.length - 3
          ) {
            void get().appendAutoplayTracks();
          }
        },

        togglePlay: () => {
          const state = get();
          const willPlay = !state.isPlaying;

          if (
            willPlay &&
            state.currentSong &&
            (!state.currentSong.hlsUrl || !state.currentSong.lyrics)
          ) {
            void get()
              .hydrateCurrentSong()
              .then(() => {
                const latest = get();
                if (!latest.currentSong?.hlsUrl) return;
                silentAudioService.play();
                set({ isPlaying: true });
              });
            return;
          }

          set(() => {
            if (willPlay && state.currentSong) {
              silentAudioService.play();
            } else {
              silentAudioService.pause();
            }
            return { isPlaying: willPlay };
          });
        },

        toggleShuffle: () => {
          if (get().isAutoplayActive) return;

          const state = get();
          const ctx = state.currentPlaybackContext;

          if (ctx?.entityId && isEntityPlaybackType(ctx.type)) {
            const supportsSmart = ctx.supportsSmartShuffle ?? false;
            const currentPref = readEntityShufflePref(
              ctx.type,
              ctx.entityId,
              supportsSmart,
            );
            const newPref = cycleEntityShufflePrefValue(
              currentPref,
              supportsSmart,
            );
            writeEntityShufflePref(ctx.type, ctx.entityId, newPref);
            set((s) => ({
              entityShufflePrefsRevision: s.entityShufflePrefsRevision + 1,
            }));
            get().applyShuffleMode(newPref);
            return;
          }

          if (state.shuffleMode === "off") {
            get().applyShuffleMode("regular");
          } else {
            get().applyShuffleMode("off");
          }
        },

        getEntityShufflePref: (entityType, entityId, supportsSmartShuffle) =>
          readEntityShufflePref(entityType, entityId, supportsSmartShuffle),

        cycleEntityShufflePref: (
          entityType,
          entityId,
          supportsSmartShuffle,
        ) => {
          const state = get();
          if (state.isAutoplayActive) {
            const src = state.autoplaySourceContext;
            if (src?.entityId === entityId && src.type === entityType) {
              return;
            }
          }

          const currentPref = readEntityShufflePref(
            entityType,
            entityId,
            supportsSmartShuffle,
          );
          const newPref = cycleEntityShufflePrefValue(
            currentPref,
            supportsSmartShuffle,
          );
          writeEntityShufflePref(entityType, entityId, newPref);
          set((s) => ({
            entityShufflePrefsRevision: s.entityShufflePrefsRevision + 1,
          }));

          const ctx = get().currentPlaybackContext;
          if (ctx?.entityId === entityId && ctx.type === entityType) {
            get().applyShuffleMode(newPref);
          }
        },

        applyShuffleMode: (mode: EntityShuffleMode) => {
          if (get().isAutoplayActive && mode !== "off") return;

          const prevMode = get().shuffleMode;

          if (prevMode === "smart" && mode !== "smart") {
            get().stripSmartShuffleTracksFromQueue();
          }

          set((state) => {
            if (mode === "off") {
              return {
                shuffleMode: "off",
                shuffleHistory: [],
                shufflePointer: -1,
                smartShuffleTrackIds: [],
              };
            }
            if (state.queue.length === 0) {
              return {
                shuffleMode: mode,
                shuffleHistory: [],
                shufflePointer: -1,
                smartShuffleTrackIds: [],
              };
            }
            const { shuffleHistory, shufflePointer } =
              buildShuffleHistoryForIndex(
                state.queue.length,
                state.currentIndex,
              );
            return { shuffleMode: mode, shuffleHistory, shufflePointer };
          });

          if (mode === "smart" && prevMode !== "smart") {
            void get().mixSmartShuffleTracksIntoQueue();
          }
        },

        isActiveEntityContext: (type, entityId) => {
          const ctx = get().currentPlaybackContext;
          return ctx?.type === type && ctx?.entityId === entityId;
        },

        isCurrentSongFromSmartShuffle: () => {
          const state = get();
          if (state.shuffleMode !== "smart" || !state.currentSong?._id) {
            return false;
          }
          if (state.currentSongFromUserQueue) return false;
          return state.smartShuffleTrackIds.includes(state.currentSong._id);
        },

        stripSmartShuffleTracksFromQueue: () => {
          set((state) => {
            const sourceIds = new Set(state.contextSourceSongIds);
            if (sourceIds.size === 0) {
              return {
                smartShuffleTrackIds: [],
                playbackOrderIds: null,
                playbackPointer: -1,
              };
            }

            if (state.playbackOrderIds) {
              const currentId = state.playbackOrderIds[state.playbackPointer];
              const newOrder = state.playbackOrderIds.filter((id) =>
                sourceIds.has(id),
              );
              let newPointer = currentId
                ? newOrder.indexOf(currentId)
                : state.playbackPointer;
              if (newPointer < 0) newPointer = 0;
              const newQueue = state.queue.filter((s) => sourceIds.has(s._id));
              return {
                playbackOrderIds: newOrder.length > 0 ? newOrder : null,
                playbackPointer: newOrder.length > 0 ? newPointer : -1,
                smartShuffleTrackIds: [],
                queue: newQueue,
                currentSong:
                  newQueue.find((s) => s._id === currentId) ??
                  state.currentSong,
                currentIndex: newQueue.findIndex(
                  (s) => s._id === state.currentSong?._id,
                ),
              };
            }

            const newQueue = state.queue.filter((s) => sourceIds.has(s._id));
            if (newQueue.length === state.queue.length) {
              return { smartShuffleTrackIds: [] };
            }
            const currentId = state.currentSong?._id;
            let newCurrentIndex = currentId
              ? newQueue.findIndex((s) => s._id === currentId)
              : state.currentIndex;
            if (newCurrentIndex < 0) newCurrentIndex = 0;
            return {
              queue: newQueue,
              currentIndex: newCurrentIndex,
              currentSong: newQueue[newCurrentIndex] ?? state.currentSong,
              smartShuffleTrackIds: [],
            };
          });
        },

        mixSmartShuffleTracksIntoQueue: async () => {
          const state = get();
          const ctx = state.currentPlaybackContext;
          if (
            state.shuffleMode !== "smart" ||
            !ctx?.entityId ||
            ctx.type !== "playlist" ||
            !ctx.supportsSmartShuffle ||
            state.smartShuffleTrackIds.length > 0
          ) {
            return;
          }

          const sourceCount =
            state.contextSourceSongIds.length > 0
              ? state.contextSourceSongIds.length
              : state.queue.length;

          const smartTracks = await fetchSmartTracksForPlaylist(
            ctx.entityId,
            sourceCount,
            state.smartShuffleRepeatMode,
          );

          const knownIds = new Set([
            ...state.contextSourceSongIds,
            ...state.queue.map((s) => s._id),
          ]);
          const uniqueTracks = smartTracks.filter((t) => !knownIds.has(t._id));
          if (uniqueTracks.length === 0) return;

          const smartShuffleTrackIds = uniqueTracks.map((t) => t._id);

          if (state.playbackOrderIds) {
            const currentId =
              state.playbackOrderIds[state.playbackPointer] ??
              state.currentSong?._id;
            const remaining = state.playbackOrderIds.slice(
              state.playbackPointer + 1,
            );
            const shuffledTail = shuffleIds([
              ...remaining,
              ...smartShuffleTrackIds,
            ]);
            const newOrder = currentId
              ? [currentId, ...shuffledTail]
              : shuffledTail;

            set((currentState) => {
              let queueCache = currentState.queue;
              for (const track of uniqueTracks) {
                queueCache = mergeSongIntoQueueCache(queueCache, track);
              }
              return {
                queue: queueCache,
                playbackOrderIds: newOrder,
                playbackPointer: 0,
                smartShuffleTrackIds,
                shuffleHistory: [],
                shufflePointer: -1,
              };
            });
            return;
          }

          set((currentState) => {
            const newQueue = [...currentState.queue, ...uniqueTracks];
            const { shuffleHistory, shufflePointer } =
              buildShuffleHistoryForIndex(
                newQueue.length,
                currentState.currentIndex,
              );
            return {
              queue: newQueue,
              smartShuffleTrackIds,
              shuffleHistory,
              shufflePointer,
            };
          });
        },

        playNext: async () => {
          if (get().repeatMode === "one") set({ repeatMode: "off" });

          const state = get();
          const {
            queue,
            userQueue,
            shuffleHistory,
            shufflePointer,
            currentIndex,
            shuffleMode,
            repeatMode,
          } = state;
          const isShuffle = shuffleMode !== "off";
          const { isOffline } = useOfflineStore.getState();
          const { isSongDownloaded } = useOfflineStore.getState().actions;

          if (userQueue.length > 0) {
            const [nextSong, ...remainingUserQueue] = userQueue;
            const fullNextSong = await ensureSongData(nextSong);

            if (!fullNextSong || !fullNextSong.hlsUrl) {
              toast.error("Cannot load audio for next song");
              set({ userQueue: remainingUserQueue });
              return;
            }

            silentAudioService.play();
            set({
              currentSong: fullNextSong,
              isPlaying: true,
              userQueue: remainingUserQueue,
              currentTime: 0,
              currentSongFromUserQueue: true,
            });
            enrichSongWithAlbumTitleIfNeeded(fullNextSong);
            return;
          }

          if (state.playbackOrderIds && state.playbackPointer >= 0) {
            const order = state.playbackOrderIds;
            let nextPtr = state.playbackPointer + 1;
            if (nextPtr >= order.length) {
              if (state.autoplayEnabled && !isOffline && state.currentSong) {
                await handleQueueEnd();
                return;
              }
              if (repeatMode === "all") nextPtr = 0;
              else {
                await handleQueueEnd();
                return;
              }
            }

            let checked = 0;
            let resolvedPtr = -1;
            let fullNextSong: Song | null = null;
            let ptr = nextPtr;

            while (checked < order.length) {
              const nextId = order[ptr];
              if (
                !isOffline ||
                useOfflineStore.getState().actions.isSongDownloaded(nextId)
              ) {
                fullNextSong = await resolveSongForPlayback(
                  nextId,
                  state.queue,
                  state.queue,
                );
                if (fullNextSong?.hlsUrl) {
                  resolvedPtr = ptr;
                  break;
                }
              }
              ptr++;
              if (ptr >= order.length) {
                if (state.autoplayEnabled && !isOffline && state.currentSong) {
                  break;
                }
                if (repeatMode === "all") ptr = 0;
                else break;
              }
              checked++;
            }

            if (resolvedPtr === -1 || !fullNextSong) {
              if (
                repeatMode === "all" &&
                !(state.autoplayEnabled && !isOffline && state.currentSong)
              ) {
                toast(
                  isOffline ? "No other downloaded songs." : "End of queue.",
                );
                silentAudioService.pause();
                set({ isPlaying: false, currentTime: 0 });
              } else {
                await handleQueueEnd();
              }
              return;
            }

            const newQueue = mergeSongIntoQueueCache(state.queue, fullNextSong);
            silentAudioService.play();
            set({
              currentSong: fullNextSong,
              isPlaying: true,
              playbackPointer: resolvedPtr,
              queue: newQueue,
              currentIndex: newQueue.findIndex(
                (s) => s._id === fullNextSong._id,
              ),
              currentTime: 0,
              currentSongFromUserQueue: false,
            });
            enrichSongWithAlbumTitleIfNeeded(fullNextSong);
            return;
          }

          if (queue.length === 0) {
            silentAudioService.pause();
            set({ isPlaying: false });
            return;
          }

          let tempShufflePointer = shufflePointer;
          let tempShuffleHistory = [...shuffleHistory];
          let nextIndex = -1;

          if (isShuffle) {
            if (tempShuffleHistory.length === 0 && queue.length > 0) {
              tempShuffleHistory = shuffleQueue(queue.length);
              const currentPos = tempShuffleHistory.indexOf(currentIndex);
              if (currentPos !== -1) {
                [tempShuffleHistory[0], tempShuffleHistory[currentPos]] = [
                  tempShuffleHistory[currentPos],
                  tempShuffleHistory[0],
                ];
              }
              tempShufflePointer = 0;
            }
            let checkedCount = 0;
            let potentialPointer = tempShufflePointer;
            while (checkedCount < tempShuffleHistory.length) {
              potentialPointer++;
              if (potentialPointer >= tempShuffleHistory.length) {
                if (state.autoplayEnabled && !isOffline && state.currentSong) {
                  break;
                }
                if (repeatMode === "all") potentialPointer = 0;
                else break;
              }
              const potentialIndex = tempShuffleHistory[potentialPointer];
              if (!isOffline || isSongDownloaded(queue[potentialIndex]._id)) {
                nextIndex = potentialIndex;
                tempShufflePointer = potentialPointer;
                break;
              }
              checkedCount++;
            }
          } else {
            let potentialIndex = currentIndex;
            for (let i = 0; i < queue.length; i++) {
              potentialIndex = (potentialIndex + 1) % queue.length;
              if (!isOffline || isSongDownloaded(queue[potentialIndex]._id)) {
                nextIndex = potentialIndex;
                break;
              }
              if (potentialIndex === currentIndex) break;
            }
            if (nextIndex <= currentIndex && repeatMode !== "all")
              nextIndex = -1;
          }

          if (
            nextIndex >= 0 &&
            repeatMode === "all" &&
            state.autoplayEnabled &&
            !isOffline &&
            state.currentSong &&
            nextIndex <= currentIndex
          ) {
            await handleQueueEnd();
            return;
          }

          if (nextIndex === -1) {
            if (
              repeatMode === "all" &&
              !(state.autoplayEnabled && !isOffline && state.currentSong)
            ) {
              toast(isOffline ? "No other downloaded songs." : "End of queue.");
              silentAudioService.pause();
              set({
                isPlaying: false,
                currentSong: null,
                currentIndex: -1,
                currentTime: 0,
              });
            } else {
              await handleQueueEnd();
            }
            return;
          }

          const nextSong = queue[nextIndex];
          const fullNextSong = await ensureSongData(nextSong);

          if (!fullNextSong || !fullNextSong.hlsUrl) {
            toast.error("Cannot load audio for next song");
            return;
          }

          silentAudioService.play();
          set({
            currentSong: fullNextSong,
            currentIndex: nextIndex,
            isPlaying: true,
            shuffleHistory: tempShuffleHistory,
            shufflePointer: tempShufflePointer,
            currentTime: 0,
            currentSongFromUserQueue: false,
          });

          enrichSongWithAlbumTitleIfNeeded(fullNextSong);

          const afterState = get();
          if (
            afterState.isAutoplayActive &&
            afterState.currentIndex >= afterState.queue.length - 3
          ) {
            void get().appendAutoplayTracks();
          }
        },

        playPrevious: async () => {
          const { currentTime } = get();
          if (currentTime > 3) {
            get().seekToTime(0);
            return;
          }
          if (get().repeatMode === "one") set({ repeatMode: "off" });

          const state = get();
          const {
            currentIndex,
            queue,
            shuffleHistory,
            shufflePointer,
            shuffleMode,
            repeatMode,
            playbackOrderIds,
            playbackPointer,
          } = state;
          const isShuffle = shuffleMode !== "off";
          const { isOffline } = useOfflineStore.getState();
          const { isSongDownloaded } = useOfflineStore.getState().actions;

          if (playbackOrderIds && playbackPointer >= 0) {
            let prevPtr = playbackPointer - 1;
            if (prevPtr < 0) {
              if (repeatMode === "all") prevPtr = playbackOrderIds.length - 1;
              else {
                get().seekToTime(0);
                return;
              }
            }

            let checked = 0;
            let resolvedPtr = -1;
            let fullPrevSong: Song | null = null;
            let ptr = prevPtr;

            while (checked < playbackOrderIds.length) {
              const prevId = playbackOrderIds[ptr];
              if (!isOffline || isSongDownloaded(prevId)) {
                fullPrevSong = await resolveSongForPlayback(
                  prevId,
                  queue,
                  queue,
                );
                if (fullPrevSong?.hlsUrl) {
                  resolvedPtr = ptr;
                  break;
                }
              }
              ptr--;
              if (ptr < 0) {
                if (repeatMode === "all") ptr = playbackOrderIds.length - 1;
                else break;
              }
              checked++;
            }

            if (resolvedPtr === -1 || !fullPrevSong) {
              get().seekToTime(0);
              return;
            }

            const newQueue = mergeSongIntoQueueCache(queue, fullPrevSong);
            silentAudioService.play();
            set({
              currentSong: fullPrevSong,
              isPlaying: true,
              playbackPointer: resolvedPtr,
              queue: newQueue,
              currentIndex: newQueue.findIndex(
                (s) => s._id === fullPrevSong._id,
              ),
              currentTime: 0,
              currentSongFromUserQueue: false,
            });
            enrichSongWithAlbumTitleIfNeeded(fullPrevSong);
            return;
          }

          if (queue.length === 0) {
            silentAudioService.pause();
            set({ isPlaying: false });
            return;
          }

          let tempShufflePointer = shufflePointer;
          let prevIndex = -1;

          if (isShuffle) {
            let checkedCount = 0;
            let potentialPointer = tempShufflePointer;
            while (checkedCount < shuffleHistory.length) {
              potentialPointer--;
              if (potentialPointer < 0) {
                if (repeatMode === "all")
                  potentialPointer = shuffleHistory.length - 1;
                else break;
              }
              const potentialIndex = shuffleHistory[potentialPointer];
              if (!isOffline || isSongDownloaded(queue[potentialIndex]._id)) {
                prevIndex = potentialIndex;
                tempShufflePointer = potentialPointer;
                break;
              }
              checkedCount++;
            }
          } else {
            let potentialIndex = currentIndex;
            for (let i = 0; i < queue.length; i++) {
              potentialIndex =
                (potentialIndex - 1 + queue.length) % queue.length;
              if (!isOffline || isSongDownloaded(queue[potentialIndex]._id)) {
                prevIndex = potentialIndex;
                break;
              }
              if (potentialIndex === currentIndex) break;
            }
            if (prevIndex >= currentIndex && repeatMode !== "all")
              prevIndex = -1;
          }

          if (prevIndex === -1) {
            toast(
              isOffline ? "No previous downloaded songs." : "Start of queue.",
            );
            get().seekToTime(0);
            return;
          }

          const prevSong = queue[prevIndex];
          const fullPrevSong = await ensureSongData(prevSong);

          if (!fullPrevSong || !fullPrevSong.hlsUrl) {
            toast.error("Cannot load audio for previous song");
            return;
          }

          silentAudioService.play();
          set({
            currentSong: fullPrevSong,
            currentIndex: prevIndex,
            isPlaying: true,
            shufflePointer: tempShufflePointer,
            currentTime: 0,
            currentSongFromUserQueue: false,
          });

          enrichSongWithAlbumTitleIfNeeded(fullPrevSong);
        },

        setRepeatMode: (mode) => {
          if (get().isAutoplayActive && mode !== "off") return;
          set({ repeatMode: mode });
        },
        setSmartShuffleRepeatMode: (mode) =>
          set({ smartShuffleRepeatMode: mode }),
        setIsFullScreenPlayerOpen: (isOpen: boolean) =>
          set({ isFullScreenPlayerOpen: isOpen }),
        setMasterVolume: (volume) => set({ masterVolume: volume }),
        setCurrentTime: (time, isPlayerUpdate = false) => {
          if (!isPlayerUpdate)
            set((state) => ({
              currentTime: time,
              seekVersion: state.seekVersion + 1,
            }));
          else set({ currentTime: time });
        },
        setDuration: (duration, originalDuration) =>
          set({
            duration,
            originalDuration:
              originalDuration !== undefined ? originalDuration : duration,
          }),
        setIsDesktopLyricsOpen: (isOpen: boolean) =>
          set({ isDesktopLyricsOpen: isOpen }),
        setIsMobileLyricsFullScreen: (isOpen: boolean) =>
          set({ isMobileLyricsFullScreen: isOpen }),
        seekToTime: (time: number) =>
          set((state) => ({
            currentTime: time,
            seekVersion: state.seekVersion + 1,
            isPlaying: true,
          })),
        setPlaybackContext: (context) => {
          const t = context
            ? normalizePlaybackContextType(context.type)
            : undefined;
          set({
            currentPlaybackContext:
              context && t
                ? {
                    type: t,
                    entityId: context.entityId,
                    entityTitle: context.entityTitle,
                    supportsSmartShuffle: context.supportsSmartShuffle,
                  }
                : null,
          });
        },
        removeFromQueue: (songId: string) => {
          set((state) => {
            const userQueueIndex = state.userQueue.findIndex(
              (song) => song._id === songId,
            );
            if (userQueueIndex !== -1) {
              const newUserQueue = state.userQueue.filter(
                (song) => song._id !== songId,
              );
              if (
                state.currentSong?._id === songId &&
                state.queue[state.currentIndex]?._id !== songId
              ) {
                queueMicrotask(() => void get().playNext());
              }
              return { userQueue: newUserQueue };
            }

            const songIndex = state.queue.findIndex(
              (song) => song._id === songId,
            );
            if (songIndex === -1) {
              if (state.currentSong?._id === songId) {
                queueMicrotask(() => void get().playNext());
              }
              return state;
            }
            const newQueue = state.queue.filter((song) => song._id !== songId);
            let newCurrentIndex = state.currentIndex;
            let newShuffleHistory = [...state.shuffleHistory];
            let newShufflePointer = state.shufflePointer;

            if (songIndex === state.currentIndex) {
              if (newQueue.length === 0) {
                silentAudioService.pause();
                return {
                  queue: [],
                  currentSong: null,
                  currentIndex: -1,
                  isPlaying: false,
                  shuffleHistory: [],
                  shufflePointer: -1,
                };
              } else {
                if (state.shuffleMode !== "off") {
                  if (newShufflePointer < newShuffleHistory.length - 1)
                    newShufflePointer++;
                  else newShufflePointer = 0;
                  newCurrentIndex = newShuffleHistory[newShufflePointer];
                } else {
                  newCurrentIndex = Math.min(
                    newCurrentIndex,
                    newQueue.length - 1,
                  );
                }
              }
            } else if (songIndex < state.currentIndex) {
              newCurrentIndex = state.currentIndex - 1;
            }

            if (state.shuffleMode !== "off") {
              const removedIndex = newShuffleHistory.indexOf(songIndex);
              if (removedIndex !== -1) {
                newShuffleHistory.splice(removedIndex, 1);
                newShuffleHistory = newShuffleHistory.map((idx) =>
                  idx > songIndex ? idx - 1 : idx,
                );
                if (removedIndex < newShufflePointer) newShufflePointer--;
              }
            }
            return {
              queue: newQueue,
              currentIndex: newCurrentIndex,
              currentSong:
                newQueue.length > 0 ? newQueue[newCurrentIndex] : null,
              shuffleHistory: newShuffleHistory,
              shufflePointer: newShufflePointer,
            };
          });
        },
        moveSongInQueue: (fromIndex: number, toIndex: number) => {
          set((state) => {
            if (
              fromIndex < 0 ||
              fromIndex >= state.queue.length ||
              toIndex < 0 ||
              toIndex >= state.queue.length
            )
              return state;
            const newQueue = [...state.queue];
            const [movedSong] = newQueue.splice(fromIndex, 1);
            newQueue.splice(toIndex, 0, movedSong);
            let newCurrentIndex = state.currentIndex;
            let newShuffleHistory = [...state.shuffleHistory];
            const newShufflePointer = state.shufflePointer;

            if (state.currentIndex === fromIndex) newCurrentIndex = toIndex;
            else if (
              fromIndex < state.currentIndex &&
              toIndex >= state.currentIndex
            )
              newCurrentIndex = state.currentIndex - 1;
            else if (
              fromIndex > state.currentIndex &&
              toIndex <= state.currentIndex
            )
              newCurrentIndex = state.currentIndex + 1;

            if (state.shuffleMode !== "off") {
              const fromShuffleIndex = newShuffleHistory.indexOf(fromIndex);
              if (fromShuffleIndex !== -1) {
                newShuffleHistory[fromShuffleIndex] = toIndex;
                newShuffleHistory = newShuffleHistory.map((idx) => {
                  if (fromIndex < toIndex) {
                    if (idx > fromIndex && idx <= toIndex) return idx - 1;
                  } else {
                    if (idx >= toIndex && idx < fromIndex) return idx + 1;
                  }
                  return idx;
                });
              }
            }
            return {
              queue: newQueue,
              currentIndex: newCurrentIndex,
              shuffleHistory: newShuffleHistory,
              shufflePointer: newShufflePointer,
            };
          });
        },
        clearQueue: () => {
          silentAudioService.pause();
          set({
            queue: [],
            userQueue: [],
            currentSong: null,
            currentIndex: -1,
            isPlaying: false,
            shuffleHistory: [],
            shufflePointer: -1,
            contextSourceSongIds: [],
            smartShuffleTrackIds: [],
            playbackOrderIds: null,
            playbackPointer: -1,
            currentSongFromUserQueue: false,
            isAutoplayActive: false,
            autoplayPlayedIds: [],
            autoplaySourceContext: null,
          });
        },
        addToQueue: (song: Song) =>
          set((state) => ({ queue: [...state.queue, song] })),
        addSongsToQueue: (songs: Song[]) =>
          set((state) => ({ queue: [...state.queue, ...songs] })),
        addToQueueNext: (song: Song) => {
          const state = get();

          if (state.currentSong?._id === song._id) {
            return "already-playing";
          }

          if (state.userQueue.some((s) => s._id === song._id)) {
            return "already-in-queue";
          }

          if (state.queue.length === 0 && state.currentIndex === -1) {
            void get().playAlbum([song]);
            return "started";
          }

          set((s) => ({ userQueue: [...s.userQueue, song] }));
          return "added";
        },
        moveSongInUserQueue: (fromIndex: number, toIndex: number) => {
          set((state) => {
            if (
              fromIndex < 0 ||
              fromIndex >= state.userQueue.length ||
              toIndex < 0 ||
              toIndex >= state.userQueue.length
            )
              return state;
            const newUserQueue = [...state.userQueue];
            const [movedSong] = newUserQueue.splice(fromIndex, 1);
            newUserQueue.splice(toIndex, 0, movedSong);
            return { userQueue: newUserQueue };
          });
        },
        clearUserQueue: () => set({ userQueue: [] }),
        promoteUpcomingToUserQueue: (songId: string, userIndex: number) => {
          set((state) => {
            const song =
              state.queue.find((s) => s._id === songId) ??
              state.userQueue.find((s) => s._id === songId);
            if (!song) return state;

            const without = state.userQueue.filter((s) => s._id !== songId);
            const clampedIndex = Math.max(
              0,
              Math.min(userIndex, without.length),
            );
            const newUserQueue = [...without];
            newUserQueue.splice(clampedIndex, 0, song);
            return { userQueue: newUserQueue };
          });
        },
        demoteUserQueueToUpcoming: (songId: string, beforeSongId: string) => {
          set((state) => {
            const song = state.userQueue.find((s) => s._id === songId);
            if (!song) return state;

            const newUserQueue = state.userQueue.filter(
              (s) => s._id !== songId,
            );
            let newQueue = [...state.queue];
            let newCurrentIndex = state.currentIndex;
            let newShuffleHistory = [...state.shuffleHistory];

            const beforeIndex = newQueue.findIndex(
              (s) => s._id === beforeSongId,
            );
            if (beforeIndex === -1) {
              return { userQueue: newUserQueue };
            }

            let fromIndex = newQueue.findIndex((s) => s._id === songId);

            if (fromIndex === -1) {
              newQueue.splice(beforeIndex, 0, song);
              const insertedIndex = beforeIndex;
              if (insertedIndex <= state.currentIndex) {
                newCurrentIndex = state.currentIndex + 1;
              }
              if (state.shuffleMode !== "off") {
                newShuffleHistory = newShuffleHistory.map((idx) =>
                  idx >= insertedIndex ? idx + 1 : idx,
                );
                const beforeShufflePos = newShuffleHistory.indexOf(
                  beforeIndex + 1,
                );
                if (beforeShufflePos !== -1) {
                  newShuffleHistory.splice(beforeShufflePos, 0, insertedIndex);
                } else {
                  newShuffleHistory.push(insertedIndex);
                }
              }
            } else if (state.shuffleMode !== "off") {
              const fromShuffleIndex = newShuffleHistory.indexOf(fromIndex);
              const beforeShuffleIndex = newShuffleHistory.indexOf(beforeIndex);
              if (fromShuffleIndex !== -1 && beforeShuffleIndex !== -1) {
                const [movedQueueIndex] = newShuffleHistory.splice(
                  fromShuffleIndex,
                  1,
                );
                const insertAt =
                  fromShuffleIndex < beforeShuffleIndex
                    ? beforeShuffleIndex - 1
                    : beforeShuffleIndex;
                newShuffleHistory.splice(insertAt, 0, movedQueueIndex);
              }
            } else {
              const [moved] = newQueue.splice(fromIndex, 1);
              let targetIndex = beforeIndex;
              if (fromIndex < beforeIndex) targetIndex = beforeIndex - 1;
              newQueue.splice(targetIndex, 0, moved);

              if (state.currentIndex === fromIndex) {
                newCurrentIndex = targetIndex;
              } else if (
                fromIndex < state.currentIndex &&
                targetIndex >= state.currentIndex
              ) {
                newCurrentIndex = state.currentIndex - 1;
              } else if (
                fromIndex > state.currentIndex &&
                targetIndex <= state.currentIndex
              ) {
                newCurrentIndex = state.currentIndex + 1;
              }
            }

            return {
              userQueue: newUserQueue,
              queue: newQueue,
              currentIndex: newCurrentIndex,
              shuffleHistory: newShuffleHistory,
            };
          });
        },
        getNextSongsInShuffle: (count = 10) => {
          const state = get();
          if (state.queue.length === 0) return [];
          const {
            repeatMode,
            currentIndex,
            queue,
            shuffleHistory,
            shufflePointer,
          } = state;
          const isShuffle = state.shuffleMode !== "off";

          if (repeatMode === "one")
            return [queue[currentIndex]].filter(Boolean);

          if (!isShuffle) {
            if (repeatMode === "all") {
              const nextSongs: Song[] = [];
              for (let i = 0; i < count; i++) {
                const index = (currentIndex + 1 + i) % queue.length;
                nextSongs.push(queue[index]);
              }
              return nextSongs;
            } else {
              return queue.slice(currentIndex + 1, currentIndex + 1 + count);
            }
          }

          const nextSongs: Song[] = [];
          const usedSongIds = new Set<string>();

          if (repeatMode === "all") {
            let currentPointer = shufflePointer;
            let attempts = 0;
            const maxAttempts = shuffleHistory.length * 2;
            while (nextSongs.length < count && attempts < maxAttempts) {
              currentPointer = (currentPointer + 1) % shuffleHistory.length;
              const songIndex = shuffleHistory[currentPointer];
              if (songIndex < queue.length) {
                const song = queue[songIndex];
                if (!usedSongIds.has(song._id)) {
                  nextSongs.push(song);
                  usedSongIds.add(song._id);
                }
              }
              attempts++;
            }
          } else {
            let currentPointer = shufflePointer;
            let attempts = 0;
            const maxAttempts = shuffleHistory.length;
            while (
              nextSongs.length < count &&
              nextSongs.length < queue.length - 1 &&
              attempts < maxAttempts
            ) {
              currentPointer = (currentPointer + 1) % shuffleHistory.length;
              const songIndex = shuffleHistory[currentPointer];
              if (songIndex < queue.length) {
                const song = queue[songIndex];
                if (!usedSongIds.has(song._id)) {
                  nextSongs.push(song);
                  usedSongIds.add(song._id);
                }
              }
              attempts++;
            }
          }
          return nextSongs;
        },
      };
    },
    {
      name: "moodify-player-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentSong: state.currentSong
          ? stripLyricsForPersistence(state.currentSong)
          : null,
        isPlaying: state.isPlaying,
        queue: state.queue.map(stripLyricsForPersistence),
        userQueue: state.userQueue.map(stripLyricsForPersistence),
        currentIndex: state.currentIndex,
        repeatMode: state.repeatMode,
        shuffleMode: state.shuffleMode,
        smartShuffleRepeatMode: state.smartShuffleRepeatMode,
        autoplayEnabled: state.autoplayEnabled,
        isShuffle: state.isShuffle,
        shuffleHistory: state.shuffleHistory,
        shufflePointer: state.shufflePointer,
        masterVolume: state.masterVolume,
      }),
      onRehydrateStorage: () => {
        return (persistedState, error) => {
          if (error) console.log("an error happened during rehydration", error);
          if (persistedState) {
            persistedState.isPlaying = false;
            persistedState.isFullScreenPlayerOpen = false;
            persistedState.currentTime = 0;
            if (isMobileDevice()) persistedState.masterVolume = 100;
          }
          queueMicrotask(() => {
            void usePlayerStore.getState().hydrateCurrentSong();
          });
        };
      },
    },
  ),
);
