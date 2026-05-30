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

/** Совпадает с `personalMix.titleNumber` на фронте (en/ru/uk). */
export function buildPersonalMixLabels(mixNumber) {
  const n = Math.max(1, Number(mixNumber) || 1);
  const localizedNames = {
    en: `Your Mix #${n}`,
    ru: `Твой микс #${n}`,
    uk: `Твій мікс #${n}`,
  };
  return {
    title: localizedNames.en,
    localizedNames,
  };
}

export function getSmartPlaylistLabels(type) {
  const localizedNames = SMART_PLAYLIST_LOCALIZED_TITLES[type];
  if (!localizedNames) {
    return { title: "", localizedNames: {} };
  }
  return {
    title: pickLocalizedTitle(localizedNames),
    localizedNames,
  };
}
