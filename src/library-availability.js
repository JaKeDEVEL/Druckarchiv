export function isLibraryRootAvailable(root) {
  return root?.available !== false;
}

export function unavailableLibraryRoots(archive) {
  const roots = Array.isArray(archive?.roots) ? archive.roots : [];
  return roots.filter(root => !isLibraryRootAvailable(root));
}

export function libraryRootConnectionType(root) {
  let path = String(root?.path || "").trim().replaceAll("\\", "/");
  path = path
    .replace(/^\/\/\?\/UNC\//i, "//")
    .replace(/^\/\/[?.]\//, "");

  if (path.startsWith("//")) return "network";
  if (/^\/Volumes\//i.test(path)) return "external";
  if (/^\/(?:run\/)?media\//i.test(path)) return "external";
  if (/^\/mnt\//i.test(path)) return "external";
  if (/^[d-z]:\//i.test(path)) return "external";
  return "folder";
}

export function unavailableLibraryConnectionType(roots = []) {
  if (!roots.length) return "folder";
  const types = roots.map(libraryRootConnectionType);
  if (types.every(type => type === "external")) return "external";
  if (types.every(type => type === "network")) return "network";
  return "folder";
}
