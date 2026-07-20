export default {
  app: {
    title: "Druckarchiv",
    tagline: "Local model library",
    noFolder: "No archive folder selected yet",
    manageLibrary: "Manage library"
  },
  theme: {
    label: "Appearance",
    system: "System",
    light: "Light",
    dark: "Dark"
  },
  nav: {
    label: "Search and view",
    searchPlaceholder: "Search projects and files …",
    sortLabel: "Sort order",
    sortName: "Name A–Z",
    sortDate: "Recently modified",
    sortSize: "Size",
    refresh: "Rescan",
    listView: "List view",
    gridView: "Grid view",
    language: "Language"
  },
  stats: {
    label: "Archive metrics",
    projectFolders: "Project folders",
    projectFoldersSub: "Folders with files",
    allFiles: "All files",
    allFilesSub: "including subfolders"
  },
  categories: {
    stlSub: "Models",
    threeMfSub: "Print packages",
    mesh: "Mesh",
    meshSingleSub: "Model files",
    cad: "CAD",
    cadSingleSub: "CAD source",
    printJobs: "Print jobs",
    printJob: "Print job",
    references: "References",
    referenceFiles: "Reference files",
    other: "Other",
    referencesIncluded: "including references",
    moreFileTypes: "additional file types"
  },
  sections: {
    projectFolders: "Project folders",
    filesFromAllFolders: "Files from all folders",
    folderOverview: "Folder overview",
    allFiles: "All files",
    categoryFolders: "{category} folders",
    categoryFiles: "{category} files",
    viewModeLabel: "Show results as",
    folderMode: "Folders",
    fileMode: "Files",
    folderModeLabel: "Show matching project folders",
    fileModeLabel: "Show individual files"
  },
  pagination: {
    perPage: "Per page",
    perPageLabel: "Results per page",
    navigationLabel: "Result pages",
    noResults: "0 results",
    range: "{start}–{end} of {total} results",
    status: "Page {page} of {totalPages}",
    pageLabel: "Page {page}",
    previous: "Previous page",
    next: "Next page"
  },
  loading: {
    preparing: "Preparing view",
    sorting: "Sorting entries …",
    preparingWithPreviews: "Preparing entries, previews will follow …",
    preparingEntries: "Preparing entries …",
    readingLibrary: "Scanning library",
    settingsAvailable: "Library settings are already available while the scan continues."
  },
  empty: {
    readyTitle: "Ready for your archive.",
    readyDetail: "Choose the folder containing your 3D-print files above.",
    noMatchesTitle: "No matching entries.",
    noMatchesDetail: "Adjust the search or file types in the library settings."
  },
  common: {
    folder: "Folder",
    file: "File",
    library: "Library",
    mainFolder: "Root folder",
    filesCount: { one: "{count} file", other: "{count} files" },
    foldersCount: { one: "{count} folder", other: "{count} folders" },
    close: "Close",
    cancel: "Cancel"
  },
  cards: {
    openProject: "Open project folder {name}",
    openFile: "File {name}",
    openFileViewerSuffix: " — open in 3D viewer",
    projectFolder: "Project folder",
    fileEntry: "File · .{extension}",
    preview: "3D preview"
  },
  settings: {
    eyebrow: "Local library",
    title: "Folders and file types",
    foldersTitle: "Library folders",
    foldersDetail: "Up to 32 read-only sources",
    addFolders: "+ Add folders",
    privacy: "Paths and rules stay on this device. Models are never uploaded.",
    formatsTitle: "Displayed file types",
    formatsDetail: "Default: STL, 3MF, OBJ and G-code",
    standard: "Default",
    all: "All",
    none: "None",
    unknownTitle: "Additional file types",
    unknownDetail: "Also display extensions that are not listed",
    previewsTitle: "3D thumbnails",
    previewsDetail: "For STL, 3MF and OBJ — entirely local",
    previewsAutomatic: "Load automatically",
    previewsHelp: "Turning this off opens the library faster. The interactive 3D viewer remains available.",
    exclusionsTitle: "Exclusions",
    exclusionsDetail: "Always take precedence over the format selection",
    excludedExtensions: "Exclude extensions",
    excludedExtensionsPlaceholder: "e.g. pdf, zip, bak",
    excludedFiles: "Exclude files or relative paths",
    excludedFilesPlaceholder: "README*\nDrafts/*.obj\nbroken-model.stl",
    rulesHelp: "One rule per line · * and ? can be used as wildcards",
    apply: "Apply changes",
    remove: "Remove",
    removeFolder: "Remove {name}",
    noSourceTitle: "No source yet",
    noSourceDetail: "Add one or more folders containing your print files.",
    addDialogTitle: "Add library folders",
    nestedFolderSkipped: "“{folder}” is a subfolder of “{parent}” and is already displayed. The folder was therefore not added.",
    nestedFoldersSkipped: "{count} selected subfolders are already displayed through their parent folders and were therefore not added.",
    parentFolderReplacedChildren: { one: "“{folder}” was added and replaces one previously selected subfolder contained within it.", other: "“{folder}” was added and replaces {count} previously selected subfolders contained within it." },
    statusScanning: "Library scan is running in the background — settings are already available.",
    statusSelected: { one: "{count} folder selected", other: "{count} folders selected" },
    statusEmpty: "No folders selected"
  },
  formatGroups: {
    models: "Model files",
    printJobs: "Print jobs",
    cadSources: "CAD & sources",
    references: "References"
  },
  roots: {
    savedNeedsRefresh: "{count} saved folders · rescan required",
    multiple: "{count} folders · {names}",
    scanning: "{count} folders · scanning in the background …"
  },
  project: {
    eyebrow: "Project folder",
    selected: "files selected",
    folderNavigation: "Folder path",
    paginationLabel: "Pages in the open folder",
    subfolder: "Subfolder",
    openFolder: "Open subfolder {name}",
    emptyFolder: "This folder contains no matching files or subfolders.",
    slicerLabel: "Choose slicer",
    openInSlicer: { one: "Open file in {slicer}", other: "Open {count} files in {slicer}" },
    openingInSlicer: "Opening in {slicer} …",
    openedInSlicer: "Sent to {slicer} ✓",
    slicerUnsupported: "This file type cannot be sent to a slicer.",
    openViewer: "Open in 3D viewer",
    selectFile: "Select {name}",
    selectForSlicer: "Select {name} for the slicer"
  },
  previews: {
    loading: "Loading thumbnails",
    progress: "Thumbnails {completed} of {total} · entries are already usable",
    unavailable: "Preview unavailable",
    tooLarge: "Model is too large for an automatic preview."
  },
  viewer: {
    eyebrow: "Interactive preview",
    close: "Close viewer",
    controls: "Drag: rotate · Wheel: zoom · Right-click: pan",
    blenderNotRequired: "Blender is not required",
    unsupported: "Unsupported model format",
    emptyGeometry: "The model does not contain displayable geometry.",
    loadError: "The model could not be loaded:\n{error}"
  },
  errors: {
    libraryRead: "The library could not be read:\n{error}",
    slicerNoFiles: "Select at least one compatible file.",
    slicerTooManyFiles: "No more than 100 files can be opened in the slicer at once.",
    slicerPathBlocked: "A file path is outside the managed library and was blocked.",
    slicerFileNotFound: "At least one selected file could no longer be found. Rescan the library.",
    slicerUnsupportedFile: "At least one selected file is not supported by the slicer.",
    slicerUnknown: "The selected slicer is not allowed.",
    slicerNotFound: "{slicer} was not found on this device. Install the slicer or choose another one.",
    slicerPlatform: "Opening files directly in a slicer is not yet supported on this operating system.",
    slicerLibraryUnavailable: "The library has not finished loading yet.",
    slicerLaunchFailed: "{slicer} could not be started. Check the installation and try again."
  }
};
