import { pickLocalizedTitle } from "../models/schemas/localizedNames.schema.js";
import { getSmartPlaylistLabels } from "./generatedPlaylistCopy.js";

export const buildMixPlaylistLabels = (source) => {
  const localizedNames = source.localizedNames ?? {};
  const fallbackName = source.name ?? "";
  return {
    title: pickLocalizedTitle(localizedNames, fallbackName),
    localizedNames,
  };
};

/** Любой сгенерированный плейлист: title + localizedNames для UI. */
export function buildGeneratedPlaylistLabels({ type, source, fallbackTitle = "" }) {
  if (type === "GENRE_MIX" || type === "MOOD_MIX" || type === "PERSONAL_MIX") {
    if (source?.localizedNames || source?.name) {
      return buildMixPlaylistLabels(source);
    }
  }

  if (
    type === "ON_REPEAT" ||
    type === "DISCOVER_WEEKLY" ||
    type === "ON_REPEAT_REWIND"
  ) {
    return getSmartPlaylistLabels(type);
  }

  const localizedNames = source?.localizedNames ?? {};
  return {
    title: pickLocalizedTitle(localizedNames, fallbackTitle),
    localizedNames,
  };
}

export function pickPlaylistTitleForLang(localizedNames, lang, fallback = "") {
  const code = (lang || "en").split("-")[0];
  const localized =
    localizedNames?.[code]?.trim() || localizedNames?.en?.trim();
  return localized || fallback;
}
