export default {
  app: {
    title: "Druckarchiv",
    tagline: "Lokale Modellbibliothek",
    noFolder: "Noch kein Archivordner ausgewählt",
    manageLibrary: "Bibliothek verwalten"
  },
  theme: {
    label: "Darstellung",
    system: "System",
    light: "Hell",
    dark: "Dunkel"
  },
  nav: {
    label: "Suche und Ansicht",
    searchPlaceholder: "Projekte und Dateien durchsuchen …",
    sortLabel: "Sortierung",
    sortName: "Name A–Z",
    sortDate: "Zuletzt geändert",
    sortSize: "Größe",
    refresh: "Neu einlesen",
    listView: "Listenansicht",
    gridView: "Rasteransicht",
    language: "Sprache"
  },
  stats: {
    label: "Archiv-Kennzahlen",
    projectFolders: "Projektordner",
    projectFoldersSub: "Ordner mit Dateien",
    allFiles: "Alle Dateien",
    allFilesSub: "inkl. Unterordner"
  },
  categories: {
    stlSub: "Modelle",
    threeMfSub: "Druckpakete",
    mesh: "Mesh",
    meshSingleSub: "Modelldateien",
    cad: "CAD",
    cadSingleSub: "CAD-Quelle",
    printJobs: "Druckaufträge",
    printJob: "Druckauftrag",
    references: "Referenzen",
    referenceFiles: "Referenzdateien",
    other: "Sonstige",
    referencesIncluded: "inkl. Referenzen",
    moreFileTypes: "weitere Dateitypen"
  },
  sections: {
    projectFolders: "Projektordner",
    filesFromAllFolders: "Dateien aus allen Ordnern",
    folderOverview: "Ordnerübersicht",
    allFiles: "Alle Dateien",
    categoryFolders: "{category}-Ordner",
    categoryFiles: "{category}-Dateien",
    viewModeLabel: "Ergebnisse anzeigen als",
    folderMode: "Ordner",
    fileMode: "Dateien",
    folderModeLabel: "Passende Projektordner anzeigen",
    fileModeLabel: "Einzelne Dateien anzeigen"
  },
  pagination: {
    perPage: "Pro Seite",
    perPageLabel: "Treffer pro Seite",
    navigationLabel: "Ergebnisseiten",
    noResults: "0 Treffer",
    range: "{start}–{end} von {total} Treffern",
    status: "Seite {page} von {totalPages}",
    pageLabel: "Seite {page}",
    previous: "Vorherige Seite",
    next: "Nächste Seite"
  },
  loading: {
    preparing: "Ansicht wird vorbereitet",
    sorting: "Einträge werden sortiert …",
    preparingWithPreviews: "Einträge werden vorbereitet, Vorschauen folgen …",
    preparingEntries: "Einträge werden vorbereitet …",
    readingLibrary: "Bibliothek wird eingelesen",
    settingsAvailable: "Die Verwaltung kann währenddessen bereits geöffnet werden."
  },
  empty: {
    readyTitle: "Bereit für dein Archiv.",
    readyDetail: "Wähle oben den Ordner aus, in dem deine 3D-Druck-Dateien liegen.",
    noMatchesTitle: "Keine passenden Einträge.",
    noMatchesDetail: "Passe Suche oder Dateitypen in den Bibliothekseinstellungen an."
  },
  common: {
    folder: "Ordner",
    file: "Datei",
    library: "Bibliothek",
    mainFolder: "Hauptordner",
    filesCount: { one: "{count} Datei", other: "{count} Dateien" },
    foldersCount: { one: "{count} Ordner", other: "{count} Ordner" },
    close: "Schließen",
    cancel: "Abbrechen"
  },
  cards: {
    openProject: "Projektordner {name} öffnen",
    openFile: "Datei {name}",
    openFileViewerSuffix: " im 3D-Viewer öffnen",
    projectFolder: "Projektordner",
    fileEntry: "Datei · .{extension}",
    preview: "3D-Vorschau"
  },
  settings: {
    eyebrow: "Lokale Bibliothek",
    title: "Ordner und Dateitypen",
    foldersTitle: "Bibliotheksordner",
    foldersDetail: "Bis zu 32 Quellen, nur lesend",
    addFolders: "+ Ordner hinzufügen",
    privacy: "Pfade und Regeln bleiben auf diesem Gerät. Modelle werden nicht hochgeladen.",
    formatsTitle: "Angezeigte Dateitypen",
    formatsDetail: "Standard: STL, 3MF, OBJ und G-Code",
    standard: "Standard",
    all: "Alle",
    none: "Keine",
    unknownTitle: "Weitere Dateitypen",
    unknownDetail: "Auch nicht aufgelistete Endungen anzeigen",
    previewsTitle: "3D-Vorschaubilder",
    previewsDetail: "Für STL, 3MF und OBJ – vollständig lokal",
    previewsAutomatic: "Automatisch laden",
    previewsHelp: "Ausgeschaltet öffnet sich die Bibliothek schneller. Der drehbare 3D-Viewer bleibt weiterhin verfügbar.",
    exclusionsTitle: "Ausschlüsse",
    exclusionsDetail: "Haben immer Vorrang vor der Formatwahl",
    excludedExtensions: "Endungen ausschließen",
    excludedExtensionsPlaceholder: "z. B. pdf, zip, bak",
    excludedFiles: "Dateien oder relative Pfade ausschließen",
    excludedFilesPlaceholder: "README*\nEntwürfe/*.obj\ndefektes-modell.stl",
    rulesHelp: "Eine Regel pro Zeile · * und ? sind als Platzhalter erlaubt",
    apply: "Änderungen übernehmen",
    remove: "Entfernen",
    removeFolder: "{name} entfernen",
    noSourceTitle: "Noch keine Quelle",
    noSourceDetail: "Füge einen oder mehrere Ordner mit deinen Druckdateien hinzu.",
    addDialogTitle: "Bibliotheksordner hinzufügen",
    statusScanning: "Bibliothek wird im Hintergrund eingelesen – Einstellungen können bereits angesehen werden.",
    statusSelected: { one: "{count} Ordner ausgewählt", other: "{count} Ordner ausgewählt" },
    statusEmpty: "Noch keine Ordner ausgewählt"
  },
  formatGroups: {
    models: "Modelldateien",
    printJobs: "Druckaufträge",
    cadSources: "CAD & Quellen",
    references: "Referenzen"
  },
  roots: {
    savedNeedsRefresh: "{count} gespeicherte Ordner · Neu einlesen erforderlich",
    multiple: "{count} Ordner · {names}",
    scanning: "{count} Ordner · wird im Hintergrund eingelesen …"
  },
  project: {
    eyebrow: "Projektordner",
    selected: "Dateien ausgewählt",
    folderNavigation: "Ordnerpfad",
    paginationLabel: "Seiten im geöffneten Ordner",
    subfolder: "Unterordner",
    openFolder: "Unterordner {name} öffnen",
    emptyFolder: "Dieser Ordner enthält keine passenden Dateien oder Unterordner.",
    slicerLabel: "Slicer auswählen",
    openInSlicer: { one: "Datei in {slicer} öffnen", other: "{count} Dateien in {slicer} öffnen" },
    openingInSlicer: "Wird in {slicer} geöffnet …",
    openedInSlicer: "An {slicer} übergeben ✓",
    slicerUnsupported: "Dieses Dateiformat kann nicht an einen Slicer übergeben werden.",
    openViewer: "Im 3D-Viewer öffnen",
    selectFile: "{name} auswählen",
    selectForSlicer: "{name} für den Slicer auswählen"
  },
  previews: {
    loading: "Vorschaubilder werden geladen",
    progress: "Vorschaubilder {completed} von {total} · Einträge sind bereits nutzbar",
    unavailable: "Vorschau nicht verfügbar",
    tooLarge: "Modell ist für eine automatische Vorschau zu groß."
  },
  viewer: {
    eyebrow: "Interaktive Vorschau",
    close: "Viewer schließen",
    controls: "Ziehen: drehen · Mausrad: zoomen · Rechtsklick: verschieben",
    blenderNotRequired: "Blender wird nicht benötigt",
    unsupported: "Nicht unterstütztes Modellformat",
    emptyGeometry: "Das Modell enthält keine darstellbare Geometrie.",
    loadError: "Das Modell konnte nicht geladen werden:\n{error}"
  },
  errors: {
    libraryRead: "Die Bibliothek konnte nicht gelesen werden:\n{error}",
    slicerNoFiles: "Wähle mindestens eine kompatible Datei aus.",
    slicerTooManyFiles: "Es können höchstens 100 Dateien gleichzeitig im Slicer geöffnet werden.",
    slicerPathBlocked: "Ein Dateipfad liegt außerhalb der verwalteten Bibliothek und wurde blockiert.",
    slicerFileNotFound: "Mindestens eine ausgewählte Datei wurde nicht mehr gefunden. Lies die Bibliothek neu ein.",
    slicerUnsupportedFile: "Mindestens eine ausgewählte Datei wird vom Slicer nicht unterstützt.",
    slicerUnknown: "Der ausgewählte Slicer ist nicht zulässig.",
    slicerNotFound: "{slicer} wurde auf diesem Gerät nicht gefunden. Installiere den Slicer oder wähle einen anderen aus.",
    slicerPlatform: "Das direkte Öffnen im Slicer wird auf diesem Betriebssystem noch nicht unterstützt.",
    slicerLibraryUnavailable: "Die Bibliothek ist noch nicht vollständig eingelesen.",
    slicerLaunchFailed: "{slicer} konnte nicht gestartet werden. Prüfe die Installation und versuche es erneut."
  }
};
