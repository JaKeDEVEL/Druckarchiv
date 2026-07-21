import "./styles.css";
import "./quiet-material-tokens.css";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import {
  FORMAT_GROUPS,
  PRINT_EXTENSIONS,
  defaultLibrarySettings,
  isFileVisible,
  normalizeLibrarySettings,
  splitExtensionRules,
  splitFileRules
} from "./library-settings.js";
import {
  CATEGORY_BY_EXTENSION,
  CATEGORY_EXTENSIONS,
  KPI_CATEGORY_ORDER,
  selectedKpiExtensions
} from "./kpi-settings.js";
import { libraryControlState } from "./library-controls.js";
import { canOpenModelCard } from "./model-card.js";
import { createDemoArchive } from "./demo-archive.js";
import { PAGE_SIZES, normalizePageSize, paginateEntries, paginateEntriesAtSize, paginationTokens } from "./pagination.js";
import { projectBreadcrumbs, projectBrowserEntries } from "./project-browser.js";
import { applyTranslations, formatDateValue, formatNumber, getLocale, onLocaleChange, setLocale, t } from "./i18n.js";
import { isSlicerCompatible, normalizeSlicer, slicerErrorKey, slicerLabel } from "./slicer-preferences.js";
import { normalizeViewMode } from "./view-preferences.js";
import { normalizeThemePreference, resolveTheme, THEME_STORAGE_KEY } from "./theme-preferences.js";
import { releaseViewerModel } from "./viewer-lifecycle.js";
import { compatibleSelection, fileSelectionKey, selectionPayload } from "./file-selection.js";
import { PREVIEW_MATERIAL_OPTIONS } from "./preview-style.js";
import { DEFAULT_PROJECT_GRID_PAGE_SIZE, projectGridPageCapacity } from "./project-grid-pagination.js";
import { mergeLibraryRoots, rootDisplayName } from "./library-roots.js";
import { compareFavoriteState, favoriteFileKey, favoriteFolderKey, favoriteOverviewItems, favoriteToggleNeedsRender, FAVORITES_STORAGE_KEY, folderPathsForFiles, normalizeFavoriteKeys, normalizeFolderPath } from "./favorites.js";
import { createUpdateProgress, reduceUpdateProgress, updateProgressPercent } from "./update-progress.js";
import { folderLocation, isProjectLocation, libraryLocation, locationBreadcrumbs, projectLocation, sourceLocation } from "./library-navigation.js";
import { isLibraryRootAvailable, libraryRootConnectionType, unavailableLibraryConnectionType, unavailableLibraryRoots } from "./library-availability.js";

const CATEGORIES = {
  stl: { label: "STL", color: "var(--orange)", exts: CATEGORY_EXTENSIONS.stl },
  m3f: { label: "3MF", color: "var(--mint)", exts: CATEGORY_EXTENSIONS.m3f },
  mesh: { labelKey: "categories.mesh", color: "var(--blue)", exts: CATEGORY_EXTENSIONS.mesh },
  cad: { labelKey: "categories.cad", color: "var(--violet)", exts: CATEGORY_EXTENSIONS.cad },
  gcode: { label: "G-Code", color: "var(--lime)", exts: CATEGORY_EXTENSIONS.gcode },
  image: { labelKey: "categories.references", color: "var(--blue)", exts: CATEGORY_EXTENSIONS.image },
  other: { labelKey: "categories.other", color: "var(--dim)", exts: [] }
};
const extCategory = CATEGORY_BY_EXTENSION;
const formatLabels = new Map(FORMAT_GROUPS.flatMap(group => group.formats.map(format => [format.ext, format.label])));
const MODEL_EXTENSIONS = new Set(["stl", "3mf", "obj"]);
const SETTINGS_VERSION = 2;
const nf = { format: formatNumber };
const df = { format: formatDateValue };
const STORAGE_KEY = "druckarchiv.library.v1";
const PAGE_SIZE_KEY = "druckarchiv.page-size.v1";
const PROJECT_VIEW_KEY = "druckarchiv.project-view.v1";
const SLICER_KEY = "druckarchiv.slicer.v1";
const APP_VERSION = __APP_VERSION__;
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
let themePreference = normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
let currentTheme = resolveTheme(themePreference, systemThemeQuery.matches);
function restoredFavoriteKeys() {
  try {
    return normalizeFavoriteKeys(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]"));
  } catch (_) {
    localStorage.removeItem(FAVORITES_STORAGE_KEY);
    return [];
  }
}
const state = {
  archive: null,
  roots: [],
  pendingRoots: [],
  pendingRootFeedback: null,
  pendingSettings: null,
  settings: defaultLibrarySettings(),
  tab: "projects",
  category: "all",
  query: "",
  sort: "name",
  favoriteOnly: false,
  favorites: new Set(restoredFavoriteKeys()),
  view: "grid",
  projectView: normalizeViewMode(localStorage.getItem(PROJECT_VIEW_KEY)),
  slicer: normalizeSlicer(localStorage.getItem(SLICER_KEY)),
  page: 1,
  pageSize: normalizePageSize(localStorage.getItem(PAGE_SIZE_KEY)),
  projectPage: 1,
  projectGridPageSize: DEFAULT_PROJECT_GRID_PAGE_SIZE,
  projectPath: "",
  projectSelection: new Set(),
  librarySelection: new Set(),
  viewerFileKey: null,
  scanning: false,
  fileIndex: new Map(),
  favoriteEntries: [],
  libraryLocation: libraryLocation()
};
let slicerOpening = false;
let availableUpdate = null;
let updateChecking = false;
let updateProgress = createUpdateProgress();
let updateMenuStatus = { key: "updater.automaticHint", params: {} };

const byId = id => document.getElementById(id);

function syncThemeSwitch() {
  byId("themeSwitch").querySelectorAll("[data-theme-preference]").forEach(button => {
    const selected = button.dataset.themePreference === themePreference;
    button.classList.toggle("on", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function syncLocaleSwitch() {
  byId("localeSwitch").querySelectorAll("[data-locale]").forEach(button => {
    const selected = button.dataset.locale === getLocale();
    button.classList.toggle("on", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function setAppMenuOpen(open) {
  const trigger = byId("appMenuTrigger");
  byId("appMenuPanel").hidden = !open;
  trigger.classList.toggle("on", open);
  trigger.setAttribute("aria-expanded", String(open));
  const label = t(open ? "menu.close" : "menu.open");
  trigger.setAttribute("aria-label", label);
  trigger.title = label;
}

function applyTheme(preference, { persist = true } = {}) {
  themePreference = normalizeThemePreference(preference);
  currentTheme = resolveTheme(themePreference, systemThemeQuery.matches);
  document.documentElement.dataset.theme = currentTheme;
  document.documentElement.style.colorScheme = currentTheme;
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, themePreference); } catch (_) { /* storage can be unavailable */ }
  }
  syncThemeSwitch();
}

function setUpdateMenuStatus(key, params = {}) {
  updateMenuStatus = { key, params };
  byId("updateMenuStatus").textContent = t(key, params);
}

function renderAvailableUpdate(update) {
  byId("updateCurrentVersion").textContent = `v${update.currentVersion || APP_VERSION}`;
  byId("updateTargetVersion").textContent = `v${update.version}`;
  byId("updateDescription").textContent = t("updater.availableDetail");
  const notes = byId("updateNotes");
  const body = String(update.body || "").trim().slice(0, 2400);
  byId("updateNotesBody").textContent = body;
  notes.hidden = !body;
  byId("updateProgressWrap").hidden = true;
  byId("updateError").hidden = true;
  byId("installUpdate").disabled = false;
  byId("installUpdate").textContent = t("updater.install");
  byId("postponeUpdate").disabled = false;
}

function showAvailableUpdate(update) {
  availableUpdate = update;
  setUpdateMenuStatus("updater.available", { version: update.version });
  renderAvailableUpdate(update);
  setAppMenuOpen(false);
  if (!byId("updateDialog").open) byId("updateDialog").showModal();
}

function updateDownloadProgress(event) {
  updateProgress = reduceUpdateProgress(updateProgress, event);
  const percent = updateProgressPercent(updateProgress);
  const progressBar = byId("updateProgressBar");
  const progressTrack = progressBar.parentElement;
  progressBar.style.width = percent === null ? "38%" : `${percent}%`;
  progressTrack.classList.toggle("indeterminate", percent === null && !updateProgress.finished);
  if (percent === null) {
    byId("updateProgressPercent").textContent = "";
    progressTrack.removeAttribute("aria-valuenow");
  } else {
    byId("updateProgressPercent").textContent = `${percent}%`;
    progressTrack.setAttribute("aria-valuenow", String(percent));
  }
}

async function installAvailableUpdate() {
  if (!availableUpdate) return;
  const installButton = byId("installUpdate");
  const postponeButton = byId("postponeUpdate");
  installButton.disabled = true;
  postponeButton.disabled = true;
  byId("updateError").hidden = true;
  byId("updateProgressWrap").hidden = false;
  byId("updateProgressText").textContent = t("updater.downloading");
  updateProgress = createUpdateProgress();
  updateDownloadProgress({ event: "Started", data: {} });

  try {
    await availableUpdate.downloadAndInstall(updateDownloadProgress);
    byId("updateProgressText").textContent = t("updater.installing");
    updateDownloadProgress({ event: "Finished" });
    if (availableUpdate.demo) {
      postponeButton.disabled = false;
      postponeButton.textContent = t("common.close");
      return;
    }
    await relaunch();
  } catch (_) {
    const error = byId("updateError");
    error.textContent = t("updater.failed");
    error.hidden = false;
    installButton.disabled = false;
    installButton.textContent = t("updater.retry");
    postponeButton.disabled = false;
  }
}

async function dismissAvailableUpdate() {
  const update = availableUpdate;
  availableUpdate = null;
  if (byId("updateDialog").open) byId("updateDialog").close();
  byId("postponeUpdate").textContent = t("updater.later");
  if (update && !update.demo) {
    try { await update.close(); } catch (_) { /* already released by the plugin */ }
  }
}

function demoUpdate() {
  return {
    demo: true,
    currentVersion: APP_VERSION,
    version: "0.8.9",
    body: getLocale() === "de"
      ? "Automatische Update-Prüfung beim Start · signierte Downloads · sichtbarer Installationsfortschritt"
      : "Automatic startup checks · signed downloads · visible installation progress",
    async downloadAndInstall(onEvent) {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      for (const chunkLength of [18, 24, 28, 30]) {
        await new Promise(resolve => setTimeout(resolve, 140));
        onEvent({ event: "Progress", data: { chunkLength } });
      }
      onEvent({ event: "Finished" });
    }
  };
}

async function checkForAppUpdate({ manual = false } = {}) {
  if (updateChecking) return;
  updateChecking = true;
  const button = byId("checkForUpdates");
  button.disabled = true;
  button.classList.add("is-checking");
  setUpdateMenuStatus("updater.checking");

  try {
    const updateDemo = import.meta.env.DEV && new URLSearchParams(location.search).get("updateDemo") === "1";
    if (updateDemo) {
      showAvailableUpdate(demoUpdate());
      return;
    }
    if (!isTauri()) {
      if (manual) setUpdateMenuStatus("updater.unavailableInBrowser");
      else setUpdateMenuStatus("updater.automaticHint");
      return;
    }
    const update = await check({ timeout: 15000 });
    if (update) showAvailableUpdate(update);
    else setUpdateMenuStatus("updater.current");
  } catch (_) {
    if (manual) setUpdateMenuStatus("updater.checkFailed");
    else setUpdateMenuStatus("updater.automaticHint");
  } finally {
    updateChecking = false;
    button.disabled = false;
    button.classList.remove("is-checking");
  }
}
const categoryLabel = category => CATEGORIES[category]?.label || t(CATEGORIES[category]?.labelKey || "categories.other");
const categoryOf = file => extCategory.get(file.extension.toLowerCase()) || "other";
const isViewable = file => MODEL_EXTENSIONS.has(file.extension.toLowerCase());
const formatSize = bytes => {
  if (bytes >= 1e9) return `${nf.format(Math.round(bytes / 1e8) / 10)} GB`;
  if (bytes >= 1e6) return `${nf.format(Math.round(bytes / 1e5) / 10)} MB`;
  if (bytes >= 1e3) return `${nf.format(Math.round(bytes / 100) / 10)} KB`;
  return `${bytes} B`;
};
const formatDate = seconds => df.format(new Date(seconds * 1000));
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const matchesCategory = file => state.category === "all" || (state.category === "other" ? ["other", "image"].includes(categoryOf(file)) : categoryOf(file) === state.category);
const matchesQuery = value => !state.query || value.toLocaleLowerCase("de").includes(state.query);
const rootOf = item => state.archive?.roots[item.rootIndex];
const visibleFile = file => isFileVisible(file, state.settings, rootOf(file)?.name || "");
const favoriteKeyOf = file => favoriteFileKey(file, rootOf(file)?.path || "");
const isFavorite = file => state.favorites.has(favoriteKeyOf(file));
const filteredProjectFiles = project => project.files.filter(file => visibleFile(file) && matchesCategory(file));
const projectFolderPath = (project, path = "") => path ? `${project?.name || ""}/${path}`.replace(/^\//, "") : (project?.name || "");
const folderFavoriteKeyOf = (rootIndex, path) => favoriteFolderKey(state.archive?.roots[rootIndex]?.path || "", path);
const isFolderFavorite = (rootIndex, path) => state.favorites.has(folderFavoriteKeyOf(rootIndex, path));

function folderHasFavorite(project, folderPath, files) {
  const fullPath = projectFolderPath(project, folderPath);
  if (isFolderFavorite(project.rootIndex, fullPath)) return true;
  const prefix = `${fullPath}/`;
  if (files.some(file => isFavorite(file) && file.path.replace(/\\/g, "/").startsWith(prefix))) return true;
  return folderPathsForFiles(project.name, files).some(path => path.startsWith(prefix) && isFolderFavorite(project.rootIndex, path));
}

function allFiles() {
  if (!state.archive) return [];
  return [...state.archive.loose, ...state.archive.projects.flatMap(project => project.files)];
}

function visibleFiles() {
  return allFiles().filter(visibleFile);
}

function activeLibraryProject() {
  if (!isProjectLocation(state.libraryLocation)) return null;
  return state.archive?.projects[state.libraryLocation.projectIndex] || null;
}

function currentLibraryView() {
  return activeLibraryProject() ? state.projectView : state.view;
}

function setLibraryLocation(location, { resetCategory = false } = {}) {
  state.libraryLocation = location;
  state.tab = "projects";
  state.favoriteOnly = false;
  state.page = 1;
  if (resetCategory) state.category = "all";
}

function renderLibraryBreadcrumb() {
  const breadcrumb = byId("libraryBreadcrumb");
  const project = activeLibraryProject();
  const rootIndex = state.libraryLocation.rootIndex;
  let crumbs = [];
  if (project) {
    crumbs = locationBreadcrumbs(project, state.libraryLocation.path, t("sidebar.library"));
  } else if (rootIndex !== null) {
    crumbs = [
      { name: t("sidebar.library"), kind: "library", path: null },
      { name: state.archive?.roots[rootIndex]?.name || t("common.folder"), kind: "source", path: "" }
    ];
  }
  breadcrumb.hidden = crumbs.length === 0;
  breadcrumb.innerHTML = crumbs.map((crumb, index) => {
    const current = index === crumbs.length - 1;
    const name = escapeHtml(crumb.name);
    if (current) return `<span aria-current="page">${name}</span>`;
    if (crumb.kind === "library") return `<button type="button" data-library-home>${name}</button><i aria-hidden="true">/</i>`;
    return `<button type="button" data-library-folder-path="${escapeHtml(crumb.path)}">${name}</button><i aria-hidden="true">/</i>`;
  }).join("");
}

function renderSidebar() {
  const files = visibleFiles();
  const favorites = favoriteOverviewItems(state.favoriteEntries, state.favorites).length;
  byId("sideLibraryCount").textContent = nf.format(files.length);
  byId("sideFavoriteCount").textContent = nf.format(favorites);
  const libraryActive = !state.favoriteOnly;
  byId("sideLibrary").classList.toggle("on", libraryActive);
  byId("sideLibrary").setAttribute("aria-pressed", String(libraryActive));
  byId("sideFavorites").classList.toggle("on", state.favoriteOnly);
  byId("sideFavorites").setAttribute("aria-pressed", String(state.favoriteOnly));

  const roots = state.archive?.roots || state.roots.map(path => ({ path, name: rootDisplayName(path) }));
  byId("sideRootList").innerHTML = roots.map((root, rootIndex) => {
    const count = files.filter(file => file.rootIndex === rootIndex).length;
    const active = !state.favoriteOnly && !isProjectLocation(state.libraryLocation) && state.libraryLocation.rootIndex === rootIndex;
    const available = isLibraryRootAvailable(root);
    const name = root.name || rootDisplayName(root.path);
    const connectionType = libraryRootConnectionType(root);
    const unavailableTitleKey = connectionType === "external"
      ? "sidebar.externalSourceUnavailable"
      : (connectionType === "network" ? "sidebar.networkSourceUnavailable" : "sidebar.sourceUnavailable");
    const title = available ? (root.path || name) : t(unavailableTitleKey, { name });
    const status = available ? nf.format(count) : t("sidebar.offline");
    return `<button class="side-root-item ${active ? "on" : ""} ${available ? "" : "is-unavailable"}" type="button" data-side-root="${rootIndex}" aria-pressed="${active}" title="${escapeHtml(title)}"><span aria-hidden="true"><svg viewBox="0 0 16 13"><path d="M1 3h6l2 2h6v7H1z"/></svg></span><span>${escapeHtml(name)}</span><small class="${available ? "" : "source-offline-status"}">${escapeHtml(status)}</small></button>`;
  }).join("");

  const root = state.libraryLocation.rootIndex === null ? null : state.archive?.roots[state.libraryLocation.rootIndex];
  byId("workspaceTitle").textContent = state.favoriteOnly
    ? t("sidebar.favorites")
    : (root?.name || t("sidebar.library"));
  renderLibraryBreadcrumb();
}

function renderSourceAvailability() {
  const warning = byId("librarySourceWarning");
  const unavailable = unavailableLibraryRoots(state.archive);
  warning.hidden = unavailable.length === 0;
  if (!unavailable.length) return;
  const names = unavailable.map(root => root.name || rootDisplayName(root.path)).join(" · ");
  const connectionType = unavailableLibraryConnectionType(unavailable);
  const titleKey = connectionType === "external"
    ? "availability.externalTitle"
    : (connectionType === "network" ? "availability.networkTitle" : "availability.title");
  const detailKey = connectionType === "external"
    ? "availability.externalDetail"
    : (connectionType === "network" ? "availability.networkDetail" : "availability.detail");
  byId("librarySourceWarningTitle").textContent = t(titleKey, {
    count: unavailable.length,
    names
  });
  byId("librarySourceWarningDetail").textContent = t(detailKey);
}

function favoriteFolderEntry(project, projectIndex, fullPath, files) {
  const normalizedProjectPath = normalizeFolderPath(project.name);
  const normalizedFullPath = normalizeFolderPath(fullPath);
  const relativePath = normalizedFullPath === normalizedProjectPath
    ? ""
    : normalizedFullPath.slice(normalizedProjectPath.length + 1);
  const prefix = `${normalizedFullPath}/`;
  const folderFiles = files.filter(file => normalizeFolderPath(file.path).startsWith(prefix));
  if (!folderFiles.length) return null;
  return {
    kind: "folder",
    favoriteKey: folderFavoriteKeyOf(project.rootIndex, normalizedFullPath),
    project,
    projectIndex,
    path: relativePath,
    fullPath: normalizedFullPath,
    name: relativePath.split("/").filter(Boolean).pop() || project.displayName,
    files: folderFiles,
    size: folderFiles.reduce((sum, file) => sum + Number(file.size || 0), 0),
    modified: Math.max(...folderFiles.map(file => Number(file.modified || 0)))
  };
}

function availableFavoriteEntries() {
  const entries = visibleFiles().map(file => ({
    kind: "file",
    favoriteKey: favoriteKeyOf(file),
    file,
    name: file.name,
    size: Number(file.size || 0),
    modified: Number(file.modified || 0)
  }));
  for (const [projectIndex, project] of (state.archive?.projects || []).entries()) {
    const files = project.files.filter(visibleFile);
    for (const path of folderPathsForFiles(project.name, files)) {
      const entry = favoriteFolderEntry(project, projectIndex, path, files);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

function rebuildFavoriteInventory() {
  state.favoriteEntries = availableFavoriteEntries();
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...state.favorites]));
}

function updateFavoriteControls() {
  const count = favoriteOverviewItems(state.favoriteEntries, state.favorites).length;
  const button = byId("favoriteFilter");
  button.classList.toggle("on", state.favoriteOnly);
  button.setAttribute("aria-pressed", String(state.favoriteOnly));
  button.setAttribute("aria-label", t(state.favoriteOnly ? "favorites.showAll" : "favorites.showOnly"));
  button.textContent = `${state.favoriteOnly ? "★" : "☆"} ${t("favorites.filter", { count })}`;
}

function favoriteButton(file, className = "") {
  const favorite = isFavorite(file);
  const label = t(favorite ? "favorites.remove" : "favorites.add", { name: file.name });
  return `<button class="favorite-button ${className} ${favorite ? "on" : ""}" type="button" data-favorite-root="${file.rootIndex}" data-favorite-path="${escapeHtml(file.path)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-pressed="${favorite}"><span aria-hidden="true">${favorite ? "★" : "☆"}</span></button>`;
}

function folderFavoriteButton(rootIndex, path, name, className = "") {
  const favorite = isFolderFavorite(rootIndex, path);
  const label = t(favorite ? "favorites.removeFolder" : "favorites.addFolder", { name });
  return `<button class="favorite-button ${className} ${favorite ? "on" : ""}" type="button" data-favorite-folder-root="${rootIndex}" data-favorite-folder-path="${escapeHtml(path)}" data-favorite-folder-name="${escapeHtml(name)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-pressed="${favorite}"><span aria-hidden="true">${favorite ? "★" : "☆"}</span></button>`;
}

function favoriteFileFromControl(control) {
  return state.fileIndex.get(`${control.dataset.favoriteRoot}\n${control.dataset.favoritePath}`);
}

function updateFavoriteButton(control, favorite, label) {
  control.classList.toggle("on", favorite);
  control.setAttribute("aria-pressed", String(favorite));
  control.setAttribute("aria-label", label);
  control.title = label;
  control.querySelector("span").textContent = favorite ? "★" : "☆";
}

function refreshVisibleFavoriteButtons() {
  document.querySelectorAll("[data-favorite-path]").forEach(control => {
    const file = favoriteFileFromControl(control);
    if (!file) return;
    const favorite = isFavorite(file);
    updateFavoriteButton(control, favorite, t(favorite ? "favorites.remove" : "favorites.add", { name: file.name }));
  });
  document.querySelectorAll("[data-favorite-folder-path]").forEach(control => {
    const favorite = isFolderFavorite(Number(control.dataset.favoriteFolderRoot), control.dataset.favoriteFolderPath);
    const name = control.dataset.favoriteFolderName || control.dataset.favoriteFolderPath.split("/").pop();
    updateFavoriteButton(control, favorite, t(favorite ? "favorites.removeFolder" : "favorites.addFolder", { name }));
  });
}

function finishFavoriteToggle() {
  saveFavorites();
  refreshVisibleFavoriteButtons();
  updateFavoriteControls();
  renderSidebar();
  updateViewerFavoriteAction();
  const needsRender = favoriteToggleNeedsRender(state.favoriteOnly, state.sort);
  if (needsRender) scheduleLibraryRender({ resetPage: true, showLoading: false });
  if (needsRender && projectDialog.open && projectDialog.dataset.projectIndex !== undefined) {
    renderProjectContents(Number(projectDialog.dataset.projectIndex));
  }
}

function toggleFavorite(file) {
  if (!file) return;
  const key = favoriteKeyOf(file);
  if (!key) return;
  if (state.favorites.has(key)) state.favorites.delete(key);
  else state.favorites.add(key);
  finishFavoriteToggle();
}

function toggleFolderFavorite(rootIndex, path) {
  const key = folderFavoriteKeyOf(rootIndex, path);
  if (!key) return;
  if (state.favorites.has(key)) state.favorites.delete(key);
  else state.favorites.add(key);
  finishFavoriteToggle();
}

function previewAttributes(file) {
  if (!state.settings.showPreviews || !file || !isViewable(file) || file.demoPreview) return "";
  return `data-preview-root="${file.rootIndex}" data-preview-path="${escapeHtml(file.path)}"`;
}

function demoPreviewMarkup(file) {
  if (!state.settings.showPreviews || !file?.demoPreview) return "";
  return `<img class="model-thumbnail" src="${escapeHtml(file.demoPreview)}" alt="">`;
}

function previewCoverClass(file) {
  return state.settings.showPreviews && file?.demoPreview ? "has-thumbnail" : "";
}

function kpiDescriptor(category, extensions) {
  const labels = extensions.map(extension => formatLabels.get(extension) || extension.toUpperCase());
  const singleLabel = labels.length === 1 ? labels[0] : null;
  if (category === "stl") return { label: "STL", sub: t("categories.stlSub") };
  if (category === "m3f") return { label: "3MF", sub: t("categories.threeMfSub") };
  if (category === "mesh") return { label: singleLabel || t("categories.mesh"), sub: singleLabel ? t("categories.meshSingleSub") : labels.join(" · ") };
  if (category === "cad") return { label: singleLabel || t("categories.cad"), sub: singleLabel ? t("categories.cadSingleSub") : labels.join(" · ") };
  if (category === "gcode") return { label: singleLabel || t("categories.printJobs"), sub: singleLabel ? t("categories.printJob") : labels.join(" · ") };
  if (state.settings.includeUnknown) return { label: t("categories.other"), sub: labels.length ? t("categories.referencesIncluded") : t("categories.moreFileTypes") };
  return { label: singleLabel || t("categories.references"), sub: singleLabel ? t("categories.referenceFiles") : labels.join(" · ") };
}

function activeFormatTiles(counts) {
  const selected = selectedKpiExtensions(state.settings);
  return KPI_CATEGORY_ORDER.filter(category => Object.hasOwn(selected, category)).map(category => ({
    ...kpiDescriptor(category, selected[category]),
    value: category === "other" ? counts.other + counts.image : counts[category],
    color: CATEGORIES[category].color,
    category
  }));
}

function renderStats() {
  const files = visibleFiles();
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map(key => [key, 0]));
  files.forEach(file => counts[categoryOf(file)]++);
  const projects = state.archive?.projects.filter(project => project.files.some(visibleFile)).length || 0;
  const formatTiles = activeFormatTiles(counts);
  if (state.category !== "all" && !formatTiles.some(tile => tile.category === state.category)) state.category = "all";
  const tiles = [
    { label: t("stats.projectFolders"), value: projects, sub: t("stats.projectFoldersSub"), color: "var(--mint)", tab: "projects" },
    { label: t("stats.allFiles"), value: files.length, sub: t("stats.allFilesSub"), color: "var(--dim)", tab: "files" },
    ...formatTiles
  ];
  byId("stats").innerHTML = tiles.map(tile => {
    const disabled = state.favoriteOnly && Boolean(tile.tab);
    const active = tile.category ? state.category === tile.category : !state.favoriteOnly && state.category === "all" && state.tab === tile.tab;
    const attrs = `data-${tile.category ? "category" : "tab"}="${tile.category || tile.tab}" aria-pressed="${active}" ${disabled ? "disabled" : ""}`;
    return `<button class="stat action ${active ? "on" : ""}" style="--tone:${tile.color}" ${attrs}><label>${tile.label}</label><b>${nf.format(tile.value)}</b><span>${tile.sub}</span></button>`;
  }).join("");
}

function projectCard(project) {
  const shownFiles = filteredProjectFiles(project);
  const cats = {};
  shownFiles.forEach(file => { const key = categoryOf(file); cats[key] = (cats[key] || 0) + 1; });
  const dominant = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";
  const badges = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key, count]) => `<span class="badge">${categoryLabel(key)} ${nf.format(count)}</span>`).join("");
  const size = shownFiles.reduce((sum, file) => sum + file.size, 0);
  const root = rootOf(project);
  const projectIndex = state.archive.projects.indexOf(project);
  const representative = shownFiles.find(isViewable);
  return `<article class="card folder-card" data-project-index="${projectIndex}" style="--tone:${CATEGORIES[dominant].color}"><button class="folder-card-open" type="button" aria-label="${escapeHtml(t("cards.openProject", { name: project.displayName }))}"><div class="card-cover folder-cover ${previewCoverClass(representative)}" ${previewAttributes(representative)} aria-hidden="true">${demoPreviewMarkup(representative)}<span class="folder-mark"><svg viewBox="0 0 64 48"><path d="M4 12h22l6 7h28v25H4z"/></svg></span><span class="kind-flag folder-flag"><svg viewBox="0 0 16 13"><path d="M1 3h6l2 2h6v7H1z"/></svg> ${t("common.folder")}</span><span class="cover-label">${categoryLabel(dominant)}</span></div><div class="card-body"><div class="entry-kind">${t("cards.projectFolder")}</div><h3>${escapeHtml(project.displayName)}</h3><div class="meta"><span>${t("common.filesCount", { count: shownFiles.length })}</span><span>${formatSize(size)}</span><span>${formatDate(project.modified)}</span></div><div class="badges">${badges}<span class="badge source-badge" title="${escapeHtml(root?.path || "")}">${escapeHtml(root?.name || t("common.library"))}</span></div></div></button>${folderFavoriteButton(project.rootIndex, projectFolderPath(project), project.displayName, "library-folder-favorite")}</article>`;
}

function favoriteFolderCard(entry) {
  const shownFiles = entry.files.filter(matchesCategory);
  const categories = {};
  shownFiles.forEach(file => {
    const key = categoryOf(file);
    categories[key] = (categories[key] || 0) + 1;
  });
  const dominant = Object.entries(categories).sort((left, right) => right[1] - left[1])[0]?.[0] || "other";
  const badges = Object.entries(categories).sort((left, right) => right[1] - left[1]).slice(0, 4)
    .map(([key, count]) => `<span class="badge">${categoryLabel(key)} ${nf.format(count)}</span>`).join("");
  const size = shownFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const modified = Math.max(...shownFiles.map(file => Number(file.modified || 0)));
  const representative = shownFiles.find(isViewable);
  const root = rootOf(entry.project);
  const kind = entry.path ? t("project.subfolder") : t("cards.projectFolder");
  return `<article class="card folder-card" data-project-index="${entry.projectIndex}" data-project-path="${escapeHtml(entry.path)}" style="--tone:${CATEGORIES[dominant].color}"><button class="folder-card-open" type="button" aria-label="${escapeHtml(t("project.openFolder", { name: entry.name }))}"><div class="card-cover folder-cover ${previewCoverClass(representative)}" ${previewAttributes(representative)} aria-hidden="true">${demoPreviewMarkup(representative)}<span class="folder-mark"><svg viewBox="0 0 64 48"><path d="M4 12h22l6 7h28v25H4z"/></svg></span><span class="kind-flag folder-flag"><svg viewBox="0 0 16 13"><path d="M1 3h6l2 2h6v7H1z"/></svg> ${t("common.folder")}</span><span class="cover-label">${categoryLabel(dominant)}</span></div><div class="card-body"><div class="entry-kind">${kind}</div><h3 title="${escapeHtml(entry.fullPath)}">${escapeHtml(entry.name)}</h3><div class="meta"><span>${t("common.filesCount", { count: shownFiles.length })}</span><span>${formatSize(size)}</span><span>${formatDate(modified)}</span></div><div class="badges">${badges}<span class="badge source-badge" title="${escapeHtml(root?.path || "")}">${escapeHtml(root?.name || t("common.library"))}</span></div></div></button>${folderFavoriteButton(entry.project.rootIndex, entry.fullPath, entry.name, "library-folder-favorite")}</article>`;
}

function libraryProjectFolderCard(project, entry) {
  return favoriteFolderCard({
    ...entry,
    project,
    projectIndex: state.libraryLocation.projectIndex,
    fullPath: projectFolderPath(project, entry.path)
  });
}

function fileCard(file) {
  const category = categoryOf(file);
  const viewable = isViewable(file);
  const root = rootOf(file);
  const ariaLabel = `${t("cards.openFile", { name: file.name })}${viewable ? t("cards.openFileViewerSuffix") : ""}`;
  const key = fileSelectionKey(file);
  const compatible = isSlicerCompatible(file.extension, state.slicer);
  const checked = state.librarySelection.has(key);
  const selectionTitle = compatible ? t("project.selectForSlicer", { name: file.name }) : t("project.slicerUnsupported");
  const selectionControl = `<label class="library-file-select" title="${escapeHtml(selectionTitle)}"><input type="checkbox" data-library-path="${escapeHtml(file.path)}" data-root-index="${file.rootIndex}" aria-label="${escapeHtml(selectionTitle)}" ${checked ? "checked" : ""} ${compatible ? "" : "disabled"}></label>`;
  return `<article class="card file-card ${checked ? "is-selected" : ""}" data-file="${escapeHtml(file.path)}" data-root-index="${file.rootIndex}" ${viewable ? 'data-viewable="true"' : ""} style="--tone:${CATEGORIES[category].color}"><button class="file-card-open" type="button" aria-label="${escapeHtml(ariaLabel)}"><div class="card-cover file-cover ${previewCoverClass(file)}" ${previewAttributes(file)} aria-hidden="true">${demoPreviewMarkup(file)}<span class="file-mark">${escapeHtml(file.extension.toUpperCase() || t("common.file").toUpperCase())}</span><span class="kind-flag file-flag">${t("common.file")}</span></div><div class="card-body"><div class="entry-kind">${t("cards.fileEntry", { extension: escapeHtml(file.extension || "–") })}</div><h3>${escapeHtml(file.name)}</h3><div class="meta"><span>${formatSize(file.size)}</span><span>${formatDate(file.modified)}</span><span>${escapeHtml(file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : t("common.mainFolder"))}</span></div><div class="badges"><span class="badge">${categoryLabel(category)}</span>${viewable ? `<span class="badge">${t("cards.preview")}</span>` : ""}<span class="badge source-badge">${escapeHtml(root?.name || t("common.library"))}</span></div></div></button>${favoriteButton(file, "library-favorite")}${selectionControl}</article>`;
}

let libraryRenderSequence = 0;
let previewProgress = { sequence: 0, total: 0, completed: 0 };

function setLibraryLoading(loading, title = t("loading.preparing"), detail = t("loading.sorting")) {
  const library = byId("library");
  byId("libraryLoading").hidden = !loading;
  byId("loadingTitle").textContent = title;
  byId("loadingDetail").textContent = detail;
  library.classList.toggle("is-preparing", loading);
  library.setAttribute("aria-busy", String(loading));
  if (loading) byId("empty").classList.remove("show");
}

function resetPreviewProgress(sequence) {
  previewProgress = { sequence, total: 0, completed: 0 };
  byId("previewStatus").hidden = true;
  byId("previewProgressBar").style.width = "0%";
}

function updateViewModeSwitch(containerId, dataKey, activeMode) {
  byId(containerId).querySelectorAll(`[data-${dataKey}]`).forEach(button => {
    const mode = button.dataset[dataKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())];
    const active = mode === activeMode;
    const label = t(mode === "grid" ? "nav.gridView" : "nav.listView");
    button.classList.toggle("on", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", label);
    button.title = label;
    button.dataset.tooltip = label;
  });
}

function updateToolbarControls() {
  updateViewModeSwitch("viewModeSwitch", "view-mode", currentLibraryView());
  const refresh = byId("refreshLibrary");
  const refreshLabel = t("nav.refresh");
  refresh.setAttribute("aria-label", refreshLabel);
  refresh.title = refreshLabel;
  refresh.dataset.tooltip = refreshLabel;
}

function updateSectionLabels() {
  const selected = selectedKpiExtensions(state.settings);
  const categoryLabel = state.category === "all" ? "" : kpiDescriptor(state.category, selected[state.category] || []).label;
  const project = activeLibraryProject();
  const folderName = state.libraryLocation.path.split("/").filter(Boolean).pop();
  byId("sectionKicker").textContent = project
    ? (folderName ? t("project.subfolder") : t("project.eyebrow"))
    : (state.favoriteOnly
      ? t("sections.favoriteEntries")
      : (state.tab === "projects" ? t("sections.projectFolders") : t("sections.filesFromAllFolders")));
  byId("sectionTitle").textContent = project
    ? (folderName || project.displayName)
    : (state.favoriteOnly
      ? (state.category === "all" ? t("sections.favoritesOverview") : t("sections.categoryFavorites", { category: categoryLabel }))
      : (state.category === "all"
        ? (state.tab === "projects" ? t("sections.folderOverview") : t("sections.allFiles"))
        : t(state.tab === "projects" ? "sections.categoryFolders" : "sections.categoryFiles", { category: categoryLabel })));
  const libraryModeSwitch = byId("libraryModeSwitch");
  libraryModeSwitch.hidden = state.favoriteOnly || Boolean(project);
  libraryModeSwitch.querySelectorAll("[data-library-tab]").forEach(button => {
    const active = button.dataset.libraryTab === state.tab;
    button.classList.toggle("on", active);
    button.setAttribute("aria-pressed", String(active));
  });
  updateToolbarControls();
  updateFavoriteControls();
  updateLibrarySelection();
  renderSidebar();
}

function updateLibrarySelection() {
  const selection = byId("librarySelection");
  const count = state.librarySelection.size;
  const selectionContext = state.favoriteOnly || state.tab === "files" || Boolean(activeLibraryProject());
  selection.hidden = !state.archive || !selectionContext || count === 0;
  const slicer = slicerLabel(state.slicer);
  byId("librarySelectedCount").textContent = nf.format(count);
  byId("librarySlicerSelect").value = state.slicer;
  const openButton = byId("openLibrarySelectionInSlicer");
  openButton.disabled = slicerOpening || count === 0;
  openButton.textContent = t(slicerOpening ? "project.openingInSlicer" : "project.openInSlicer", { count, slicer });
}

function scheduleLibraryRender({ resetPage = false, scrollToResults = false, showLoading = true } = {}) {
  if (resetPage) state.page = 1;
  const sequence = ++libraryRenderSequence;
  previewObserver?.disconnect();
  previewQueue.length = 0;
  resetPreviewProgress(sequence);
  updateSectionLabels();
  byId("pagination").hidden = true;
  if (showLoading) setLibraryLoading(true, byId("sectionTitle").textContent, state.settings.showPreviews ? t("loading.preparingWithPreviews") : t("loading.preparingEntries"));
  const renderNextFrame = () => requestAnimationFrame(() => {
    if (sequence !== libraryRenderSequence) return;
    renderLibrary(sequence);
    if (scrollToResults) byId("sectionTitle").scrollIntoView({ block: "start" });
  });
  if (showLoading) requestAnimationFrame(renderNextFrame);
  else renderNextFrame();
}

function renderEntryBatch(entries, sequence, offset = 0) {
  if (sequence !== libraryRenderSequence) return;
  const library = byId("library");
  const batchSize = currentLibraryView() === "grid" ? 72 : 140;
  const end = Math.min(offset + batchSize, entries.length);
  const project = activeLibraryProject();
  library.insertAdjacentHTML("beforeend", entries.slice(offset, end).map(entry => {
    if (state.favoriteOnly) return entry.kind === "folder" ? favoriteFolderCard(entry) : fileCard(entry.file);
    if (project) return entry.kind === "folder" ? libraryProjectFolderCard(project, entry) : fileCard(entry.file);
    return state.tab === "projects" ? projectCard(entry) : fileCard(entry);
  }).join(""));
  hydrateModelPreviews(sequence);
  if (offset === 0) setLibraryLoading(false);
  if (end < entries.length) {
    requestAnimationFrame(() => renderEntryBatch(entries, sequence, end));
  } else {
    library.setAttribute("aria-busy", "false");
  }
}

function renderPagination(result, { hidePageSize = false, stepOnly = false } = {}) {
  const pagination = byId("pagination");
  const pageSizeControl = byId("pageSizeControl");
  byId("pageSize").value = String(result.pageSize);
  pageSizeControl.hidden = hidePageSize || result.total <= PAGE_SIZES[0];

  if (!result.total) {
    byId("resultCount").textContent = t("pagination.noResults");
    pagination.hidden = true;
    byId("pageButtons").innerHTML = "";
    return;
  }

  byId("resultCount").textContent = t("pagination.range", { start: result.start + 1, end: result.end, total: result.total });
  pagination.hidden = result.totalPages <= 1;
  byId("pageStatus").textContent = t("pagination.status", { page: result.page, totalPages: result.totalPages });
  if (pagination.hidden) {
    byId("pageButtons").innerHTML = "";
    return;
  }

  if (stepOnly) {
    byId("pageButtons").innerHTML = `<button class="page-step" type="button" data-page="${result.page - 1}" ${result.page === 1 ? "disabled" : ""} aria-label="${t("pagination.previous")}">←</button><button class="page-step" type="button" data-page="${result.page + 1}" ${result.page === result.totalPages ? "disabled" : ""} aria-label="${t("pagination.next")}">→</button>`;
    return;
  }

  const pageButtons = paginationTokens(result.page, result.totalPages).map(token => token === "ellipsis"
    ? '<span class="page-ellipsis" aria-hidden="true">…</span>'
    : `<button class="page-number ${token === result.page ? "current" : ""}" type="button" data-page="${token}" ${token === result.page ? 'aria-current="page"' : ""} aria-label="${t("pagination.pageLabel", { page: token })}">${nf.format(token)}</button>`).join("");
  byId("pageButtons").innerHTML = `<button class="page-step" type="button" data-page="${result.page - 1}" ${result.page === 1 ? "disabled" : ""} aria-label="${t("pagination.previous")}">←</button>${pageButtons}<button class="page-step" type="button" data-page="${result.page + 1}" ${result.page === result.totalPages ? "disabled" : ""} aria-label="${t("pagination.next")}">→</button>`;
}

function renderLibrary(sequence = ++libraryRenderSequence) {
  const library = byId("library");
  previewObserver?.disconnect();
  previewQueue.length = 0;
  resetPreviewProgress(sequence);
  library.classList.toggle("list", currentLibraryView() === "list");
  library.innerHTML = "";
  if (!state.archive) {
    setLibraryLoading(false);
    byId("empty").classList.add("show");
    renderPagination(paginateEntries([], state.page, state.pageSize));
    updateSectionLabels();
    return;
  }
  let entries;
  let project = activeLibraryProject();
  if (isProjectLocation(state.libraryLocation) && !project) {
    state.libraryLocation = libraryLocation();
  }
  if (state.favoriteOnly) {
    entries = favoriteOverviewItems(state.favoriteEntries, state.favorites).filter(entry => {
      if (entry.kind === "file") {
        const file = entry.file;
        return matchesCategory(file) && matchesQuery(`${file.name} ${file.path} ${rootOf(file)?.name || ""}`);
      }
      if (!entry.files.some(matchesCategory)) return false;
      return matchesQuery(`${entry.name} ${entry.fullPath} ${entry.project.displayName} ${rootOf(entry.project)?.name || ""}`);
    });
  } else if (project) {
    const files = filteredProjectFiles(project).filter(file => matchesQuery(`${file.name} ${file.path}`));
    entries = projectBrowserEntries(project, files, state.libraryLocation.path);
  } else if (state.tab === "projects") {
    entries = state.archive.projects.filter(project => {
      if (state.libraryLocation.rootIndex !== null && project.rootIndex !== state.libraryLocation.rootIndex) return false;
      const files = filteredProjectFiles(project);
      if (!files.length) return false;
      if (!state.query || matchesQuery(`${project.displayName} ${project.name}`)) return true;
      return files.some(file => matchesQuery(file.path));
    });
  } else {
    entries = allFiles().filter(file => visibleFile(file) && matchesCategory(file) && matchesQuery(`${file.name} ${file.path} ${rootOf(file)?.name || ""}`));
  }
  entries.sort((a, b) => {
    if (project) return compareProjectEntries(a, b, project);
    if (state.favoriteOnly) {
      if (state.sort === "date") return b.modified - a.modified;
      if (state.sort === "size") return b.size - a.size;
      return a.name.localeCompare(b.name, getLocale());
    }
    if (state.sort === "favorite") {
      const leftFavorite = state.tab === "projects" ? isFolderFavorite(a.rootIndex, projectFolderPath(a)) : isFavorite(a);
      const rightFavorite = state.tab === "projects" ? isFolderFavorite(b.rootIndex, projectFolderPath(b)) : isFavorite(b);
      const favoriteOrder = compareFavoriteState(leftFavorite, rightFavorite);
      if (favoriteOrder) return favoriteOrder;
    }
    if (state.sort === "date") return b.modified - a.modified;
    if (state.sort === "size") return b.size - a.size;
    return (a.displayName || a.name).localeCompare(b.displayName || b.name, getLocale());
  });
  byId("empty").classList.toggle("show", !entries.length);
  byId("empty").querySelector("b").textContent = entries.length ? "" : t(state.favoriteOnly ? "favorites.emptyTitle" : "empty.noMatchesTitle");
  byId("empty").querySelector("span").textContent = entries.length ? "" : t(state.favoriteOnly ? "favorites.emptyDetail" : (project ? "project.emptyFolder" : "empty.noMatchesDetail"));
  const projectGridMode = Boolean(project) && currentLibraryView() === "grid";
  if (projectGridMode) {
    const availableHeight = Math.max(300, window.innerHeight - library.getBoundingClientRect().top - 110);
    state.projectGridPageSize = projectGridPageCapacity(library.clientWidth || 900, availableHeight);
  }
  const pageResult = projectGridMode
    ? paginateEntriesAtSize(entries, state.page, state.projectGridPageSize)
    : paginateEntries(entries, state.page, state.pageSize);
  state.page = pageResult.page;
  renderPagination(pageResult, { hidePageSize: projectGridMode, stepOnly: projectGridMode });
  updateSectionLabels();
  if (!entries.length) {
    setLibraryLoading(false);
    return;
  }
  renderEntryBatch(pageResult.items, sequence);
}

function updateRootLabel() {
  const roots = state.archive?.roots || [];
  const unavailable = unavailableLibraryRoots(state.archive);
  if (!roots.length) {
    byId("rootLabel").textContent = state.roots.length
      ? t("roots.savedNeedsRefresh", { count: state.roots.length })
      : t("app.noFolder");
  } else if (unavailable.length) {
    byId("rootLabel").textContent = t("roots.partiallyUnavailable", {
      available: roots.length - unavailable.length,
      count: roots.length
    });
  } else if (roots.length === 1) {
    byId("rootLabel").textContent = roots[0].path;
  } else {
    byId("rootLabel").textContent = t("roots.multiple", { count: roots.length, names: roots.map(root => root.name).join(" · ") });
  }
  updateLibraryControls();
}

function render() { rebuildFavoriteInventory(); updateRootLabel(); renderSourceAvailability(); renderStats(); renderLibrary(); }

function saveConfiguration() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ settingsVersion: SETTINGS_VERSION, roots: state.roots, settings: state.settings }));
}

function updateLibraryControls() {
  const dialogOpen = byId("libraryDialog").open;
  const controls = libraryControlState({
    scanning: state.scanning,
    rootCount: state.roots.length,
    pendingRootCount: dialogOpen ? state.pendingRoots.length : state.roots.length
  });
  const manageButton = byId("chooseFolder");
  manageButton.disabled = controls.manageDisabled;
  manageButton.textContent = t("app.manageLibrary");
  manageButton.classList.toggle("is-scanning", state.scanning);
  byId("refreshLibrary").disabled = controls.refreshDisabled;
  byId("retryUnavailableRoots").disabled = controls.refreshDisabled;
  byId("applyLibrarySettings").disabled = controls.applyDisabled;
  const settingsStatus = byId("settingsStatus");
  settingsStatus.textContent = t(controls.statusKey, controls.statusParams);
  settingsStatus.classList.toggle("is-scanning", state.scanning);
}

function setScanning(scanning) {
  state.scanning = scanning;
  updateLibraryControls();
  if (scanning) {
    byId("rootLabel").textContent = t("roots.scanning", { count: state.roots.length });
    if (!state.archive) setLibraryLoading(true, t("loading.readingLibrary"), t("loading.settingsAvailable"));
  } else if (!state.archive) {
    setLibraryLoading(false);
  }
}

async function scanLibrary(roots, settings = state.settings, silent = false) {
  if (!roots.length) {
    state.archive = null;
    state.fileIndex = new Map();
    state.librarySelection.clear();
    state.projectSelection.clear();
    state.roots = [];
    state.settings = normalizeLibrarySettings(settings);
    state.libraryLocation = libraryLocation();
    state.page = 1;
    saveConfiguration();
    render();
    return true;
  }
  setScanning(true);
  try {
    const archive = await invoke("scan_archives", { roots });
    state.archive = archive;
    state.fileIndex = new Map(allFiles().map(file => [`${file.rootIndex}\n${file.path}`, file]));
    state.librarySelection.clear();
    state.projectSelection.clear();
    state.roots = roots.filter(root => typeof root === "string" && root);
    state.settings = normalizeLibrarySettings(settings);
    state.libraryLocation = libraryLocation();
    state.page = 1;
    saveConfiguration();
    render();
    return true;
  } catch (error) {
    if (!silent) window.alert(t("errors.libraryRead", { error }));
    return false;
  } finally {
    setScanning(false);
    updateRootLabel();
  }
}

function renderSettingsDialog() {
  const rootList = byId("rootList");
  rootList.innerHTML = state.pendingRoots.length ? state.pendingRoots.map((path, index) => {
    const name = path.split(/[\\/]/).filter(Boolean).pop() || path;
    return `<div class="root-row"><span class="root-index">${String(index + 1).padStart(2, "0")}</span><span><b>${escapeHtml(name)}</b><small title="${escapeHtml(path)}">${escapeHtml(path)}</small></span><button type="button" data-remove-root="${index}" aria-label="${escapeHtml(t("settings.removeFolder", { name }))}">${t("settings.remove")}</button></div>`;
  }).join("") : `<div class="root-empty"><b>${t("settings.noSourceTitle")}</b><span>${t("settings.noSourceDetail")}</span></div>`;

  const rootNotice = byId("rootNotice");
  const feedback = state.pendingRootFeedback;
  const noticeMessages = [];
  if (feedback?.skippedDuplicates?.length === 1) {
    noticeMessages.push(t("settings.duplicateFolderSkipped", {
      folder: rootDisplayName(feedback.skippedDuplicates[0].existing)
    }));
  } else if (feedback?.skippedDuplicates?.length > 1) {
    noticeMessages.push(t("settings.duplicateFoldersSkipped", { count: feedback.skippedDuplicates.length }));
  }
  if (feedback?.skippedNested.length === 1) {
    const skipped = feedback.skippedNested[0];
    noticeMessages.push(t("settings.nestedFolderSkipped", {
      folder: rootDisplayName(skipped.candidate),
      parent: rootDisplayName(skipped.parent)
    }));
  } else if (feedback?.skippedNested.length > 1) {
    noticeMessages.push(t("settings.nestedFoldersSkipped", { count: feedback.skippedNested.length }));
  }
  feedback?.replacedNested.forEach(replacement => {
    noticeMessages.push(t("settings.parentFolderReplacedChildren", {
      folder: rootDisplayName(replacement.parent),
      count: replacement.children.length
    }));
  });
  rootNotice.replaceChildren(...noticeMessages.map(message => {
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    return paragraph;
  }));
  rootNotice.hidden = noticeMessages.length === 0;

  const draft = state.pendingSettings || state.settings;
  const enabled = new Set(draft.enabledExtensions);
  byId("formatGroups").innerHTML = FORMAT_GROUPS.map(group => `<fieldset><legend>${t(group.labelKey)}</legend><div>${group.formats.map(format => `<label class="format-chip"><input type="checkbox" value="${format.ext}" ${enabled.has(format.ext) ? "checked" : ""}><span><b>${format.label}</b><small>.${format.ext}</small></span></label>`).join("")}</div></fieldset>`).join("");
  byId("showPreviews").checked = draft.showPreviews;
  byId("includeUnknown").checked = draft.includeUnknown;
  byId("excludedExtensions").value = draft.excludedExtensions.join(", ");
  byId("excludedFiles").value = draft.excludedFiles.join("\n");
  updateLibraryControls();
}

function openLibraryDialog() {
  state.pendingRoots = [...state.roots];
  state.pendingRootFeedback = null;
  state.pendingSettings = normalizeLibrarySettings(state.settings);
  renderSettingsDialog();
  if (!byId("libraryDialog").open) byId("libraryDialog").showModal();
}

async function addFolders() {
  const selected = await open({ directory: true, multiple: true, title: t("settings.addDialogTitle") });
  if (!selected) return;
  state.pendingSettings = settingsFromForm();
  const additions = Array.isArray(selected) ? selected : [selected];
  const mergeResult = mergeLibraryRoots(state.pendingRoots, additions);
  state.pendingRoots = mergeResult.roots;
  state.pendingRootFeedback = mergeResult;
  renderSettingsDialog();
}

function settingsFromForm() {
  const enabledExtensions = [...byId("formatGroups").querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
  return normalizeLibrarySettings({
    enabledExtensions,
    showPreviews: byId("showPreviews").checked,
    includeUnknown: byId("includeUnknown").checked,
    excludedExtensions: splitExtensionRules(byId("excludedExtensions").value),
    excludedFiles: splitFileRules(byId("excludedFiles").value)
  });
}

const libraryDialog = byId("libraryDialog");
byId("chooseFolder").addEventListener("click", openLibraryDialog);
byId("addFolders").addEventListener("click", addFolders);
byId("refreshLibrary").addEventListener("click", () => scanLibrary(state.roots));
byId("retryUnavailableRoots").addEventListener("click", () => scanLibrary(state.roots));
byId("rootList").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-root]");
  if (!button) return;
  state.pendingSettings = settingsFromForm();
  state.pendingRootFeedback = null;
  state.pendingRoots.splice(Number(button.dataset.removeRoot), 1);
  renderSettingsDialog();
});
libraryDialog.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => libraryDialog.close()));
byId("selectPrintFormats").addEventListener("click", () => {
  byId("formatGroups").querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = PRINT_EXTENSIONS.includes(input.value); });
  byId("includeUnknown").checked = false;
});
byId("selectAllFormats").addEventListener("click", () => {
  byId("formatGroups").querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true; });
});
byId("selectNoFormats").addEventListener("click", () => {
  byId("formatGroups").querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
  byId("includeUnknown").checked = false;
});
byId("applyLibrarySettings").addEventListener("click", async () => {
  const nextSettings = settingsFromForm();
  const rootsChanged = state.pendingRoots.length !== state.roots.length || state.pendingRoots.some((root, index) => root !== state.roots[index]);
  let applied;
  if (rootsChanged || !state.archive) {
    applied = await scanLibrary(state.pendingRoots, nextSettings);
  } else {
    state.settings = nextSettings;
    state.page = 1;
    saveConfiguration();
    render();
    applied = true;
  }
  if (applied) libraryDialog.close();
});

byId("stats").addEventListener("click", event => {
  const tile = event.target.closest(".action");
  if (!tile) return;
  if (state.favoriteOnly && tile.dataset.tab) return;
  if (tile.dataset.category) state.category = state.category === tile.dataset.category ? "all" : tile.dataset.category;
  if (tile.dataset.tab) {
    state.libraryLocation = libraryLocation();
    state.tab = tile.dataset.tab;
    state.category = "all";
  }
  renderStats();
  scheduleLibraryRender({ resetPage: true });
});
byId("libraryModeSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-library-tab]");
  if (!button || button.dataset.libraryTab === state.tab) return;
  state.libraryLocation = libraryLocation();
  state.tab = button.dataset.libraryTab;
  renderStats();
  scheduleLibraryRender({ resetPage: true });
});
let searchTimer;
byId("search").addEventListener("input", event => {
  state.query = event.target.value.trim().toLocaleLowerCase("de");
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => scheduleLibraryRender({ resetPage: true }), 90);
});
byId("sort").addEventListener("change", event => { state.sort = event.target.value; scheduleLibraryRender({ resetPage: true }); });
byId("favoriteFilter").addEventListener("click", () => {
  state.favoriteOnly = !state.favoriteOnly;
  if (state.favoriteOnly) state.libraryLocation = libraryLocation();
  renderStats();
  scheduleLibraryRender({ resetPage: true });
});
byId("viewModeSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-view-mode]");
  if (!button || button.dataset.viewMode === currentLibraryView()) return;
  if (activeLibraryProject()) {
    state.projectView = button.dataset.viewMode;
    localStorage.setItem(PROJECT_VIEW_KEY, state.projectView);
  } else {
    state.view = button.dataset.viewMode;
  }
  scheduleLibraryRender();
});
byId("pageSize").addEventListener("change", event => {
  state.pageSize = normalizePageSize(event.target.value);
  localStorage.setItem(PAGE_SIZE_KEY, String(state.pageSize));
  scheduleLibraryRender({ resetPage: true });
});
byId("pagination").addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled) return;
  const nextPage = Number(button.dataset.page);
  if (!Number.isInteger(nextPage) || nextPage === state.page) return;
  state.page = nextPage;
  scheduleLibraryRender({ scrollToResults: true });
});

byId("sideLibrary").addEventListener("click", () => {
  setLibraryLocation(libraryLocation(), { resetCategory: true });
  renderStats();
  scheduleLibraryRender({ showLoading: false });
});

byId("sideFavorites").addEventListener("click", () => {
  state.libraryLocation = libraryLocation();
  state.favoriteOnly = true;
  state.category = "all";
  state.page = 1;
  renderStats();
  scheduleLibraryRender({ showLoading: false });
});

byId("sideRootList").addEventListener("click", event => {
  const button = event.target.closest("[data-side-root]");
  if (!button) return;
  setLibraryLocation(sourceLocation(Number(button.dataset.sideRoot)), { resetCategory: true });
  renderStats();
  scheduleLibraryRender({ showLoading: false });
});

byId("libraryBreadcrumb").addEventListener("click", event => {
  if (event.target.closest("[data-library-home]")) {
    setLibraryLocation(libraryLocation());
  } else {
    const folder = event.target.closest("[data-library-folder-path]");
    if (!folder || !activeLibraryProject()) return;
    state.libraryLocation = folderLocation(state.libraryLocation, folder.dataset.libraryFolderPath);
    state.page = 1;
  }
  renderStats();
  scheduleLibraryRender({ showLoading: false, scrollToResults: true });
});

const projectDialog = byId("projectDialog");

function projectCheckbox(file, selectedKeys) {
  const compatible = isSlicerCompatible(file.extension, state.slicer);
  const checked = selectedKeys.has(fileSelectionKey(file)) ? "checked" : "";
  const disabled = compatible ? "" : `disabled title="${escapeHtml(t("project.slicerUnsupported"))}"`;
  return `<input type="checkbox" data-path="${escapeHtml(file.path)}" data-root-index="${file.rootIndex}" aria-label="${escapeHtml(t("project.selectFile", { name: file.name }))}" ${checked} ${disabled}>`;
}

function projectListRow(file, selectedKeys) {
  const category = categoryOf(file);
  const name = isViewable(file)
    ? `<button class="file-preview-button" type="button" data-model-root="${file.rootIndex}" data-model-path="${escapeHtml(file.path)}" title="${escapeHtml(file.path)}"><span>${escapeHtml(file.name)}</span><small>${t("project.openViewer")}</small></button>`
    : `<span class="file-name" title="${escapeHtml(file.path)}">${escapeHtml(file.name)}</span>`;
  return `<div class="file-row project-file-row" style="--tone:${CATEGORIES[category].color}">${favoriteButton(file, "project-row-favorite")}${name}<span>${formatSize(file.size)}</span><span class="file-format">${escapeHtml(file.extension.toUpperCase() || t("common.file"))}</span>${projectCheckbox(file, selectedKeys)}</div>`;
}

function projectFolderCategory(folder) {
  const counts = {};
  folder.files.forEach(file => {
    const category = categoryOf(file);
    counts[category] = (counts[category] || 0) + 1;
  });
  return Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] || "other";
}

function projectFolderListRow(project, folder) {
  const path = projectFolderPath(project, folder.path);
  return `<div class="file-row project-folder-list-item">${folderFavoriteButton(project.rootIndex, path, folder.name, "project-folder-list-favorite")}<button class="project-folder-row" type="button" data-project-path="${escapeHtml(folder.path)}" aria-label="${escapeHtml(t("project.openFolder", { name: folder.name }))}"><span class="folder-row-icon" aria-hidden="true"><svg viewBox="0 0 16 13"><path d="M1 3h6l2 2h6v7H1z"/></svg></span><span class="folder-row-name"><b>${escapeHtml(folder.name)}</b><small>${t("common.filesCount", { count: folder.files.length })}</small></span><span>${formatSize(folder.size)}</span><span class="file-format">${t("common.folder")}</span><span class="folder-row-arrow" aria-hidden="true">→</span></button></div>`;
}

function projectGridCard(file, selectedKeys) {
  const category = categoryOf(file);
  const viewable = isViewable(file);
  const parentPath = file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : t("common.mainFolder");
  const coverContents = `${demoPreviewMarkup(file)}<span class="file-mark">${escapeHtml(file.extension.toUpperCase() || t("common.file").toUpperCase())}</span><span class="kind-flag file-flag">${t(viewable ? "cards.preview" : "common.file")}</span>`;
  const cover = viewable
    ? `<button class="project-file-cover ${previewCoverClass(file)}" type="button" data-model-root="${file.rootIndex}" data-model-path="${escapeHtml(file.path)}" ${previewAttributes(file)} aria-label="${escapeHtml(t("cards.openFile", { name: file.name }) + t("cards.openFileViewerSuffix"))}">${coverContents}</button>`
    : `<div class="project-file-cover" aria-hidden="true">${coverContents}</div>`;
  return `<article class="project-file-card" style="--tone:${CATEGORIES[category].color}"><label class="project-file-select">${projectCheckbox(file, selectedKeys)}</label>${favoriteButton(file, "project-grid-favorite")}${cover}<div class="project-file-body"><div class="entry-kind">${t("cards.fileEntry", { extension: escapeHtml(file.extension || "–") })}</div><h4 title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</h4><p title="${escapeHtml(parentPath)}">${escapeHtml(parentPath)}</p><div class="meta"><span>${formatSize(file.size)}</span><span>${formatDate(file.modified)}</span></div></div></article>`;
}

function projectGridFolder(project, folder) {
  const category = projectFolderCategory(folder);
  const representative = folder.files.find(isViewable);
  const path = projectFolderPath(project, folder.path);
  return `<article class="project-file-card project-folder-card" style="--tone:${CATEGORIES[category].color}"><button class="project-folder-card-open" type="button" data-project-path="${escapeHtml(folder.path)}" aria-label="${escapeHtml(t("project.openFolder", { name: folder.name }))}"><div class="project-file-cover folder-cover ${previewCoverClass(representative)}" ${previewAttributes(representative)}>${demoPreviewMarkup(representative)}<span class="folder-mark"><svg viewBox="0 0 64 48"><path d="M4 12h22l6 7h28v25H4z"/></svg></span><span class="kind-flag folder-flag"><svg viewBox="0 0 16 13"><path d="M1 3h6l2 2h6v7H1z"/></svg> ${t("common.folder")}</span></div><div class="project-file-body"><div class="entry-kind">${t("project.subfolder")}</div><h4 title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</h4><p>${t("common.filesCount", { count: folder.files.length })}</p><div class="meta"><span>${formatSize(folder.size)}</span><span>${formatDate(folder.modified)}</span></div></div></button>${folderFavoriteButton(project.rootIndex, path, folder.name, "project-folder-grid-favorite")}</article>`;
}

function compareProjectEntries(left, right, project = null) {
  if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
  if (state.sort === "favorite") {
    const currentProject = project || state.archive?.projects[Number(projectDialog.dataset.projectIndex)];
    const leftFavorite = left.kind === "folder" ? isFolderFavorite(currentProject?.rootIndex, projectFolderPath(currentProject, left.path)) : isFavorite(left.file);
    const rightFavorite = right.kind === "folder" ? isFolderFavorite(currentProject?.rootIndex, projectFolderPath(currentProject, right.path)) : isFavorite(right.file);
    const favoriteOrder = compareFavoriteState(leftFavorite, rightFavorite);
    if (favoriteOrder) return favoriteOrder;
  }
  if (state.sort === "date") return right.modified - left.modified;
  if (state.sort === "size") return right.size - left.size;
  return left.name.localeCompare(right.name, getLocale());
}

function renderProjectBreadcrumbs(project) {
  const crumbs = projectBreadcrumbs(project, state.projectPath);
  byId("projectBreadcrumb").innerHTML = crumbs.map((crumb, index) => {
    const name = escapeHtml(crumb.name);
    return index === crumbs.length - 1
      ? `<span aria-current="page">${name}</span>`
      : `<button type="button" data-project-path="${escapeHtml(crumb.path)}">${name}</button><i aria-hidden="true">/</i>`;
  }).join("");
}

function renderProjectPagination(result, gridMode) {
  const pagination = byId("projectPagination");
  byId("projectPageSize").value = String(result.pageSize);
  byId("projectPageSizeControl").hidden = gridMode || result.total <= PAGE_SIZES[0];
  byId("projectResultCount").textContent = result.total
    ? t("pagination.range", { start: result.start + 1, end: result.end, total: result.total })
    : t("pagination.noResults");
  pagination.hidden = result.totalPages <= 1;
  byId("projectPageStatus").textContent = t("pagination.status", { page: result.page, totalPages: result.totalPages });
  if (pagination.hidden) {
    byId("projectPageButtons").innerHTML = "";
    return;
  }
  if (gridMode) {
    byId("projectPageButtons").innerHTML = `<button class="page-step" type="button" data-project-page="${result.page - 1}" ${result.page === 1 ? "disabled" : ""} aria-label="${t("pagination.previous")}">←</button><button class="page-step" type="button" data-project-page="${result.page + 1}" ${result.page === result.totalPages ? "disabled" : ""} aria-label="${t("pagination.next")}">→</button>`;
    return;
  }
  const buttons = paginationTokens(result.page, result.totalPages).map(token => token === "ellipsis"
    ? '<span class="page-ellipsis" aria-hidden="true">…</span>'
    : `<button class="page-number ${token === result.page ? "current" : ""}" type="button" data-project-page="${token}" ${token === result.page ? 'aria-current="page"' : ""} aria-label="${t("pagination.pageLabel", { page: token })}">${nf.format(token)}</button>`).join("");
  byId("projectPageButtons").innerHTML = `<button class="page-step" type="button" data-project-page="${result.page - 1}" ${result.page === 1 ? "disabled" : ""} aria-label="${t("pagination.previous")}">←</button>${buttons}<button class="page-step" type="button" data-project-page="${result.page + 1}" ${result.page === result.totalPages ? "disabled" : ""} aria-label="${t("pagination.next")}">→</button>`;
}

function updateProjectSelection() {
  const count = state.projectSelection.size;
  const slicer = slicerLabel(state.slicer);
  byId("selectedCount").textContent = nf.format(count);
  const openButton = byId("openSelectedInSlicer");
  openButton.disabled = slicerOpening || count === 0;
  openButton.textContent = t(slicerOpening ? "project.openingInSlicer" : "project.openInSlicer", { count, slicer });
}

function updateViewerSlicerAction() {
  const file = state.fileIndex.get(state.viewerFileKey);
  const compatible = file && isSlicerCompatible(file.extension, state.slicer);
  const slicer = slicerLabel(state.slicer);
  byId("viewerSlicerSelect").value = state.slicer;
  const button = byId("openViewerFileInSlicer");
  button.disabled = slicerOpening || !compatible;
  button.textContent = t(slicerOpening ? "project.openingInSlicer" : "project.openInSlicer", { count: file ? 1 : 0, slicer });
}

function updateViewerFavoriteAction() {
  const file = state.fileIndex.get(state.viewerFileKey);
  const button = byId("viewerFavorite");
  const favorite = file ? isFavorite(file) : false;
  const label = file ? t(favorite ? "favorites.remove" : "favorites.add", { name: file.name }) : t("favorites.showOnly");
  button.disabled = !file;
  button.classList.toggle("on", favorite);
  button.setAttribute("aria-pressed", String(favorite));
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = favorite ? "★" : "☆";
}

function updateSelectionControls() {
  updateLibrarySelection();
  updateProjectSelection();
  updateViewerSlicerAction();
  updateViewerFavoriteAction();
}

function setActiveSlicer(value) {
  state.slicer = normalizeSlicer(value);
  localStorage.setItem(SLICER_KEY, state.slicer);
  const supportsFile = file => isSlicerCompatible(file.extension, state.slicer);
  state.librarySelection = compatibleSelection(state.librarySelection, state.fileIndex, supportsFile);
  state.projectSelection = compatibleSelection(state.projectSelection, state.fileIndex, supportsFile);
  byId("library").querySelectorAll('input[type="checkbox"][data-library-path]').forEach(checkbox => {
    const file = state.fileIndex.get(`${checkbox.dataset.rootIndex}\n${checkbox.dataset.libraryPath}`);
    const compatible = file && supportsFile(file);
    const selectionTitle = compatible ? t("project.selectForSlicer", { name: file.name }) : t("project.slicerUnsupported");
    checkbox.disabled = !compatible;
    checkbox.checked = compatible && state.librarySelection.has(fileSelectionKey(file));
    checkbox.setAttribute("aria-label", selectionTitle);
    checkbox.closest(".library-file-select")?.setAttribute("title", selectionTitle);
    checkbox.closest(".file-card")?.classList.toggle("is-selected", checkbox.checked);
  });
  if (projectDialog.open && projectDialog.dataset.projectIndex !== undefined) renderProjectContents(Number(projectDialog.dataset.projectIndex));
  updateSelectionControls();
}

async function openSelectionInSlicer(selection, buttonId) {
  const files = selectionPayload(selection, state.fileIndex);
  if (!files.length || slicerOpening) return;
  slicerOpening = true;
  updateSelectionControls();
  try {
    await invoke("open_in_slicer", { slicer: state.slicer, files });
    slicerOpening = false;
    updateSelectionControls();
    const button = byId(buttonId);
    button.textContent = t("project.openedInSlicer", { slicer: slicerLabel(state.slicer) });
    button.disabled = false;
    setTimeout(updateSelectionControls, 1400);
  } catch (error) {
    slicerOpening = false;
    updateSelectionControls();
    window.alert(t(slicerErrorKey(error), { slicer: slicerLabel(state.slicer) }));
  }
}

function hydrateProjectPreviews() {
  requestAnimationFrame(() => hydrateModelPreviews(libraryRenderSequence));
}

function renderProjectContents(projectIndex) {
  const project = state.archive.projects[projectIndex];
  if (!project) return;
  const files = filteredProjectFiles(project);
  projectDialog.dataset.projectIndex = String(projectIndex);
  byId("modalTitle").textContent = project.displayName;
  renderProjectBreadcrumbs(project);
  const currentFolderPath = projectFolderPath(project, state.projectPath);
  const showEntireFolder = state.favoriteOnly && isFolderFavorite(project.rootIndex, currentFolderPath);
  const entries = projectBrowserEntries(project, files, state.projectPath)
    .filter(entry => !state.favoriteOnly || showEntireFolder || (entry.kind === "file" ? isFavorite(entry.file) : folderHasFavorite(project, entry.path, files)))
    .sort((left, right) => compareProjectEntries(left, right, project));
  const gridMode = state.projectView === "grid";
  const projectPageSize = gridMode ? state.projectGridPageSize : state.pageSize;
  const pageResult = gridMode
    ? paginateEntriesAtSize(entries, state.projectPage, projectPageSize)
    : paginateEntries(entries, state.projectPage, projectPageSize);
  state.projectPage = pageResult.page;
  renderProjectPagination(pageResult, gridMode);
  const modalList = byId("modalList");
  modalList.classList.toggle("grid", gridMode);
  modalList.classList.toggle("list", !gridMode);
  modalList.innerHTML = pageResult.items.length
    ? pageResult.items.map(entry => entry.kind === "folder"
      ? (gridMode ? projectGridFolder(project, entry) : projectFolderListRow(project, entry))
      : (gridMode ? projectGridCard(entry.file, state.projectSelection) : projectListRow(entry.file, state.projectSelection))).join("")
    : `<div class="project-empty"><b>${t(state.favoriteOnly ? "project.emptyFavorites" : "project.emptyFolder")}</b></div>`;
  updateViewModeSwitch("projectViewModeSwitch", "project-view-mode", state.projectView);
  byId("slicerSelect").value = state.slicer;
  updateProjectSelection();
  if (projectDialog.open && gridMode) hydrateProjectPreviews();
}

let projectGridResizeFrame = null;
function syncProjectGridCapacity() {
  if (!projectDialog.open || state.projectView !== "grid" || projectDialog.dataset.projectIndex === undefined) return;
  const modalList = byId("modalList");
  const nextPageSize = projectGridPageCapacity(modalList.clientWidth, modalList.clientHeight);
  if (nextPageSize === state.projectGridPageSize) return;
  const firstVisibleIndex = (state.projectPage - 1) * state.projectGridPageSize;
  state.projectGridPageSize = nextPageSize;
  state.projectPage = Math.floor(firstVisibleIndex / nextPageSize) + 1;
  renderProjectContents(Number(projectDialog.dataset.projectIndex));
}

function scheduleProjectGridCapacitySync() {
  if (projectGridResizeFrame !== null) cancelAnimationFrame(projectGridResizeFrame);
  projectGridResizeFrame = requestAnimationFrame(() => {
    projectGridResizeFrame = null;
    syncProjectGridCapacity();
  });
}

new ResizeObserver(scheduleProjectGridCapacitySync).observe(byId("modalList"));

byId("library").addEventListener("click", async event => {
  const folderFavoriteControl = event.target.closest("[data-favorite-folder-path]");
  if (folderFavoriteControl) {
    toggleFolderFavorite(Number(folderFavoriteControl.dataset.favoriteFolderRoot), folderFavoriteControl.dataset.favoriteFolderPath);
    return;
  }
  const favoriteControl = event.target.closest("[data-favorite-path]");
  if (favoriteControl) {
    toggleFavorite(favoriteFileFromControl(favoriteControl));
    return;
  }
  if (event.target.closest(".library-file-select")) return;
  const card = event.target.closest(".card");
  if (!card) return;
  if (card.dataset.projectIndex !== undefined) {
    setLibraryLocation(projectLocation(Number(card.dataset.projectIndex), card.dataset.projectPath || ""));
    scheduleLibraryRender({ showLoading: false, scrollToResults: true });
  } else if (canOpenModelCard(card)) {
    await openArchiveModel(Number(card.dataset.rootIndex), card.dataset.file);
  }
});
byId("library").addEventListener("change", event => {
  const checkbox = event.target.closest('input[type="checkbox"][data-library-path]');
  if (!checkbox) return;
  const key = `${checkbox.dataset.rootIndex}\n${checkbox.dataset.libraryPath}`;
  if (checkbox.checked) state.librarySelection.add(key);
  else state.librarySelection.delete(key);
  checkbox.closest(".file-card")?.classList.toggle("is-selected", checkbox.checked);
  updateLibrarySelection();
});
projectDialog.querySelector("[data-close]").addEventListener("click", () => projectDialog.close());
projectDialog.addEventListener("click", event => { if (event.target === projectDialog) projectDialog.close(); });
projectDialog.addEventListener("close", () => {
  delete projectDialog.dataset.projectIndex;
  state.projectPath = "";
  state.projectPage = 1;
  state.projectSelection.clear();
});
byId("projectViewModeSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-project-view-mode]");
  if (!button || button.dataset.projectViewMode === state.projectView) return;
  state.projectView = button.dataset.projectViewMode;
  localStorage.setItem(PROJECT_VIEW_KEY, state.projectView);
  state.projectPage = 1;
  renderProjectContents(Number(projectDialog.dataset.projectIndex));
  scheduleProjectGridCapacitySync();
});
byId("slicerSelect").addEventListener("change", event => {
  setActiveSlicer(event.target.value);
});
byId("projectBreadcrumb").addEventListener("click", event => {
  const button = event.target.closest("[data-project-path]");
  if (!button) return;
  state.projectPath = button.dataset.projectPath;
  state.projectPage = 1;
  renderProjectContents(Number(projectDialog.dataset.projectIndex));
});
byId("modalList").addEventListener("click", async event => {
  const folderFavoriteControl = event.target.closest("[data-favorite-folder-path]");
  if (folderFavoriteControl) {
    toggleFolderFavorite(Number(folderFavoriteControl.dataset.favoriteFolderRoot), folderFavoriteControl.dataset.favoriteFolderPath);
    return;
  }
  const favoriteControl = event.target.closest("[data-favorite-path]");
  if (favoriteControl) {
    toggleFavorite(favoriteFileFromControl(favoriteControl));
    return;
  }
  const folder = event.target.closest("[data-project-path]");
  if (folder) {
    state.projectPath = folder.dataset.projectPath;
    state.projectPage = 1;
    renderProjectContents(Number(projectDialog.dataset.projectIndex));
    return;
  }
  const button = event.target.closest("[data-model-path]");
  if (!button) return;
  projectDialog.close();
  await openArchiveModel(Number(button.dataset.modelRoot), button.dataset.modelPath);
});
byId("projectPageSize").addEventListener("change", event => {
  state.pageSize = normalizePageSize(event.target.value);
  localStorage.setItem(PAGE_SIZE_KEY, String(state.pageSize));
  state.projectPage = 1;
  renderProjectContents(Number(projectDialog.dataset.projectIndex));
});
byId("projectPagination").addEventListener("click", event => {
  const button = event.target.closest("[data-project-page]");
  if (!button || button.disabled) return;
  const page = Number(button.dataset.projectPage);
  if (!Number.isInteger(page) || page === state.projectPage) return;
  state.projectPage = page;
  renderProjectContents(Number(projectDialog.dataset.projectIndex));
  byId("modalList").scrollTo({ top: 0 });
});
projectDialog.addEventListener("change", event => {
  const checkbox = event.target.closest('input[type="checkbox"][data-path]');
  if (!checkbox) return;
  const key = `${checkbox.dataset.rootIndex}\n${checkbox.dataset.path}`;
  if (checkbox.checked) state.projectSelection.add(key);
  else state.projectSelection.delete(key);
  updateProjectSelection();
});
byId("openSelectedInSlicer").addEventListener("click", () => openSelectionInSlicer(state.projectSelection, "openSelectedInSlicer"));
byId("librarySlicerSelect").addEventListener("change", event => setActiveSlicer(event.target.value));
byId("openLibrarySelectionInSlicer").addEventListener("click", () => openSelectionInSlicer(state.librarySelection, "openLibrarySelectionInSlicer"));

function createPreviewMaterial() {
  const material = new THREE.MeshStandardMaterial({
    ...PREVIEW_MATERIAL_OPTIONS,
    side: THREE.DoubleSide
  });
  material.userData.druckarchivPreview = true;
  return material;
}

function replaceWithPreviewMaterial(mesh) {
  if (mesh.material?.userData?.druckarchivPreview) return;
  const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  sourceMaterials.filter(Boolean).forEach(material => material.dispose());
  mesh.material = createPreviewMaterial();
}

function createModelObject(buffer, name) {
  const extension = name.split(".").pop().toLowerCase();
  let object;
  if (extension === "stl") {
    const geometry = new STLLoader().parse(buffer);
    geometry.computeVertexNormals();
    object = new THREE.Mesh(geometry, createPreviewMaterial());
  } else if (extension === "obj") {
    object = new OBJLoader().parse(new TextDecoder().decode(buffer));
  } else if (extension === "3mf") {
    object = new ThreeMFLoader().parse(buffer);
  } else {
    throw new Error(t("viewer.unsupported"));
  }
  if (["stl", "3mf"].includes(extension)) object.rotation.x = -Math.PI / 2;
  object.traverse(child => {
    if (!child.isMesh) return;
    if (child.geometry && !child.geometry.getAttribute("normal")) child.geometry.computeVertexNormals();
    replaceWithPreviewMaterial(child);
  });
  return object;
}

function frameModel(object, targetCamera, targetControls = null, padding = 1.2) {
  object.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) throw new Error(t("viewer.emptyGeometry"));
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  object.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(object);
  const dimensions = box.getSize(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, .001);
  const fov = THREE.MathUtils.degToRad(targetCamera.fov);
  const distance = (radius / Math.sin(fov / 2)) * padding;
  const direction = new THREE.Vector3(1, .72, 1).normalize();
  targetCamera.position.copy(direction.multiplyScalar(distance));
  targetCamera.near = Math.max(radius / 1000, .001);
  targetCamera.far = Math.max(distance + radius * 8, 100);
  targetCamera.updateProjectionMatrix();
  if (targetControls) {
    targetControls.target.set(0, 0, 0);
    targetControls.update();
  } else {
    targetCamera.lookAt(0, 0, 0);
  }
  return dimensions;
}

function disposeModel(object) {
  object.traverse(child => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(material => material.dispose());
  });
}

const previewCache = new Map();
const previewPromises = new Map();
const previewQueue = [];
let activePreviews = 0;
let previewObserver;
let thumbnailRenderer, thumbnailScene, thumbnailCamera;
const MAX_PREVIEW_BYTES = 64 * 1024 * 1024;

function ensureThumbnailRenderer() {
  if (thumbnailRenderer) return;
  thumbnailRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  thumbnailRenderer.setPixelRatio(1);
  thumbnailRenderer.setSize(420, 240, false);
  thumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
  thumbnailRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  thumbnailRenderer.toneMappingExposure = 1.08;
  thumbnailScene = new THREE.Scene();
  thumbnailScene.background = new THREE.Color(0x101d21);
  thumbnailCamera = new THREE.PerspectiveCamera(38, 420 / 240, .001, 100000);
  thumbnailScene.add(new THREE.HemisphereLight(0xffffff, 0x141b1e, 1.45));
  const key = new THREE.DirectionalLight(0xffffff, 2.05);
  key.position.set(2, 3, 2);
  thumbnailScene.add(key);
  const rim = new THREE.DirectionalLight(0xdce6e8, .8);
  rim.position.set(-2, 1, -2);
  thumbnailScene.add(rim);
}

async function thumbnailFor(file) {
  const root = rootOf(file);
  const cacheKey = `${root.path}\n${file.path}\n${file.size}\n${file.modified}`;
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey);
  if (previewPromises.has(cacheKey)) return previewPromises.get(cacheKey);
  const promise = (async () => {
    if (file.size > MAX_PREVIEW_BYTES) throw new Error(t("previews.tooLarge"));
    const bytes = await invoke("read_model", { root: root.path, relativePath: file.path });
    ensureThumbnailRenderer();
    const object = createModelObject(new Uint8Array(bytes).buffer, file.name);
    thumbnailScene.add(object);
    try {
      frameModel(object, thumbnailCamera, null, 1.32);
      thumbnailRenderer.render(thumbnailScene, thumbnailCamera);
      const dataUrl = thumbnailRenderer.domElement.toDataURL("image/webp", .82);
      if (previewCache.size >= 240) previewCache.delete(previewCache.keys().next().value);
      previewCache.set(cacheKey, dataUrl);
      return dataUrl;
    } finally {
      thumbnailScene.remove(object);
      disposeModel(object);
    }
  })();
  previewPromises.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    previewPromises.delete(cacheKey);
  }
}

function updatePreviewStatus(sequence) {
  if (sequence !== libraryRenderSequence || sequence !== previewProgress.sequence) return;
  const status = byId("previewStatus");
  const { total, completed } = previewProgress;
  if (!state.settings.showPreviews || !total || completed >= total) {
    status.hidden = true;
    return;
  }
  status.hidden = false;
  byId("previewStatusText").textContent = t("previews.progress", { completed, total });
  byId("previewProgressBar").style.width = `${Math.round(completed / total * 100)}%`;
}

function finishQueuedPreview(generation) {
  if (generation !== previewProgress.sequence) return;
  previewProgress.completed++;
  updatePreviewStatus(generation);
}

function pumpPreviewQueue() {
  while (activePreviews < 2 && previewQueue.length) {
    const { cover, generation } = previewQueue.shift();
    if (!cover.isConnected) {
      finishQueuedPreview(generation);
      continue;
    }
    activePreviews++;
    const rootIndex = Number(cover.dataset.previewRoot);
    const file = state.fileIndex.get(`${rootIndex}\n${cover.dataset.previewPath}`);
    if (!file) {
      activePreviews--;
      finishQueuedPreview(generation);
      continue;
    }
    thumbnailFor(file).then(dataUrl => {
      if (!cover.isConnected || cover.dataset.previewPath !== file.path) return;
      const image = document.createElement("img");
      image.className = "model-thumbnail";
      image.alt = "";
      image.src = dataUrl;
      cover.prepend(image);
      cover.classList.add("has-thumbnail");
    }).catch(() => {
      if (!cover.isConnected) return;
      cover.dataset.previewError = t("previews.unavailable");
      cover.classList.add("preview-failed");
    }).finally(() => {
      activePreviews--;
      finishQueuedPreview(generation);
      pumpPreviewQueue();
    });
  }
}

function queueModelPreview(cover) {
  if (!state.settings.showPreviews || cover.dataset.previewState) return;
  const generation = Number(cover.dataset.previewGeneration);
  cover.dataset.previewState = "queued";
  previewQueue.push({ cover, generation });
  if (generation === previewProgress.sequence) {
    previewProgress.total++;
    updatePreviewStatus(generation);
  }
  pumpPreviewQueue();
}

function hydrateModelPreviews(sequence = libraryRenderSequence) {
  if (!state.settings.showPreviews) return;
  const covers = document.querySelectorAll("[data-preview-path]:not([data-preview-state]):not([data-preview-generation])");
  covers.forEach(cover => { cover.dataset.previewGeneration = String(sequence); });
  if (!("IntersectionObserver" in window)) {
    covers.forEach(queueModelPreview);
    return;
  }
  previewObserver ||= new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    previewObserver.unobserve(entry.target);
    queueModelPreview(entry.target);
  }), { rootMargin: "180px" });
  covers.forEach(cover => previewObserver.observe(cover));
}

let renderer, scene, camera, controls, model, animation, viewerGrid;
function resizeViewer() {
  if (!renderer) return;
  const stage = byId("viewerStage");
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function ensureViewer() {
  if (renderer) return;
  const stage = byId("viewerStage");
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  stage.prepend(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x081013);
  camera = new THREE.PerspectiveCamera(42, 1, .01, 100000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x141b1e, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(1.2, 1.6, .9); scene.add(key);
  const rim = new THREE.DirectionalLight(0xdce6e8, .7); rim.position.set(-1, .5, -1); scene.add(rim);
  viewerGrid = new THREE.GridHelper(500, 50, 0x37545c, 0x1f343a); scene.add(viewerGrid);
  addEventListener("resize", resizeViewer);
  resizeViewer();
}

function startViewerLoop() {
  if (animation || !renderer) return;
  const loop = () => {
    if (!byId("viewer").classList.contains("open")) { animation = null; return; }
    controls.update(); renderer.render(scene, camera);
    animation = requestAnimationFrame(loop);
  };
  animation = requestAnimationFrame(loop);
}

async function loadModel(file, sourceKey) {
  const buffer = await file.arrayBuffer();
  const object = createModelObject(buffer, file.name);
  showModelObject(object, file.name, sourceKey);
}

function showModelObject(object, name, sourceKey) {
  state.viewerFileKey = sourceKey;
  openViewer();
  ensureViewer();
  model = releaseViewerModel(scene, model, disposeModel);
  model = object; scene.add(model);
  const dimensions = frameModel(object, camera, controls, 1.3);
  viewerGrid.position.y = -dimensions.y / 2;
  viewerGrid.scale.setScalar(Math.max(dimensions.x, dimensions.y, dimensions.z) / 500 || 1);
  byId("viewerName").textContent = name;
  byId("viewerInfo").textContent = `${dimensions.x.toFixed(1)} × ${dimensions.y.toFixed(1)} × ${dimensions.z.toFixed(1)} mm`;
}

function createDemoModelObject(file) {
  const material = createPreviewMaterial();
  const extension = file.extension.toLowerCase();
  const geometry = extension === "3mf"
    ? new THREE.BoxGeometry(64, 34, 46, 2, 2, 2)
    : (extension === "obj"
      ? new THREE.TorusKnotGeometry(22, 7, 96, 14)
      : new THREE.CylinderGeometry(30, 30, 48, 48));
  const object = new THREE.Mesh(geometry, material);
  object.rotation.x = extension === "stl" ? Math.PI / 2 : 0;
  return object;
}

async function openArchiveModel(rootIndex, relativePath) {
  const sourceKey = `${rootIndex}\n${relativePath}`;
  const demoFile = state.fileIndex.get(sourceKey);
  if (demoFile?.demoPreview) {
    showModelObject(createDemoModelObject(demoFile), demoFile.name, sourceKey);
    return;
  }
  try {
    const bytes = await invoke("read_model", { root: state.archive.roots[rootIndex].path, relativePath });
    await loadModel(new File([new Uint8Array(bytes)], relativePath.split("/").pop()), sourceKey);
  } catch (error) { window.alert(t("viewer.loadError", { error })); }
}
function openViewer() {
  byId("viewer").classList.add("open");
  byId("viewer").setAttribute("aria-hidden", "false");
  updateViewerSlicerAction();
  updateViewerFavoriteAction();
  requestAnimationFrame(() => { ensureViewer(); resizeViewer(); startViewerLoop(); });
}
function closeViewer() {
  byId("viewer").classList.remove("open");
  byId("viewer").setAttribute("aria-hidden", "true");
  if (animation) cancelAnimationFrame(animation);
  animation = null;
  model = releaseViewerModel(scene, model, disposeModel);
  state.viewerFileKey = null;
  byId("viewerName").textContent = "STL / 3MF / OBJ";
  byId("viewerInfo").textContent = t("viewer.controls");
  updateViewerSlicerAction();
  updateViewerFavoriteAction();
}
byId("closeViewer").addEventListener("click", closeViewer);
byId("viewer").addEventListener("click", event => { if (event.target === byId("viewer")) closeViewer(); });
byId("viewerSlicerSelect").addEventListener("change", event => setActiveSlicer(event.target.value));
byId("viewerFavorite").addEventListener("click", () => toggleFavorite(state.fileIndex.get(state.viewerFileKey)));
byId("openViewerFileInSlicer").addEventListener("click", () => {
  if (state.viewerFileKey) openSelectionInSlicer(new Set([state.viewerFileKey]), "openViewerFileInSlicer");
});
addEventListener("keydown", event => { if (event.key === "Escape" && byId("viewer").classList.contains("open")) closeViewer(); });

async function restoreConfiguration() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return;
    state.roots = Array.isArray(saved.roots) ? saved.roots.filter(root => typeof root === "string" && root) : [];
    state.settings = saved.settingsVersion === SETTINGS_VERSION
      ? normalizeLibrarySettings(saved.settings)
      : defaultLibrarySettings();
    render();
    if (state.roots.length) await scanLibrary(state.roots, state.settings, true);
  } catch (_) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function refreshLocalizedInterface() {
  applyTranslations();
  syncLocaleSwitch();
  setUpdateMenuStatus(updateMenuStatus.key, updateMenuStatus.params);
  setAppMenuOpen(!byId("appMenuPanel").hidden);
  render();
  if (libraryDialog.open) renderSettingsDialog();
  if (projectDialog.open && projectDialog.dataset.projectIndex !== undefined) renderProjectContents(Number(projectDialog.dataset.projectIndex));
  updateSelectionControls();
}

byId("themeSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-theme-preference]");
  if (button) applyTheme(button.dataset.themePreference);
});
byId("localeSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-locale]");
  if (button) setLocale(button.dataset.locale);
});
byId("checkForUpdates").addEventListener("click", () => checkForAppUpdate({ manual: true }));
byId("installUpdate").addEventListener("click", installAvailableUpdate);
byId("postponeUpdate").addEventListener("click", dismissAvailableUpdate);
byId("updateDialog").addEventListener("cancel", event => {
  if (byId("postponeUpdate").disabled) event.preventDefault();
  else dismissAvailableUpdate();
});
byId("appMenuTrigger").addEventListener("click", () => setAppMenuOpen(byId("appMenuPanel").hidden));
document.addEventListener("click", event => {
  if (!byId("appMenuPanel").hidden && !byId("appMenu").contains(event.target)) setAppMenuOpen(false);
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || byId("appMenuPanel").hidden) return;
  setAppMenuOpen(false);
  byId("appMenuTrigger").focus();
});
const handleSystemThemeChange = () => {
  if (themePreference === "system") applyTheme("system", { persist: false });
};
if (typeof systemThemeQuery.addEventListener === "function") systemThemeQuery.addEventListener("change", handleSystemThemeChange);
else systemThemeQuery.addListener(handleSystemThemeChange);

onLocaleChange(refreshLocalizedInterface);
applyTheme(themePreference, { persist: false });
applyTranslations();
syncLocaleSwitch();
setAppMenuOpen(false);
render();
byId("appVersion").textContent = APP_VERSION.includes("beta") ? `Beta ${APP_VERSION}` : `v${APP_VERSION}`;
const demoMode = import.meta.env.DEV && new URLSearchParams(location.search).get("demo") === "1";
if (demoMode) {
  const demoParams = new URLSearchParams(location.search);
  const requestedDemoFiles = Number(demoParams.get("demoFiles")) || 0;
  state.archive = createDemoArchive(requestedDemoFiles);
  if (demoParams.get("demoOffline") === "1") {
    state.archive.roots[0].available = false;
    state.archive.roots[0].path = "/Volumes/Druckarchiv-Demo-USB/Modelle";
    state.archive.projects = state.archive.projects.filter(project => project.rootIndex !== 0);
    state.archive.loose = state.archive.loose.filter(file => file.rootIndex !== 0);
  }
  state.roots = state.archive.roots.map(root => root.path);
  state.fileIndex = new Map(allFiles().map(file => [`${file.rootIndex}\n${file.path}`, file]));
  render();
} else {
  restoreConfiguration();
}
setTimeout(() => { void checkForAppUpdate(); }, demoMode ? 250 : 1800);
