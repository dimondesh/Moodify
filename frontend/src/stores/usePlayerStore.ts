/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Song } from "../types";
import toast from "react-hot-toast";
import { useOfflineStore } from "./useOfflineStore";
import { silentAudioService } from "@/lib/silentAudioService";
import { axiosInstance } from "@/lib/axios";
import { getUserItem } from "@/lib/offline-db";
import { useAuthStore } from "./useAuthStore";

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
  "moodify-player-storage"
);

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
    type: "song" | "album" | "playlist" | "artist" | "liked-songs";
    entityId?: string;
    entityTitle?: string;
  } | null;
  shuffleMode: "off" | "regular" | "smart";

  setRepeatMode: (mode: "off" | "all" | "one") => void;
  toggleShuffle: () => void;
  initializeQueue: (songs: Song[]) => void;
  generateSmartTracks: () => Promise<void>;
  playAlbum: (
    songs: Song[],
    startIndex?: number,
    context?: { type: string; entityId?: string; entityTitle?: string },
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
    context: { type: string; entityId?: string; entityTitle?: string } | null,
  ) => void;
  removeFromQueue: (songId: string) => void;
  moveSongInQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  addToQueue: (song: Song) => void;
  addSongsToQueue: (songs: Song[]) => void;
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
    raw === "artist" ||
    raw === "liked-songs"
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
          const response = await axiosInstance.get(`/albums/${song.albumId}`);
          const albumTitle = response.data.album?.title;
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
        if (song.hlsUrl) return song;

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
          const response = await axiosInstance.get(`/songs/${song._id}`);
          const fullData = response.data;

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
                : fullData.artist ?? song.artist,
          };

          // Обновляем песню в очереди, чтобы данные закэшировались локально
          set((state) => ({
            queue: state.queue.map((s) =>
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

      return {
        currentSong: null,
        isPlaying: false,
        isFetchingLyrics: false,
        queue: [],
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

            if (state.isShuffle && newQueue.length > 0) {
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
        },

        playAlbum: async (songs: Song[], startIndex = 0, context) => {
          if (songs.length === 0) {
            silentAudioService.pause();
            set({
              currentSong: null,
              isPlaying: false,
              queue: [],
              currentIndex: -1,
              shuffleHistory: [],
              shufflePointer: -1,
            });
            return;
          }

          let targetIndexInQueue = startIndex;
          let newShuffleHistory: number[] = [];
          let newShufflePointer: number = -1;

          if (get().shuffleMode !== "off") {
            newShuffleHistory = shuffleQueue(songs.length);
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

          // eslint-disable-next-line prefer-const
          let songToPlay = songs[targetIndexInQueue];
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

          // Подменяем минимальную песню на полную в очереди перед записью в стейт
          const updatedQueue = [...songs];
          updatedQueue[targetIndexInQueue] = fullSong;

          const normalizedType = context
            ? normalizePlaybackContextType(context.type)
            : undefined;

          set({
            queue: updatedQueue,
            isPlaying: true,
            currentSong: fullSong,
            currentIndex: targetIndexInQueue,
            shuffleHistory: newShuffleHistory,
            shufflePointer: newShufflePointer,
            currentTime: 0,
            currentPlaybackContext:
              context && normalizedType
                ? {
                    type: normalizedType,
                    entityId: context.entityId,
                    entityTitle: context.entityTitle,
                  }
                : null,
          });

          enrichSongWithAlbumTitleIfNeeded(fullSong);

          if (get().shuffleMode === "smart") {
            get().generateSmartTracks();
          }
        },

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
            };
          });

          enrichSongWithAlbumTitleIfNeeded(fullSong);

          if (get().shuffleMode === "smart") {
            get().generateSmartTracks();
          }
        },

        togglePlay: () => {
          set((state) => {
            const newIsPlaying = !state.isPlaying;
            if (newIsPlaying && state.currentSong) {
              silentAudioService.play();
            } else {
              silentAudioService.pause();
            }
            return { isPlaying: newIsPlaying };
          });
        },

        toggleShuffle: () => {
          set((state) => {
            if (state.shuffleMode === "off") {
              const queueLength = state.queue.length;
              if (queueLength === 0)
                return {
                  shuffleMode: "regular",
                  shuffleHistory: [],
                  shufflePointer: -1,
                };
              const newShuffleHistory = shuffleQueue(queueLength);
              const currentIndex = state.currentIndex;
              if (currentIndex !== -1) {
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
              }
              return {
                shuffleMode: "regular",
                shuffleHistory: newShuffleHistory,
                shufflePointer: currentIndex !== -1 ? 0 : -1,
              };
            } else if (state.shuffleMode === "regular") {
              get().generateSmartTracks();
              return { shuffleMode: "smart" };
            } else {
              return {
                shuffleMode: "off",
                shuffleHistory: [],
                shufflePointer: -1,
              };
            }
          });
        },

        generateSmartTracks: async () => {
          const state = get();
          if (!state.currentSong) return;
          try {
            const response = await axiosInstance.get(
              `/songs/${state.currentSong._id}/radio`,
            );
            const vibeTracks = response.data;
            if (vibeTracks && vibeTracks.length > 0) {
              set((currentState) => {
                const newQueue = [...currentState.queue, ...vibeTracks];
                const startIndex = currentState.queue.length;
                const newIndices = Array.from(
                  { length: vibeTracks.length },
                  (_, i) => startIndex + i,
                );
                const playedHistory = currentState.shuffleHistory.slice(
                  0,
                  currentState.shufflePointer + 1,
                );
                const newShuffleHistory = [...playedHistory, ...newIndices];
                return { queue: newQueue, shuffleHistory: newShuffleHistory };
              });
            }
          } catch (error) {
            console.error("Smart shuffle error:", error);
          }
        },

        playNext: async () => {
          if (get().repeatMode === "one") set({ repeatMode: "off" });

          const state = get();
          const {
            queue,
            shuffleHistory,
            shufflePointer,
            currentIndex,
            shuffleMode,
            repeatMode,
          } = state;
          const isShuffle = shuffleMode !== "off";
          const { isOffline } = useOfflineStore.getState();
          const { isSongDownloaded } = useOfflineStore.getState().actions;

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

          if (nextIndex === -1) {
            toast(isOffline ? "No other downloaded songs." : "End of queue.");
            silentAudioService.pause();
            set({
              isPlaying: false,
              currentSong: null,
              currentIndex: -1,
              currentTime: 0,
            });
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
          });

          enrichSongWithAlbumTitleIfNeeded(fullNextSong);

          if (
            shuffleMode === "smart" &&
            tempShufflePointer >= tempShuffleHistory.length - 3
          ) {
            get().generateSmartTracks();
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
          } = state;
          const isShuffle = shuffleMode !== "off";
          const { isOffline } = useOfflineStore.getState();
          const { isSongDownloaded } = useOfflineStore.getState().actions;

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
          });

          enrichSongWithAlbumTitleIfNeeded(fullPrevSong);
        },

        setRepeatMode: (mode) => set({ repeatMode: mode }),
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
                  }
                : null,
          });
        },
        removeFromQueue: (songId: string) => {
          set((state) => {
            const songIndex = state.queue.findIndex(
              (song) => song._id === songId,
            );
            if (songIndex === -1) return state;
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
                if (state.isShuffle) {
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

            if (state.isShuffle) {
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

            if (state.isShuffle) {
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
            currentSong: null,
            currentIndex: -1,
            isPlaying: false,
            shuffleHistory: [],
            shufflePointer: -1,
          });
        },
        addToQueue: (song: Song) =>
          set((state) => ({ queue: [...state.queue, song] })),
        addSongsToQueue: (songs: Song[]) =>
          set((state) => ({ queue: [...state.queue, ...songs] })),
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
          ? { ...state.currentSong, lyrics: state.currentSong.lyrics }
          : null,
        isPlaying: state.isPlaying,
        queue: state.queue.map((song) => ({ ...song, lyrics: song.lyrics })),
        currentIndex: state.currentIndex,
        repeatMode: state.repeatMode,
        shuffleMode: state.shuffleMode,
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
        };
      },
    },
  ),
);
