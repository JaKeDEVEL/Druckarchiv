export const FAVORITES_STORAGE_KEY = "druckarchiv.favorites.v1";

export function favoriteFileKey(file, rootPath) {
  if (!file || typeof file.path !== "string" || typeof rootPath !== "string" || !rootPath) return "";
  return JSON.stringify([rootPath, file.path]);
}

export function normalizeFolderPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
}

export function favoriteFolderKey(rootPath, folderPath) {
  const normalizedPath = normalizeFolderPath(folderPath);
  if (typeof rootPath !== "string" || !rootPath || !normalizedPath) return "";
  return JSON.stringify(["folder", rootPath, normalizedPath]);
}

export function folderPathsForFiles(projectPath, files) {
  const normalizedProject = normalizeFolderPath(projectPath);
  if (!normalizedProject || !Array.isArray(files) || !files.length) return [];
  const projectSegments = normalizedProject.split("/");
  const paths = new Set([normalizedProject]);
  for (const file of files) {
    const segments = normalizeFolderPath(file?.path).split("/").filter(Boolean);
    if (segments.length <= projectSegments.length || !projectSegments.every((segment, index) => segments[index] === segment)) continue;
    for (let depth = projectSegments.length + 1; depth < segments.length; depth++) {
      paths.add(segments.slice(0, depth).join("/"));
    }
  }
  return [...paths];
}

export function normalizeFavoriteKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(key => typeof key === "string" && key))];
}

export function compareFavoriteState(leftFavorite, rightFavorite) {
  return Number(Boolean(rightFavorite)) - Number(Boolean(leftFavorite));
}

export function favoriteToggleNeedsRender(favoriteOnly, sort) {
  return Boolean(favoriteOnly) || sort === "favorite";
}
