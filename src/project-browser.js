function normalizedPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function projectRelativeFilePath(project, file) {
  const filePath = normalizedPath(file?.path);
  const projectPath = normalizedPath(project?.name);
  if (!projectPath) return filePath;
  return filePath.startsWith(`${projectPath}/`) ? filePath.slice(projectPath.length + 1) : filePath;
}

export function projectBrowserEntries(project, files, currentPath = "") {
  const directoryPath = normalizedPath(currentPath);
  const directoryPrefix = directoryPath ? `${directoryPath}/` : "";
  const folders = new Map();
  const directFiles = [];

  for (const file of files || []) {
    const relativePath = projectRelativeFilePath(project, file);
    if (directoryPrefix && !relativePath.startsWith(directoryPrefix)) continue;
    const remainder = directoryPrefix ? relativePath.slice(directoryPrefix.length) : relativePath;
    if (!remainder || remainder.startsWith("/")) continue;

    const separator = remainder.indexOf("/");
    if (separator === -1) {
      directFiles.push({ kind: "file", name: file.name, size: file.size, modified: file.modified, file });
      continue;
    }

    const name = remainder.slice(0, separator);
    const path = directoryPath ? `${directoryPath}/${name}` : name;
    const folder = folders.get(path) || { kind: "folder", name, path, files: [], size: 0, modified: 0 };
    folder.files.push(file);
    folder.size += Number(file.size) || 0;
    folder.modified = Math.max(folder.modified, Number(file.modified) || 0);
    folders.set(path, folder);
  }

  return [...folders.values(), ...directFiles];
}

export function projectBreadcrumbs(project, currentPath = "") {
  const segments = normalizedPath(currentPath).split("/").filter(Boolean);
  const crumbs = [{ name: project?.displayName || project?.name || "", path: "" }];
  let path = "";
  for (const segment of segments) {
    path = path ? `${path}/${segment}` : segment;
    crumbs.push({ name: segment, path });
  }
  return crumbs;
}
