export function releaseViewerModel(scene, model, disposeModel) {
  if (!model) return null;
  scene?.remove(model);
  disposeModel(model);
  return null;
}
