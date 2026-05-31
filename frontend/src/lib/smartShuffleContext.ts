import type { Song } from "../types";

export type SmartShuffleRepeatMode = "default" | "fewerRepeats";

/** Use ID-based playback order instead of materializing the full queue in memory. */
export const LARGE_PLAYLIST_THRESHOLD = 200;

/** Max smart-shuffle recommendations per session (large libraries stay bounded). */
export const SMART_SHUFFLE_ABSOLUTE_MAX = 30;

/**
 * Spotify-style: ~1:3 ratio for small lists, fixed cap for large / liked libraries.
 */
export function computeSmartShuffleLimit(sourceCount: number): number {
  if (sourceCount <= 0) return 0;
  if (sourceCount <= 30) {
    return Math.max(1, Math.floor(sourceCount / 3));
  }
  if (sourceCount <= LARGE_PLAYLIST_THRESHOLD) {
    return Math.min(SMART_SHUFFLE_ABSOLUTE_MAX, Math.floor(sourceCount / 5));
  }
  return SMART_SHUFFLE_ABSOLUTE_MAX;
}

export function shuffleIds(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pinIdAtFront(order: string[], id: string): string[] {
  const pos = order.indexOf(id);
  if (pos <= 0) return order;
  const next = [...order];
  [next[0], next[pos]] = [next[pos], next[0]];
  return next;
}

export interface SmartShuffleStateSlice {
  queue: Song[];
  shuffleHistory: number[];
  shufflePointer: number;
}
