export const SLICERS = Object.freeze([
  Object.freeze({ id: "orcaSlicer", label: "OrcaSlicer" }),
  Object.freeze({ id: "bambuStudio", label: "Bambu Studio" }),
  Object.freeze({ id: "prusaSlicer", label: "PrusaSlicer" })
]);

export const DEFAULT_SLICER = SLICERS[0].id;

const SLICER_IDS = new Set(SLICERS.map(slicer => slicer.id));
const SLICER_EXTENSIONS = Object.freeze({
  orcaSlicer: new Set(["stl", "3mf", "obj", "step", "stp", "amf", "ply", "gcode", "bgcode"]),
  bambuStudio: new Set(["stl", "3mf", "obj", "step", "stp", "amf", "ply", "gcode", "bgcode"]),
  prusaSlicer: new Set(["stl", "3mf", "obj", "step", "stp", "amf", "gcode", "bgcode"])
});

export function normalizeSlicer(value) {
  return SLICER_IDS.has(value) ? value : DEFAULT_SLICER;
}

export function slicerLabel(value) {
  return SLICERS.find(slicer => slicer.id === normalizeSlicer(value))?.label || SLICERS[0].label;
}

export function isSlicerCompatible(extension, slicer = DEFAULT_SLICER) {
  return SLICER_EXTENSIONS[normalizeSlicer(slicer)].has(String(extension || "").toLowerCase());
}

export function slicerErrorKey(error) {
  const code = String(error || "").split(":", 1)[0];
  const keys = {
    no_files: "errors.slicerNoFiles",
    too_many_files: "errors.slicerTooManyFiles",
    path_blocked: "errors.slicerPathBlocked",
    file_not_found: "errors.slicerFileNotFound",
    unsupported_file: "errors.slicerUnsupportedFile",
    unknown_slicer: "errors.slicerUnknown",
    slicer_not_found: "errors.slicerNotFound",
    unsupported_platform: "errors.slicerPlatform",
    library_unavailable: "errors.slicerLibraryUnavailable",
    launch_failed: "errors.slicerLaunchFailed"
  };
  return keys[code] || "errors.slicerLaunchFailed";
}
