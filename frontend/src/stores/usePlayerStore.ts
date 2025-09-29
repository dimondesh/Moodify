// src/stores/usePlayerStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Song } from "../types";
import toast from "react-hot-toast";
import { useOfflineStore } from "./useOfflineStore";
import { silentAudioService } from "@/lib/silentAudioService";
import { axiosInstance } from "@/lib/axios";

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
  isMobileLyricsFullScreen: boolean;
  originalDuration: number;
  seekVersion: number;
  currentPlaybackContext: {
    type:
      | "song"
      | "album"
      | "playlist"
      | "generated-playlist"
      | "mix"
      | "artist";
    entityId?: string;
    entityTitle?: string;
  } | null;

  setRepeatMode: (mode: "off" | "all" | "one") => void;
  toggleShuffle: () => void;
  initializeQueue: (songs: Song[]) => void;
  playAlbum: (
    songs: Song[],
    startIndex?: number,
    context?: { type: string; entityId?: string; entityTitle?: string }
  ) => void;
  setCurrentSong: (song: Song | null) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  setIsFullScreenPlayerOpen: (isOpen: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setCurrentTime: (time: number, isPlayerUpdate?: boolean) => void;
  setDuration: (duration: number, originalDuration?: number) => void;
  setIsDesktopLyricsOpen: (isOpen: boolean) => void;
  setIsMobileLyricsFullScreen: (isOpen: boolean) => void;
  seekToTime: (time: number) => void;
  setPlaybackContext: (
    context: { type: string; entityId?: string; entityTitle?: string } | null
  ) => void;
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
        ) {
          return;
        }

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
            error
          );
        }
      };

      const enrichSongWithLyricsIfNeeded = async (song: Song) => {
        if (song.lyrics || useOfflineStore.getState().isOffline) {
          return;
        }

        try {
          const response = await axiosInstance.get(`/songs/${song._id}`);
          const lyrics = response.data.song?.lyrics;

          if (lyrics && get().currentSong?._id === song._id) {
            set((state) => ({
              currentSong: { ...state.currentSong!, lyrics },
            }));
          }
        } catch (error) {
          console.warn(`Could not fetch lyrics for song ${song._id}`, error);
        }
      };

      return {
        currentSong: null,
        isPlaying: false,
        queue: [],
        currentIndex: -1,
        repeatMode: "off",
        isShuffle: false,
        shuffleHistory: [],
        shufflePointer: -1,
        isFullScreenPlayerOpen: false,
        masterVolume: 75,
        currentPlaybackContext: null,
        currentTime: 0,
        duration: 0,
        originalDuration: 0,
        seekVersion: 0,

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

        playAlbum: (
          songs: Song[],
          startIndex = 0,
          context?: { type: string; entityId?: string; entityTitle?: string }
        ) => {
          if (songs.length === 0) {
            console.log("No songs, stopping playback");
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

          // Проверяем, что у первой песни есть hlsUrl
          if (!songs[0]?.hlsUrl) {
            console.error(
              "First song has no hlsUrl, cannot start playback:",
              songs[0]
            );
            toast.error("Cannot start playback: missing audio file");
            return;
          }

          silentAudioService.play();

          set((state) => {
            const isShuffle = state.isShuffle;
            let songToPlay: Song;
            let targetIndexInQueue: number;
            let newShuffleHistory: number[] = [];
            let newShufflePointer: number = -1;

            if (isShuffle) {
              newShuffleHistory = shuffleQueue(songs.length);
              const currentPosInShuffle = newShuffleHistory.indexOf(startIndex);
              if (currentPosInShuffle !== -1) {
                [newShuffleHistory[0], newShuffleHistory[currentPosInShuffle]] =
                  [
                    newShuffleHistory[currentPosInShuffle],
                    newShuffleHistory[0],
                  ];
              } else {
                newShuffleHistory.unshift(startIndex);
                newShuffleHistory.pop();
              }
              newShufflePointer = 0;
              targetIndexInQueue = newShuffleHistory[newShufflePointer];
              songToPlay = songs[targetIndexInQueue];
            } else {
              targetIndexInQueue = startIndex;
              songToPlay = songs[targetIndexInQueue];
              newShuffleHistory = [];
              newShufflePointer = -1;
            }

            enrichSongWithAlbumTitleIfNeeded(songToPlay);
            enrichSongWithLyricsIfNeeded(songToPlay);

            return {
              queue: songs,
              isPlaying: true,
              currentSong: songToPlay,
              currentIndex: targetIndexInQueue,
              shuffleHistory: newShuffleHistory,
              shufflePointer: newShufflePointer,
              currentTime: 0,
              currentPlaybackContext: context
                ? {
                    type: context.type as
                      | "song"
                      | "album"
                      | "playlist"
                      | "generated-playlist"
                      | "mix"
                      | "artist",
                    entityId: context.entityId,
                    entityTitle: context.entityTitle,
                  }
                : null,
            };
          });
        },

        setCurrentSong: (song: Song | null) => {
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

          // Проверяем, что у песни есть hlsUrl
          if (!song.hlsUrl) {
            console.error("Song has no hlsUrl, cannot start playback:", song);
            toast.error("Cannot start playback: missing audio file");
            return;
          }

          silentAudioService.play();

          set((state) => {
            const songIndex = state.queue.findIndex((s) => s._id === song._id);
            let newShufflePointer = state.shufflePointer;
            let newShuffleHistory = state.shuffleHistory;

            if (state.isShuffle) {
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

            enrichSongWithAlbumTitleIfNeeded(song);
            enrichSongWithLyricsIfNeeded(song);

            return {
              currentSong: song,
              isPlaying: true,
              currentIndex: songIndex !== -1 ? songIndex : state.currentIndex,
              shuffleHistory: newShuffleHistory,
              shufflePointer: newShufflePointer,
              currentTime: 0,
            };
          });
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
            const newShuffleMode = !state.isShuffle;
            if (!newShuffleMode) {
              return {
                isShuffle: false,
                shuffleHistory: [],
                shufflePointer: -1,
              };
            } else {
              const queueLength = state.queue.length;
              if (queueLength === 0) {
                return {
                  isShuffle: true,
                  shuffleHistory: [],
                  shufflePointer: -1,
                };
              }

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
                isShuffle: true,
                shuffleHistory: newShuffleHistory,
                shufflePointer: currentIndex !== -1 ? 0 : -1,
              };
            }
          });
        },

        playNext: () => {
          if (get().repeatMode === "one") {
            set({ repeatMode: "off" });
          }

          const {
            queue,
            isShuffle,
            shuffleHistory,
            shufflePointer,
            currentIndex,
          } = get();
          const repeatMode = get().repeatMode;

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
                if (repeatMode === "all") {
                  potentialPointer = 0;
                } else {
                  break;
                }
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
            if (nextIndex <= currentIndex && repeatMode !== "all") {
              nextIndex = -1;
            }
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

          silentAudioService.play();
          set({
            currentSong: nextSong,
            currentIndex: nextIndex,
            isPlaying: true,
            shuffleHistory: tempShuffleHistory,
            shufflePointer: tempShufflePointer,
            currentTime: 0,
          });

          enrichSongWithAlbumTitleIfNeeded(nextSong);
          enrichSongWithLyricsIfNeeded(nextSong);
        },

        playPrevious: () => {
          const { currentTime } = get();

          if (currentTime > 3) {
            get().seekToTime(0);
            return;
          }
          if (get().repeatMode === "one") {
            set({ repeatMode: "off" });
          }

          const {
            currentIndex,
            queue,
            isShuffle,
            shuffleHistory,
            shufflePointer,
          } = get();
          const repeatMode = get().repeatMode;

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
                if (repeatMode === "all") {
                  potentialPointer = shuffleHistory.length - 1;
                } else {
                  break;
                }
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
            if (prevIndex >= currentIndex && repeatMode !== "all") {
              prevIndex = -1;
            }
          }

          if (prevIndex === -1) {
            toast(
              isOffline ? "No previous downloaded songs." : "Start of queue."
            );
            get().seekToTime(0);
            return;
          }

          const prevSong = queue[prevIndex];
          silentAudioService.play();
          set({
            currentSong: prevSong,
            currentIndex: prevIndex,
            isPlaying: true,
            shufflePointer: tempShufflePointer,
            currentTime: 0,
          });

          enrichSongWithAlbumTitleIfNeeded(prevSong);
          enrichSongWithLyricsIfNeeded(prevSong);
        },

        setRepeatMode: (mode) => set({ repeatMode: mode }),
        setIsFullScreenPlayerOpen: (isOpen: boolean) =>
          set({ isFullScreenPlayerOpen: isOpen }),
        setMasterVolume: (volume) => set({ masterVolume: volume }),

        setCurrentTime: (time, isPlayerUpdate = false) => {
          if (!isPlayerUpdate) {
            set((state) => ({
              currentTime: time,
              seekVersion: state.seekVersion + 1,
            }));
          } else {
            set({ currentTime: time });
          }
        },
        setDuration: (duration, originalDuration) => {
          set({
            duration: duration,
            originalDuration:
              originalDuration !== undefined ? originalDuration : duration,
          });
        },
        setIsDesktopLyricsOpen: (isOpen: boolean) =>
          set({ isDesktopLyricsOpen: isOpen }),
        setIsMobileLyricsFullScreen: (isOpen: boolean) => {
          set({ isMobileLyricsFullScreen: isOpen });
        },
        seekToTime: (time: number) => {
          set((state) => ({
            currentTime: time,
            seekVersion: state.seekVersion + 1,
            isPlaying: true,
          }));
        },

        setPlaybackContext: (
          context: {
            type: string;
            entityId?: string;
            entityTitle?: string;
          } | null
        ) => {
          set({
            currentPlaybackContext: context
              ? {
                  type: context.type as
                    | "song"
                    | "album"
                    | "playlist"
                    | "generated-playlist"
                    | "mix"
                    | "artist",
                  entityId: context.entityId,
                  entityTitle: context.entityTitle,
                }
              : null,
          });
        },
      };
    },
    {
      name: "moodify-studio-player-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentSong: state.currentSong
          ? {
              ...state.currentSong,
              lyrics: state.currentSong.lyrics,
            }
          : null,
        isPlaying: state.isPlaying,
        queue: state.queue.map((song) => ({
          ...song,
          lyrics: song.lyrics,
        })),
        currentIndex: state.currentIndex,
        repeatMode: state.repeatMode,
        isShuffle: state.isShuffle,
        shuffleHistory: state.shuffleHistory,
        shufflePointer: state.shufflePointer,
        masterVolume: state.masterVolume,
      }),
      onRehydrateStorage: () => {
        return (persistedState, error) => {
          if (error) {
            console.log("an error happened during rehydration", error);
          }
          if (persistedState) {
            persistedState.isPlaying = false;
            persistedState.isFullScreenPlayerOpen = false;
            persistedState.currentTime = 0;
          }
        };
      },
    }
  )
);
