import { pickLocalizedTitle } from "../models/schemas/localizedNames.schema.js";

/** Статические заголовки смарт-плейлистов (en — источник правды для `title`). */
export const SMART_PLAYLIST_LOCALIZED_TITLES = {
  ON_REPEAT: {
    en: "On Repeat",
    ru: "На повторе",
    uk: "На повторі",
  },
  DISCOVER_WEEKLY: {
    en: "Discover Weekly",
    ru: "Открытия недели",
    uk: "Відкриття тижня",
  },
  ON_REPEAT_REWIND: {
    en: "On Repeat Rewind",
    ru: "На повторе: Назад",
    uk: "На повторі: Назад",
  },
};

export const SMART_PLAYLIST_DESCRIPTIONS = {
  ON_REPEAT: "Songs you've been playing the most lately.",
  DISCOVER_WEEKLY:
    "Your weekly mixtape of fresh music. Enjoy new discoveries and deep cuts chosen just for you.",
  ON_REPEAT_REWIND:
    "Songs you loved in the past. Rediscover your old favorites.",
};

export function getSmartPlaylistLabels(type) {
  const localizedNames = SMART_PLAYLIST_LOCALIZED_TITLES[type];
  if (!localizedNames) {
    return { title: "", localizedNames: {} };
  }
  return {
    title: pickLocalizedTitle(localizedNames),
    localizedNames,
    description: SMART_PLAYLIST_DESCRIPTIONS[type] ?? "",
  };
}
