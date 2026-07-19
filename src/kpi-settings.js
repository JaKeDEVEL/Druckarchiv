export const CATEGORY_EXTENSIONS = {
  stl: ["stl"],
  m3f: ["3mf"],
  mesh: ["obj", "ply", "amf"],
  cad: ["step", "stp", "f3d", "fcstd", "scad", "iges", "igs", "dxf"],
  gcode: ["gcode", "bgcode", "chitubox", "ctb", "goo"],
  image: ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "pdf", "txt"]
};

export const CATEGORY_BY_EXTENSION = new Map(
  Object.entries(CATEGORY_EXTENSIONS).flatMap(([category, extensions]) =>
    extensions.map(extension => [extension, category])
  )
);

export const KPI_CATEGORY_ORDER = ["stl", "m3f", "mesh", "cad", "gcode", "other"];

export function selectedKpiExtensions(settings = {}) {
  const grouped = {};
  for (const extension of settings.enabledExtensions || []) {
    const fileCategory = CATEGORY_BY_EXTENSION.get(extension) || "other";
    const kpiCategory = fileCategory === "image" ? "other" : fileCategory;
    (grouped[kpiCategory] ||= []).push(extension);
  }
  if (settings.includeUnknown) grouped.other ||= [];
  return grouped;
}
