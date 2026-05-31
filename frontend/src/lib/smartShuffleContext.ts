import type { Song } from "../types";

export type SmartShuffleRepeatMode = "default" | "fewerRepeats";

const MAX_EXCLUDE_IDS = 150;

export interface SmartShuffleStateSlice {
  queue: Song[];
  shuffleHistory: number[];
  shufflePointer: number;
}

export function collectSmartShuffleExcludeIds(
  state: SmartShuffleStateSlice,
): string[] {
  const ids = new Set<string>();

  for (const song of state.queue) {
    if (song._id) ids.add(song._id);
  }

  const playedCount = state.shufflePointer + 1;
  for (let i = 0; i < playedCount && i < state.shuffleHistory.length; i++) {
    const index = state.shuffleHistory[i];
    const song = state.queue[index];
    if (song?._id) ids.add(song._id);
  }

  return [...ids].slice(0, MAX_EXCLUDE_IDS);
}
