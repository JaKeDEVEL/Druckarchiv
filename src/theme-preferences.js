export const THEME_PREFERENCES = Object.freeze(["system", "light", "dark"]);
export const THEME_STORAGE_KEY = "druckarchiv.theme.v1";

export function normalizeThemePreference(value, fallback = "system") {
  const safeFallback = THEME_PREFERENCES.includes(fallback) ? fallback : "system";
  return THEME_PREFERENCES.includes(value) ? value : safeFallback;
}

export function resolveTheme(preference, systemPrefersDark = false) {
  const normalized = normalizeThemePreference(preference);
  if (normalized === "system") return systemPrefersDark ? "dark" : "light";
  return normalized;
}
