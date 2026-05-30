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

export const SMART_PLAYLIST_LOCALIZED_DESCRIPTIONS = {
  ON_REPEAT: {
    en: "Songs you've been playing the most lately.",
    ru: "Треки, которые вы слушали чаще всего в последнее время.",
    uk: "Треки, які ви слухали найчастіше останнім часом.",
  },
  DISCOVER_WEEKLY: {
    en: "Your weekly mixtape of fresh music. Enjoy new discoveries and deep cuts chosen just for you.",
    ru: "Новые треки, которые вам понравятся. Обновляется каждую неделю.",
    uk: "Нові треки, які вам можуть сподобатися, щотижня.",
  },
  ON_REPEAT_REWIND: {
    en: "Songs you loved in the past. Rediscover your old favorites.",
    ru: "Ваши любимые треки из прошлого, которые вы слушали чаще всего.",
    uk: "Ваші улюблені треки з минулого, які ви слухали найчастіше.",
  },
};

export const PERSONAL_MIX_LOCALIZED_DESCRIPTIONS = {
  en: "A personal mix based on your listening habits.",
  ru: "Персональный микс, основанный на ваших привычках прослушивания музыки.",
  uk: "Особистий мікс, заснований на ваших звичках прослуховування.",
};

export function getSmartPlaylistLabels(type) {
  const localizedNames = SMART_PLAYLIST_LOCALIZED_TITLES[type];
  const localizedDescriptions = SMART_PLAYLIST_LOCALIZED_DESCRIPTIONS[type];
  if (!localizedNames) {
    return { title: "", localizedNames: {}, localizedDescriptions: {} };
  }
  return {
    title: pickLocalizedTitle(localizedNames),
    localizedNames,
    description: pickLocalizedTitle(localizedDescriptions),
    localizedDescriptions: localizedDescriptions ?? {},
  };
}

export function getPersonalMixLabels() {
  return {
    localizedDescriptions: PERSONAL_MIX_LOCALIZED_DESCRIPTIONS,
    description: pickLocalizedTitle(PERSONAL_MIX_LOCALIZED_DESCRIPTIONS),
  };
}
