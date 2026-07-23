export function sourceBrowserEntries(archive, rootIndex, includesFile = () => true) {
  const normalizedRootIndex = Number(rootIndex);
  if (!archive || !Number.isInteger(normalizedRootIndex) || normalizedRootIndex < 0) return [];

  const folders = (archive.projects || []).flatMap(project => {
    if (project.rootIndex !== normalizedRootIndex) return [];
    const files = (project.files || []).filter(includesFile);
    if (!files.length) return [];
    return [{
      kind: "folder",
      name: project.displayName || project.name,
      displayName: project.displayName || project.name,
      rootIndex: project.rootIndex,
      size: files.reduce((sum, file) => sum + Number(file.size || 0), 0),
      modified: Math.max(0, ...files.map(file => Number(file.modified || 0))),
      files,
      project
    }];
  });

  const files = (archive.loose || [])
    .filter(file => file.rootIndex === normalizedRootIndex && includesFile(file))
    .map(file => ({
      kind: "file",
      name: file.name,
      rootIndex: file.rootIndex,
      size: Number(file.size || 0),
      modified: Number(file.modified || 0),
      file
    }));

  return [...folders, ...files];
}
