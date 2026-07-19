export function libraryControlState({ scanning = false, rootCount = 0, pendingRootCount = rootCount } = {}) {
  const statusKey = scanning ? "settings.statusScanning" : pendingRootCount ? "settings.statusSelected" : "settings.statusEmpty";
  return {
    manageDisabled: false,
    refreshDisabled: scanning || rootCount === 0,
    applyDisabled: scanning,
    statusKey,
    statusParams: { count: pendingRootCount }
  };
}
