import { pickLocalizedTitle } from "../models/schemas/localizedNames.schema.js";

export const buildMixPlaylistLabels = (source) => {
  const localizedNames = source.localizedNames ?? {};
  const fallbackName = source.name ?? "";
  return {
    title: pickLocalizedTitle(localizedNames, fallbackName),
    localizedNames,
  };
};
