function comparableRoot(path) {
  let normalized = String(path || "").trim().replaceAll("\\", "/");
  const hasWindowsNamespace = /^\/\/[?.]\//.test(normalized);

  // Rust canonicalize() uses Windows' verbatim path namespace while the
  // native folder picker returns a regular drive or UNC path. Both forms
  // identify the same directory and must compare equally in the UI.
  normalized = normalized
    .replace(/^\/\/\?\/UNC\//i, "//")
    .replace(/^\/\/[?.]\//, "");

  const isWindowsPath = hasWindowsNamespace || /^[a-z]:\//i.test(normalized) || normalized.startsWith("//");
  normalized = normalized.replace(/\/{2,}/g, "/");
  if (normalized.length > 1) normalized = normalized.replace(/\/$/, "");
  if (isWindowsPath) normalized = normalized.toLowerCase();
  return normalized;
}

export function rootDisplayName(path) {
  const normalized = String(path || "").replaceAll("\\", "/").replace(/\/$/, "");
  return normalized.split("/").filter(Boolean).pop() || normalized || String(path || "");
}

export function isNestedLibraryRoot(candidate, parent) {
  const childPath = comparableRoot(candidate);
  const parentPath = comparableRoot(parent);
  if (!childPath || !parentPath || childPath === parentPath) return false;
  return parentPath === "/" ? childPath.startsWith("/") : childPath.startsWith(`${parentPath}/`);
}

export function mergeLibraryRoots(currentRoots = [], additions = []) {
  let roots = [...new Set(currentRoots.filter(root => typeof root === "string" && root))];
  const skippedDuplicates = [];
  const skippedNested = [];
  const replacedNested = [];

  additions.filter(root => typeof root === "string" && root).forEach(candidate => {
    const duplicate = roots.find(root => comparableRoot(root) === comparableRoot(candidate));
    if (duplicate) {
      skippedDuplicates.push({ candidate, existing: duplicate });
      return;
    }

    const parent = roots.find(root => isNestedLibraryRoot(candidate, root));
    if (parent) {
      skippedNested.push({ candidate, parent });
      return;
    }

    const children = roots.filter(root => isNestedLibraryRoot(root, candidate));
    if (children.length) {
      const childPaths = new Set(children.map(comparableRoot));
      roots = roots.filter(root => !childPaths.has(comparableRoot(root)));
      replacedNested.push({ parent: candidate, children });
    }
    roots.push(candidate);
  });

  return { roots, skippedDuplicates, skippedNested, replacedNested };
}
