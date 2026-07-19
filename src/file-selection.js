export function fileSelectionKey(file) {
  return `${file.rootIndex}\n${file.path}`;
}

export function selectionPayload(selection, fileIndex) {
  return [...selection].map(key => fileIndex.get(key)).filter(Boolean).map(file => ({
    rootIndex: file.rootIndex,
    relativePath: file.path
  }));
}

export function compatibleSelection(selection, fileIndex, isCompatible) {
  return new Set([...selection].filter(key => {
    const file = fileIndex.get(key);
    return file && isCompatible(file);
  }));
}
