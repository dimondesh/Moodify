export type EntityShuffleMode = "off" | "regular" | "smart";

export type EntityType = "playlist" | "album" | "artist";

const STORAGE_KEY = "moodify-entity-shuffle-prefs";

export function makeEntityShuffleKey(
  entityType: EntityType,
  entityId: string,
): string {
  return `${entityType}:${entityId}`;
}

function readAllPrefs(): Record<string, EntityShuffleMode> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, EntityShuffleMode> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === "off" || value === "regular" || value === "smart") {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function clampMode(
  mode: EntityShuffleMode,
  supportsSmartShuffle: boolean,
): EntityShuffleMode {
  if (!supportsSmartShuffle && mode === "smart") return "regular";
  return mode;
}

export function readEntityShufflePref(
  entityType: EntityType,
  entityId: string,
  supportsSmartShuffle: boolean,
): EntityShuffleMode {
  const key = makeEntityShuffleKey(entityType, entityId);
  const prefs = readAllPrefs();
  return clampMode(prefs[key] ?? "off", supportsSmartShuffle);
}

export function writeEntityShufflePref(
  entityType: EntityType,
  entityId: string,
  mode: EntityShuffleMode,
): void {
  if (typeof window === "undefined") return;
  try {
    const prefs = readAllPrefs();
    prefs[makeEntityShuffleKey(entityType, entityId)] = mode;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function cycleEntityShufflePrefValue(
  current: EntityShuffleMode,
  supportsSmartShuffle: boolean,
): EntityShuffleMode {
  if (supportsSmartShuffle) {
    if (current === "off") return "regular";
    if (current === "regular") return "smart";
    return "off";
  }
  return current === "off" ? "regular" : "off";
}
