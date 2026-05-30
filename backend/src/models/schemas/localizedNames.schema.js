export const localizedNamesSchema = {
  en: { type: String, trim: true, default: "" },
  ru: { type: String, trim: true, default: "" },
  uk: { type: String, trim: true, default: "" },
};

export const pickLocalizedTitle = (localizedNames, fallbackName) => {
  const en = localizedNames?.en?.trim();
  if (en) return en;
  if (fallbackName?.trim()) return fallbackName.trim();
  return "";
};
