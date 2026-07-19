export const FORMAT_GROUPS = [
  {
    id: "models",
    label: "Modelldateien",
    formats: [
      { ext: "stl", label: "STL", defaultOn: true },
      { ext: "3mf", label: "3MF", defaultOn: true },
      { ext: "obj", label: "OBJ", defaultOn: true },
      { ext: "ply", label: "PLY", defaultOn: false },
      { ext: "amf", label: "AMF", defaultOn: false }
    ]
  },
  {
    id: "printer",
    label: "Druckaufträge",
    formats: [
      { ext: "gcode", label: "G-Code", defaultOn: true },
      { ext: "bgcode", label: "BG-Code", defaultOn: false },
      { ext: "chitubox", label: "Chitubox", defaultOn: false },
      { ext: "ctb", label: "CTB", defaultOn: false },
      { ext: "goo", label: "GOO", defaultOn: false }
    ]
  },
  {
    id: "cad",
    label: "CAD & Quellen",
    formats: [
      { ext: "step", label: "STEP", defaultOn: false },
      { ext: "stp", label: "STP", defaultOn: false },
      { ext: "f3d", label: "Fusion 360", defaultOn: false },
      { ext: "fcstd", label: "FreeCAD", defaultOn: false },
      { ext: "scad", label: "OpenSCAD", defaultOn: false },
      { ext: "iges", label: "IGES", defaultOn: false },
      { ext: "igs", label: "IGS", defaultOn: false },
      { ext: "dxf", label: "DXF", defaultOn: false }
    ]
  },
  {
    id: "reference",
    label: "Referenzen",
    formats: [
      { ext: "jpg", label: "JPG", defaultOn: false },
      { ext: "jpeg", label: "JPEG", defaultOn: false },
      { ext: "png", label: "PNG", defaultOn: false },
      { ext: "webp", label: "WebP", defaultOn: false },
      { ext: "gif", label: "GIF", defaultOn: false },
      { ext: "svg", label: "SVG", defaultOn: false },
      { ext: "pdf", label: "PDF", defaultOn: false },
      { ext: "txt", label: "Text", defaultOn: false }
    ]
  }
];

export const KNOWN_EXTENSIONS = FORMAT_GROUPS.flatMap(group => group.formats.map(format => format.ext));
export const PRINT_EXTENSIONS = FORMAT_GROUPS.flatMap(group => group.formats.filter(format => format.defaultOn).map(format => format.ext));

export function defaultLibrarySettings() {
  return {
    enabledExtensions: FORMAT_GROUPS.flatMap(group => group.formats.filter(format => format.defaultOn).map(format => format.ext)),
    includeUnknown: false,
    excludedExtensions: [],
    excludedFiles: []
  };
}

export function normalizeExtension(value) {
  return String(value || "").trim().toLocaleLowerCase("de").replace(/^\*?\./, "");
}

export function splitExtensionRules(value) {
  return [...new Set(String(value || "").split(/[\s,;]+/).map(normalizeExtension).filter(Boolean))];
}

export function splitFileRules(value) {
  return [...new Set(String(value || "").split(/\r?\n/).map(rule => rule.trim().toLocaleLowerCase("de")).filter(Boolean))];
}

function wildcardPattern(rule) {
  const escaped = rule.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

export function matchesFileRule(file, rule, rootName = "") {
  const pattern = wildcardPattern(rule);
  const path = String(file.path || "").replace(/\\/g, "/");
  return pattern.test(String(file.name || "")) || pattern.test(path) || pattern.test(`${rootName}/${path}`);
}

export function normalizeLibrarySettings(value = {}) {
  const defaults = defaultLibrarySettings();
  const enabled = Array.isArray(value.enabledExtensions)
    ? value.enabledExtensions.map(normalizeExtension).filter(ext => KNOWN_EXTENSIONS.includes(ext))
    : defaults.enabledExtensions;
  return {
    enabledExtensions: [...new Set(enabled)],
    includeUnknown: Boolean(value.includeUnknown),
    excludedExtensions: Array.isArray(value.excludedExtensions)
      ? [...new Set(value.excludedExtensions.map(normalizeExtension).filter(Boolean))]
      : defaults.excludedExtensions,
    excludedFiles: Array.isArray(value.excludedFiles)
      ? [...new Set(value.excludedFiles.map(rule => String(rule).trim().toLocaleLowerCase("de")).filter(Boolean))]
      : defaults.excludedFiles
  };
}

export function isFileVisible(file, settings, rootName = "") {
  const extension = normalizeExtension(file.extension);
  if (settings.excludedExtensions.includes(extension)) return false;
  if (settings.excludedFiles.some(rule => matchesFileRule(file, rule, rootName))) return false;
  if (KNOWN_EXTENSIONS.includes(extension)) return settings.enabledExtensions.includes(extension);
  return settings.includeUnknown;
}
