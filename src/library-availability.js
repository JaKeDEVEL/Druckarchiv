export function isLibraryRootAvailable(root) {
  return root?.available !== false;
}

export function unavailableLibraryRoots(archive) {
  const roots = Array.isArray(archive?.roots) ? archive.roots : [];
  return roots.filter(root => !isLibraryRootAvailable(root));
}
