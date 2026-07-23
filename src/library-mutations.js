export function managementEntryKey(kind, rootIndex, relativePath) {
  return JSON.stringify([kind === "folder" ? "folder" : "file", Number(rootIndex), String(relativePath || "")]);
}

export function splitEntryName(name, kind = "file") {
  const value = String(name || "");
  if (kind === "folder") return { base: value, extension: "" };
  const dot = value.lastIndexOf(".");
  return dot > 0 ? { base: value.slice(0, dot), extension: value.slice(dot) } : { base: value, extension: "" };
}

function normalizedPath(value) {
  return String(value || "").replace(/\\/g, "/").split("/").filter(Boolean).join("/");
}

function addFolder(target, rootIndex, relativePath, rootName) {
  const path = normalizedPath(relativePath);
  const key = `${rootIndex}\n${path}`;
  if (target.has(key)) return;
  target.set(key, {
    rootIndex,
    relativePath: path,
    name: path.split("/").pop() || rootName,
    rootName,
    depth: path ? path.split("/").length : 0
  });
}

export function libraryFolderOptions(archive) {
  if (!archive?.roots) return [];
  const folders = new Map();
  archive.roots.forEach((root, rootIndex) => {
    if (root?.available === false) return;
    addFolder(folders, rootIndex, "", root.name || root.path || "Bibliothek");
  });
  for (const project of archive.projects || []) {
    const root = archive.roots[project.rootIndex];
    if (!root || root.available === false) continue;
    addFolder(folders, project.rootIndex, project.name, root.name);
    for (const file of project.files || []) {
      const segments = normalizedPath(file.path).split("/").filter(Boolean);
      for (let depth = 1; depth < segments.length; depth++) {
        addFolder(folders, project.rootIndex, segments.slice(0, depth).join("/"), root.name);
      }
    }
  }
  return [...folders.values()].sort((left, right) => {
    if (left.rootIndex !== right.rootIndex) return left.rootIndex - right.rootIndex;
    if (left.depth !== right.depth) return left.depth - right.depth;
    return left.relativePath.localeCompare(right.relativePath);
  });
}

export function entryParentPath(relativePath) {
  const segments = normalizedPath(relativePath).split("/").filter(Boolean);
  return segments.slice(0, -1).join("/");
}

export function destinationContainsEntry(destination, entry) {
  if (!destination || !entry || entry.kind !== "folder" || destination.rootIndex !== entry.rootIndex) return false;
  const source = normalizedPath(entry.relativePath);
  const target = normalizedPath(destination.relativePath);
  return target === source || target.startsWith(`${source}/`);
}

export function mutationErrorKey(error) {
  const code = String(error || "").match(/mutation_[a-z_]+/)?.[0] || "";
  return new Set([
    "mutation_invalid_name",
    "mutation_outside_library",
    "mutation_missing",
    "mutation_symlink",
    "mutation_collision",
    "mutation_root_protected",
    "mutation_invalid_destination",
    "mutation_library_unavailable",
    "mutation_same_name",
    "mutation_same_location",
    "mutation_into_descendant",
    "mutation_permission_denied",
    "mutation_cross_device",
    "mutation_invalid_selection",
    "mutation_invalid_source",
    "mutation_trash_failed",
    "mutation_failed"
  ]).has(code) ? `mutations.errors.${code.slice("mutation_".length)}` : "mutations.errors.failed";
}
