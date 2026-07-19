export const VIEW_MODES = Object.freeze(["list", "grid"]);

export function normalizeViewMode(value, fallback = "list") {
  const safeFallback = VIEW_MODES.includes(fallback) ? fallback : "list";
  return VIEW_MODES.includes(value) ? value : safeFallback;
}

export function toggleViewMode(value, fallback = "list") {
  return normalizeViewMode(value, fallback) === "list" ? "grid" : "list";
}
