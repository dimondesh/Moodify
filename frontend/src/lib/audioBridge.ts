/** Sync bridge from player store → <audio> (gesture unlock before awaits). */

type AudioBridge = {
  /** Call synchronously inside a user-gesture handler before any await. */
  unlock: () => void;
};

let bridge: AudioBridge | null = null;

export function registerAudioBridge(next: AudioBridge | null) {
  bridge = next;
}

export function unlockAudioElement() {
  bridge?.unlock();
}
