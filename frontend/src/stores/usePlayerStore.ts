import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Song } from "../types";
// import { useChatStore } from "./useChatStore"; // Этот импорт больше не нужен здесь для socket.emit
// import { useAuthStore } from "./useAuthStore"; // Этот импорт больше не нужен здесь для socket.emit

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
  setRepeatMode: (mode: "off" | "all" | "one") => void;

  toggleShuffle: () => void;

  initializeQueue: (songs: Song[]) => void;

  playAlbum: (songs: Song[], startIndex?: number) => void;

  setCurrentSong: (song: Song | null) => void;

  togglePlay: () => void;

  playNext: () => void;

  playPrevious: () => void;

  setIsFullScreenPlayerOpen: (isOpen: boolean) => void;
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
    (set, get) => ({
      currentSong: null,
      isPlaying: false,
      queue: [],
      currentIndex: -1,
      repeatMode: "off",

      isShuffle: false,

      shuffleHistory: [],
      shufflePointer: -1,

      isFullScreenPlayerOpen: false,

      initializeQueue: (songs: Song[]) => {
        set({
          queue: songs,
          currentSong: get().currentSong || songs[0],
          currentIndex: get().currentIndex === -1 ? 0 : get().currentIndex,
          shuffleHistory: [],
          shufflePointer: -1,
        });
      },

      playAlbum: (songs: Song[], startIndex = 0) => {
        if (songs.length === 0) return;

        const isShuffle = get().isShuffle;
        // const { user: authUser } = useAuthStore.getState(); // Больше не нужно
        // const currentUserId = authUser?.id; // Больше не нужно

        if (isShuffle) {
          const newShuffleHistory = shuffleQueue(songs.length);

          const currentIndex = startIndex;

          const currentPosInShuffle = newShuffleHistory.indexOf(currentIndex);

          if (currentPosInShuffle !== -1) {
            [newShuffleHistory[0], newShuffleHistory[currentPosInShuffle]] = [
              newShuffleHistory[currentPosInShuffle],
              newShuffleHistory[0],
            ];
          } else {
            newShuffleHistory.unshift(currentIndex);
            newShuffleHistory.pop();
          }

          const firstIndex = newShuffleHistory[0];
          const firstSong = songs[firstIndex];

          // const socket = useChatStore.getState().socket; // Больше не нужно
          // if (currentUserId && socket.connected) {
          //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
          //     userId: currentUserId,
          //     activity: `${firstSong.title}   ${firstSong.artist}`,
          //   });
          // }

          set({
            queue: songs,
            currentSong: firstSong,
            currentIndex: firstIndex,
            isPlaying: true,
            shuffleHistory: newShuffleHistory,
            shufflePointer: 0,
          });
        } else {
          const song = songs[startIndex];

          // const socket = useChatStore.getState().socket; // Больше не нужно
          // if (currentUserId && socket.connected) {
          //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
          //     userId: currentUserId,
          //     activity: `${song.title}   ${song.artist}`,
          //   });
          // }

          set({
            queue: songs,
            currentSong: song,
            currentIndex: startIndex,
            isPlaying: true,
            shuffleHistory: [],
            shufflePointer: -1,
          });
        }
      },

      setCurrentSong: (song: Song | null) => {
        if (!song) return;

        // const { user: authUser } = useAuthStore.getState(); // Больше не нужно
        // const currentUserId = authUser?.id; // Больше не нужно

        // const socket = useChatStore.getState().socket; // Больше не нужно
        // if (currentUserId && socket.connected) {
        //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
        //     userId: currentUserId,
        //     activity: `${song.title}   ${song.artist}`,
        //   });
        // }

        const songIndex = get().queue.findIndex((s) => s._id === song._id);

        set({
          currentSong: song,
          isPlaying: true,
          currentIndex: songIndex !== -1 ? songIndex : get().currentIndex,
        });
      },

      togglePlay: () => {
        const willStartPlaying = !get().isPlaying;

        // const currentSong = get().currentSong; // Больше не нужно здесь для socket.emit
        // const { user: authUser } = useAuthStore.getState(); // Больше не нужно
        // const currentUserId = authUser?.id; // Больше не нужно

        // const socket = useChatStore.getState().socket; // Больше не нужно
        // if (currentUserId && socket.connected) {
        //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
        //     userId: currentUserId,
        //     activity:
        //       willStartPlaying && currentSong
        //         ? ` ${currentSong.title}   ${currentSong.artist}`
        //         : "Idle",
        //   });
        // }

        set({
          isPlaying: willStartPlaying,
        });
      },

      toggleShuffle: () => {
        set((state) => {
          if (state.isShuffle) {
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

            const currentIndex =
              state.currentIndex >= 0 ? state.currentIndex : 0;

            const currentPosInShuffle = newShuffleHistory.indexOf(currentIndex);
            if (currentPosInShuffle !== -1) {
              [newShuffleHistory[0], newShuffleHistory[currentPosInShuffle]] = [
                newShuffleHistory[currentPosInShuffle],
                newShuffleHistory[0],
              ];
            } else {
              newShuffleHistory.unshift(currentIndex);
              newShuffleHistory.pop();
            }

            return {
              isShuffle: true,
              shuffleHistory: newShuffleHistory,
              shufflePointer: 0,
            };
          }
        });
      },

      playNext: () => {
        const {
          currentIndex,
          queue,
          repeatMode,
          isShuffle,
          shuffleHistory,
          shufflePointer,
        } = get();

        // const { user: authUser } = useAuthStore.getState(); // Больше не нужно
        // const currentUserId = authUser?.id; // Больше не нужно

        if (repeatMode === "one") {
          set({ repeatMode: "all" });
        }

        if (isShuffle) {
          if (shufflePointer < shuffleHistory.length - 1) {
            const nextPointer = shufflePointer + 1;
            const nextIndex = shuffleHistory[nextPointer];

            const nextSong = queue[nextIndex];
            // const socket = useChatStore.getState().socket; // Больше не нужно
            // if (currentUserId && socket.connected) {
            //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
            //     userId: currentUserId,
            //     activity: `${nextSong.title}   ${nextSong.artist}`,
            //   });
            // }

            set({
              currentSong: nextSong,
              currentIndex: nextIndex,
              isPlaying: true,
              shufflePointer: nextPointer,
            });
          } else {
            if (repeatMode === "off") {
              set({ isPlaying: false });
              // const socket = useChatStore.getState().socket; // Больше не нужно
              // if (currentUserId && socket.connected) {
              //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
              //     userId: currentUserId,
              //     activity: "Idle",
              //   });
              // }
            } else {
              const newShuffleHistory = shuffleQueue(queue.length);
              const firstIndex = newShuffleHistory[0];
              const firstSong = queue[firstIndex];

              // const socket = useChatStore.getState().socket; // Больше не нужно
              // if (currentUserId && socket.connected) {
              //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
              //     userId: currentUserId,
              //     activity: `${firstSong.title}   ${firstSong.artist}`,
              //   });
              // }

              set({
                currentSong: firstSong,
                currentIndex: firstIndex,
                isPlaying: true,
                shuffleHistory: newShuffleHistory,
                shufflePointer: 0,
              });
            }
          }
        } else {
          let nextIndex = currentIndex + 1;
          if (nextIndex >= queue.length) {
            if (repeatMode === "all") {
              nextIndex = 0;
            } else {
              set({ isPlaying: false });
              // const socket = useChatStore.getState().socket; // Больше не нужно
              // if (currentUserId && socket.connected) {
              //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
              //     userId: currentUserId,
              //     activity: "Idle",
              //   });
              // }
              return;
            }
          }

          const nextSong = queue[nextIndex];

          // const socket = useChatStore.getState().socket; // Больше не нужно
          // if (currentUserId && socket.connected) {
          //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
          //     userId: currentUserId,
          //     activity: `${nextSong.title}   ${nextSong.artist}`,
          //   });
          // }

          set({
            currentSong: nextSong,
            currentIndex: nextIndex,
            isPlaying: true,
          });
        }
      },

      playPrevious: () => {
        const {
          currentIndex,
          queue,
          repeatMode,
          isShuffle,
          shuffleHistory,
          shufflePointer,
        } = get();

        // const { user: authUser } = useAuthStore.getState(); // Больше не нужно
        // const currentUserId = authUser?.id; // Больше не нужно

        if (repeatMode === "one") {
          set({ repeatMode: "all" });
        }

        if (isShuffle) {
          if (shufflePointer > 0) {
            const prevPointer = shufflePointer - 1;
            const prevIndex = shuffleHistory[prevPointer];

            const prevSong = queue[prevIndex];
            // const socket = useChatStore.getState().socket; // Больше не нужно
            // if (currentUserId && socket.connected) {
            //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
            //     userId: currentUserId,
            //     activity: `${prevSong.title}   ${prevSong.artist}`,
            //   });
            // }

            set({
              currentSong: prevSong,
              currentIndex: prevIndex,
              isPlaying: true,
              shufflePointer: prevPointer,
            });
          } else {
            set({ isPlaying: false });
            // const socket = useChatStore.getState().socket; // Больше не нужно
            // if (currentUserId && socket.connected) {
            //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
            //     userId: currentUserId,
            //     activity: "Idle",
            //   });
            // }
          }
        } else {
          let prevIndex = currentIndex - 1;
          if (prevIndex < 0) {
            if (repeatMode === "all") {
              prevIndex = queue.length - 1;
            } else {
              set({ isPlaying: false });
              // const socket = useChatStore.getState().socket; // Больше не нужно
              // if (currentUserId && socket.connected) {
              //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
              //     userId: currentUserId,
              //     activity: "Idle",
              //   });
              // }
              return;
            }
          }

          const prevSong = queue[prevIndex];

          // const socket = useChatStore.getState().socket; // Больше не нужно
          // if (currentUserId && socket.connected) {
          //   socket.emit("update_activity", { // ЭТОТ ВЫЗОВ УДАЛЕН
          //     userId: currentUserId,
          //     activity: `${prevSong.title}   ${prevSong.artist}`,
          //   });
          // }

          set({
            currentSong: prevSong,
            currentIndex: prevIndex,
            isPlaying: true,
          });
        }
      },

      setRepeatMode: (mode) => set({ repeatMode: mode }),

      setIsFullScreenPlayerOpen: (isOpen: boolean) =>
        set({ isFullScreenPlayerOpen: isOpen }),
    }),
    {
      name: "music-player-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentSong: state.currentSong,
        isPlaying: state.isPlaying,
        queue: state.queue,
        currentIndex: state.currentIndex,
        repeatMode: state.repeatMode,
        isShuffle: state.isShuffle,
        shuffleHistory: state.shuffleHistory,
        shufflePointer: state.shufflePointer,
      }),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onRehydrateStorage: (_state) => {
        return (persistedState, error) => {
          if (error) {
            console.log("an error happened during rehydration", error);
          }
          if (persistedState) {
            // АГРЕССИВНО СБРАСЫВАЕМ currentSong, чтобы принудительно загрузить свежие данные
            persistedState.currentSong = null; // <-- НОВОЕ КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ
            persistedState.isPlaying = false;
            persistedState.isFullScreenPlayerOpen = false;
          }
        };
      },
    }
  )
);
