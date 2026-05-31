import type { Song } from "@/types";
import { usePlayerStore } from "@/stores/usePlayerStore";

export const USER_QUEUE_DROP_ID = "user-queue-drop";

export interface QueueSections {
  current: Song | null;
  userAdded: Song[];
  upcoming: Song[];
}

function getRegularUpcomingSongs(params: {
  queue: Song[];
  currentIndex: number;
  repeatMode: "off" | "all" | "one";
  isShuffle: boolean;
  shuffleHistory: number[];
  shufflePointer: number;
  getNextSongsInShuffle: (count?: number) => Song[];
}): Song[] {
  const {
    queue,
    currentIndex,
    repeatMode,
    isShuffle,
    shuffleHistory,
    shufflePointer,
    getNextSongsInShuffle,
  } = params;

  const current = queue[currentIndex];
  if (!current) return [];

  if (isShuffle) {
    if (shuffleHistory.length === 0) {
      return getNextSongsInShuffle(queue.length).filter(
        (song) => song._id !== current._id,
      );
    }

    const upcoming: Song[] = [];
    const usedIds = new Set<string>([current._id]);

    let pointer = shufflePointer;
    for (let i = 0; i < shuffleHistory.length - 1; i++) {
      pointer = (pointer + 1) % shuffleHistory.length;
      const songIndex = shuffleHistory[pointer];
      if (songIndex >= 0 && songIndex < queue.length) {
        const song = queue[songIndex];
        if (!usedIds.has(song._id)) {
          upcoming.push(song);
          usedIds.add(song._id);
        }
      }
    }

    return upcoming;
  }

  if (repeatMode === "all") {
    return [
      ...queue.slice(currentIndex + 1),
      ...queue.slice(0, currentIndex),
    ];
  }

  return queue.slice(currentIndex + 1);
}

export function getQueueSections(params: {
  queue: Song[];
  userQueue: Song[];
  currentSong: Song | null;
  currentIndex: number;
  repeatMode: "off" | "all" | "one";
  isShuffle: boolean;
  shuffleHistory: number[];
  shufflePointer: number;
  getNextSongsInShuffle: (count?: number) => Song[];
  playbackOrderIds?: string[] | null;
  playbackPointer?: number;
}): QueueSections {
  const {
    queue,
    userQueue,
    currentSong,
    currentIndex,
    repeatMode,
    isShuffle,
    shuffleHistory,
    shufflePointer,
    getNextSongsInShuffle,
    playbackOrderIds,
    playbackPointer = -1,
  } = params;

  if (
    playbackOrderIds &&
    playbackOrderIds.length > 0 &&
    playbackPointer >= 0
  ) {
    const current = currentSong;
    if (!current) {
      return { current: null, userAdded: [], upcoming: [] };
    }
    if (repeatMode === "one") {
      return { current, userAdded: [...userQueue], upcoming: [] };
    }
    const resolve = (id: string) => queue.find((s) => s._id === id);
    let upcomingIds = playbackOrderIds.slice(playbackPointer + 1);
    if (repeatMode === "all" && upcomingIds.length === 0) {
      upcomingIds = playbackOrderIds.filter((id) => id !== current._id);
    }
    const upcoming = upcomingIds
      .map((id) => resolve(id))
      .filter((s): s is Song => Boolean(s));
    const userQueueIds = new Set(userQueue.map((s) => s._id));
    return {
      current,
      userAdded: [...userQueue],
      upcoming: upcoming.filter(
        (s) => !userQueueIds.has(s._id) && s._id !== current._id,
      ),
    };
  }

  if (queue.length === 0 || currentIndex < 0) {
    return { current: null, userAdded: [], upcoming: [] };
  }

  const queueCurrent = queue[currentIndex];
  const current = currentSong ?? queueCurrent;
  if (!current) {
    return { current: null, userAdded: [], upcoming: [] };
  }

  if (repeatMode === "one") {
    return { current, userAdded: [...userQueue], upcoming: [] };
  }

  const regularUpcoming = getRegularUpcomingSongs({
    queue,
    currentIndex,
    repeatMode,
    isShuffle,
    shuffleHistory,
    shufflePointer,
    getNextSongsInShuffle,
  });

  const userQueueIds = new Set(userQueue.map((s) => s._id));
  const upcoming = regularUpcoming.filter(
    (s) => !userQueueIds.has(s._id) && s._id !== current._id,
  );

  return { current, userAdded: [...userQueue], upcoming };
}

/** Flat list for counts and legacy use. */
export function getQueueDisplaySongs(
  params: Parameters<typeof getQueueSections>[0],
): Song[] {
  const { current, userAdded, upcoming } = getQueueSections(params);
  if (!current) return [];
  return [current, ...userAdded, ...upcoming];
}

function getSongSection(
  songId: string,
  sections: QueueSections,
): "current" | "user" | "upcoming" | null {
  if (sections.current?._id === songId) return "current";
  if (sections.userAdded.some((s) => s._id === songId)) return "user";
  if (sections.upcoming.some((s) => s._id === songId)) return "upcoming";
  return null;
}

function reorderUpcomingInShuffle(
  queue: Song[],
  shuffleHistory: number[],
  activeId: string,
  overId: string,
): number[] | null {
  const oldSong = queue.find((s) => s._id === activeId);
  const newSong = queue.find((s) => s._id === overId);
  if (!oldSong || !newSong) return null;

  const oldShuffleIndex = shuffleHistory.findIndex(
    (idx) => queue[idx]?._id === oldSong._id,
  );
  const newShuffleIndex = shuffleHistory.findIndex(
    (idx) => queue[idx]?._id === newSong._id,
  );

  if (oldShuffleIndex === -1 || newShuffleIndex === -1) return null;

  const newShuffleHistory = [...shuffleHistory];
  const [movedIndex] = newShuffleHistory.splice(oldShuffleIndex, 1);
  newShuffleHistory.splice(newShuffleIndex, 0, movedIndex);
  return newShuffleHistory;
}

export function applyQueueDragReorder(params: {
  activeId: string;
  overId: string | undefined;
  sections: QueueSections;
  queue: Song[];
  isShuffle: boolean;
  moveSongInQueue: (fromIndex: number, toIndex: number) => void;
  moveSongInUserQueue: (fromIndex: number, toIndex: number) => void;
  promoteUpcomingToUserQueue: (songId: string, userIndex: number) => void;
  demoteUserQueueToUpcoming: (songId: string, beforeSongId: string) => void;
}): void {
  const {
    activeId,
    overId,
    sections,
    queue,
    isShuffle,
    moveSongInQueue,
    moveSongInUserQueue,
    promoteUpcomingToUserQueue,
    demoteUserQueueToUpcoming,
  } = params;

  if (!overId || activeId === overId) return;

  const activeSection = getSongSection(activeId, sections);
  const overSection = getSongSection(overId, sections);

  if (
    !activeSection ||
    !overSection ||
    activeSection === "current" ||
    overSection === "current"
  ) {
    return;
  }

  if (activeSection === "user" && overSection === "user") {
    const oldIndex = sections.userAdded.findIndex((s) => s._id === activeId);
    const newIndex = sections.userAdded.findIndex((s) => s._id === overId);
    if (oldIndex !== -1 && newIndex !== -1) {
      moveSongInUserQueue(oldIndex, newIndex);
    }
    return;
  }

  if (activeSection === "upcoming" && overSection === "upcoming") {
    if (isShuffle) {
      const { shuffleHistory } = usePlayerStore.getState();
      const newShuffleHistory = reorderUpcomingInShuffle(
        queue,
        shuffleHistory,
        activeId,
        overId,
      );
      if (newShuffleHistory) {
        usePlayerStore.setState({ shuffleHistory: newShuffleHistory });
      }
      return;
    }

    const oldIndex = queue.findIndex((s) => s._id === activeId);
    const newIndex = queue.findIndex((s) => s._id === overId);
    if (oldIndex !== -1 && newIndex !== -1) {
      moveSongInQueue(oldIndex, newIndex);
    }
    return;
  }

  if (activeSection === "upcoming" && overSection === "user") {
    const userIndex = sections.userAdded.findIndex((s) => s._id === overId);
    if (userIndex !== -1) {
      promoteUpcomingToUserQueue(activeId, userIndex);
    }
    return;
  }

  if (activeSection === "upcoming" && overId === USER_QUEUE_DROP_ID) {
    promoteUpcomingToUserQueue(activeId, 0);
    return;
  }

  if (activeSection === "user" && overSection === "upcoming") {
    demoteUserQueueToUpcoming(activeId, overId);
  }
}
