export const FAVORITES_STORAGE_KEY = "druckarchiv.favorites.v1";

export function favoriteFileKey(file, rootPath) {
  if (!file || typeof file.path !== "string" || typeof rootPath !== "string" || !rootPath) return "";
  return JSON.stringify([rootPath, file.path]);
}

export function normalizeFavoriteKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(key => typeof key === "string" && key))];
}

export function compareFavoriteState(leftFavorite, rightFavorite) {
  return Number(Boolean(rightFavorite)) - Number(Boolean(leftFavorite));
}
