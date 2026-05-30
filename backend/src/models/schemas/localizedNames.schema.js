export const localizedNamesSchema = {
  en: { type: String, trim: true, default: "" },
  ru: { type: String, trim: true, default: "" },
  uk: { type: String, trim: true, default: "" },
};

export const localizedNamesToSearchable = (localizedNames, fallbackName) => {
  const names = new Set();
  if (localizedNames) {
    for (const value of Object.values(localizedNames)) {
      if (typeof value === "string" && value.trim()) {
        names.add(value.trim());
      }
    }
  }
  if (names.size === 0 && fallbackName?.trim()) {
    names.add(fallbackName.trim());
  }
  return [...names];
};

export const pickLocalizedTitle = (localizedNames, fallbackName) => {
  const en = localizedNames?.en?.trim();
  if (en) return en;
  if (fallbackName?.trim()) return fallbackName.trim();
  return "";
};
