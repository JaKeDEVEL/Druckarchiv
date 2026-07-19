export function libraryControlState({ scanning = false, rootCount = 0, pendingRootCount = rootCount } = {}) {
  return {
    manageDisabled: false,
    refreshDisabled: scanning || rootCount === 0,
    applyDisabled: scanning,
    status: scanning
      ? "Bibliothek wird im Hintergrund eingelesen – Einstellungen können bereits angesehen werden."
      : pendingRootCount
        ? `${pendingRootCount.toLocaleString("de-DE")} Ordner ausgewählt`
        : "Noch keine Ordner ausgewählt"
  };
}
