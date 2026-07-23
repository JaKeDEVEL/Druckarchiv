const COVER_MODES = new Set(["auto", "custom", "icon"]);
const IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g);base64,/i;

function normalizedPath(value) {
  return String(value || "").replace(/\\/g, "/").split("/").filter(Boolean).join("/");
}

function projectRelativePath(project, file) {
  const filePath = normalizedPath(file?.path);
  const projectPath = normalizedPath(project?.name);
  return projectPath && filePath.startsWith(`${projectPath}/`)
    ? filePath.slice(projectPath.length + 1)
    : filePath;
}

export const FOLDER_COVERS_STORAGE_KEY = "druckarchiv.folder-covers.v1";

export function folderCoverKey(rootPath, folderPath) {
  return JSON.stringify([normalizedPath(rootPath), normalizedPath(folderPath)]);
}

export function normalizeFolderCoverPreference(value) {
  const mode = COVER_MODES.has(value?.mode) ? value.mode : "auto";
  const image = typeof value?.image === "string" && IMAGE_DATA_URL.test(value.image) ? value.image : "";
  const fileName = typeof value?.fileName === "string" ? value.fileName.slice(0, 240) : "";
  return { mode: mode === "custom" && !image ? "auto" : mode, image, fileName };
}

export function normalizeFolderCoverPreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, preference]) => {
    if (typeof key !== "string" || key.length > 4096) return [];
    const normalized = normalizeFolderCoverPreference(preference);
    return normalized.mode === "auto" && !normalized.image ? [] : [[key, normalized]];
  }));
}

export function folderContents(project, files, folderPath = "") {
  const path = normalizedPath(folderPath);
  const prefix = path ? `${path}/` : "";
  const directFiles = [];
  const childFolders = new Set();

  for (const file of files || []) {
    const relative = projectRelativePath(project, file);
    if (prefix && !relative.startsWith(prefix)) continue;
    const remainder = prefix ? relative.slice(prefix.length) : relative;
    if (!remainder || remainder.startsWith("/")) continue;
    const separator = remainder.indexOf("/");
    if (separator === -1) directFiles.push(file);
    else childFolders.add(remainder.slice(0, separator));
  }

  return { directFiles, childFolders: [...childFolders], isLeaf: childFolders.size === 0 };
}

export function resolveFolderCover({
  project,
  folderPath = "",
  allFiles = project?.files || [],
  candidateFiles = allFiles,
  preference = null,
  isPreviewable = () => false
}) {
  const structure = folderContents(project, allFiles, folderPath);
  const normalized = normalizeFolderCoverPreference(preference);
  if (!structure.isLeaf) {
    return normalized.mode === "custom"
      ? { kind: "custom", image: normalized.image, representative: null, ...structure }
      : { kind: "icon", representative: null, ...structure };
  }
  if (normalized.mode === "icon") return { kind: "icon", representative: null, ...structure };
  if (normalized.mode === "custom") {
    return { kind: "custom", image: normalized.image, representative: null, ...structure };
  }

  const candidates = folderContents(project, candidateFiles, folderPath).directFiles;
  const representative = candidates.find(isPreviewable) || null;
  return { kind: representative ? "model" : "icon", representative, ...structure };
}
