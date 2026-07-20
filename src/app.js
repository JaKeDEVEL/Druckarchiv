import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
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
import { compareFavoriteState, favoriteFileKey, favoriteFolderKey, favoriteToggleNeedsRender, FAVORITES_STORAGE_KEY, folderPathsForFiles, normalizeFavoriteKeys } from "./favorites.js";

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
  favoriteInventory: { files: new Set(), projects: new Set() }
};
let slicerOpening = false;

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
const matchesFavoriteFilter = file => !state.favoriteOnly || isFavorite(file);
const filteredProjectFiles = project => project.files.filter(file => visibleFile(file) && matchesCategory(file));
const projectFolderPath = (project, path = "") => path ? `${project?.name || ""}/${path}`.replace(/^\//, "") : (project?.name || "");
const folderFavoriteKeyOf = (rootIndex, path) => favoriteFolderKey(state.archive?.roots[rootIndex]?.path || "", path);
const isFolderFavorite = (rootIndex, path) => state.favorites.has(folderFavoriteKeyOf(rootIndex, path));

function projectHasFavorite(project, files = filteredProjectFiles(project)) {
  if (files.some(isFavorite)) return true;
  return folderPathsForFiles(project.name, files).some(path => isFolderFavorite(project.rootIndex, path));
}

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

function rebuildFavoriteInventory() {
  const fileKeys = new Set();
  const projectKeys = new Set();
  for (const file of visibleFiles()) fileKeys.add(favoriteKeyOf(file));
  for (const project of state.archive?.projects || []) {
    const files = project.files.filter(visibleFile);
    for (const file of files) projectKeys.add(favoriteKeyOf(file));
    for (const path of folderPathsForFiles(project.name, files)) projectKeys.add(folderFavoriteKeyOf(project.rootIndex, path));
  }
  state.favoriteInventory = { files: fileKeys, projects: projectKeys };
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...state.favorites]));
}

function updateFavoriteControls() {
  const favoriteKeys = state.favoriteInventory[state.tab] || state.favoriteInventory.files;
  const count = [...favoriteKeys].filter(key => state.favorites.has(key)).length;
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
    const active = tile.category ? state.category === tile.category : state.category === "all" && state.tab === tile.tab;
    const attrs = `data-${tile.category ? "category" : "tab"}="${tile.category || tile.tab}" aria-pressed="${active}"`;
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
  updateViewModeSwitch("viewModeSwitch", "view-mode", state.view);
  const refresh = byId("refreshLibrary");
  const refreshLabel = t("nav.refresh");
  refresh.setAttribute("aria-label", refreshLabel);
  refresh.title = refreshLabel;
  refresh.dataset.tooltip = refreshLabel;
}

function updateSectionLabels() {
  const selected = selectedKpiExtensions(state.settings);
  const categoryLabel = state.category === "all" ? "" : kpiDescriptor(state.category, selected[state.category] || []).label;
  byId("sectionKicker").textContent = state.tab === "projects" ? t("sections.projectFolders") : t("sections.filesFromAllFolders");
  byId("sectionTitle").textContent = state.category === "all"
    ? (state.tab === "projects" ? t("sections.folderOverview") : t("sections.allFiles"))
    : t(state.tab === "projects" ? "sections.categoryFolders" : "sections.categoryFiles", { category: categoryLabel });
  byId("libraryModeSwitch").querySelectorAll("[data-library-tab]").forEach(button => {
    const active = button.dataset.libraryTab === state.tab;
    button.classList.toggle("on", active);
    button.setAttribute("aria-pressed", String(active));
  });
  updateToolbarControls();
  updateFavoriteControls();
  updateLibrarySelection();
}

function updateLibrarySelection() {
  const selection = byId("librarySelection");
  selection.hidden = state.tab !== "files" || !state.archive;
  const count = state.librarySelection.size;
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
  const batchSize = state.view === "grid" ? 72 : 140;
  const end = Math.min(offset + batchSize, entries.length);
  library.insertAdjacentHTML("beforeend", entries.slice(offset, end).map(entry => state.tab === "projects" ? projectCard(entry) : fileCard(entry)).join(""));
  hydrateModelPreviews(sequence);
  if (offset === 0) setLibraryLoading(false);
  if (end < entries.length) {
    requestAnimationFrame(() => renderEntryBatch(entries, sequence, end));
  } else {
    library.setAttribute("aria-busy", "false");
  }
}

function renderPagination(result) {
  const pagination = byId("pagination");
  const pageSizeControl = byId("pageSizeControl");
  byId("pageSize").value = String(result.pageSize);
  pageSizeControl.hidden = result.total <= PAGE_SIZES[0];

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
  library.classList.toggle("list", state.view === "list");
  library.innerHTML = "";
  if (!state.archive) {
    setLibraryLoading(false);
    byId("empty").classList.add("show");
    renderPagination(paginateEntries([], state.page, state.pageSize));
    updateSectionLabels();
    return;
  }
  let entries;
  if (state.tab === "projects") {
    entries = state.archive.projects.filter(project => {
      const files = filteredProjectFiles(project);
      if (!files.length) return false;
      if (state.favoriteOnly && !projectHasFavorite(project, files)) return false;
      if (!state.query || matchesQuery(`${project.displayName} ${project.name}`)) return true;
      return files.some(file => matchesQuery(file.path));
    });
  } else {
    entries = allFiles().filter(file => visibleFile(file) && matchesCategory(file) && matchesFavoriteFilter(file) && matchesQuery(`${file.name} ${file.path} ${rootOf(file)?.name || ""}`));
  }
  entries.sort((a, b) => {
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
  byId("empty").querySelector("span").textContent = entries.length ? "" : t(state.favoriteOnly ? "favorites.emptyDetail" : "empty.noMatchesDetail");
  const pageResult = paginateEntries(entries, state.page, state.pageSize);
  state.page = pageResult.page;
  renderPagination(pageResult);
  updateSectionLabels();
  if (!entries.length) {
    setLibraryLoading(false);
    return;
  }
  renderEntryBatch(pageResult.items, sequence);
}

function updateRootLabel() {
  const roots = state.archive?.roots || [];
  if (!roots.length) {
    byId("rootLabel").textContent = state.roots.length
      ? t("roots.savedNeedsRefresh", { count: state.roots.length })
      : t("app.noFolder");
  } else if (roots.length === 1) {
    byId("rootLabel").textContent = roots[0].path;
  } else {
    byId("rootLabel").textContent = t("roots.multiple", { count: roots.length, names: roots.map(root => root.name).join(" · ") });
  }
  updateLibraryControls();
}

function render() { rebuildFavoriteInventory(); updateRootLabel(); renderStats(); renderLibrary(); }

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
    state.roots = archive.roots.map(root => root.path);
    state.settings = normalizeLibrarySettings(settings);
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
  if (tile.dataset.category) state.category = state.category === tile.dataset.category ? "all" : tile.dataset.category;
  if (tile.dataset.tab) { state.tab = tile.dataset.tab; state.category = "all"; }
  renderStats();
  scheduleLibraryRender({ resetPage: true });
});
byId("libraryModeSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-library-tab]");
  if (!button || button.dataset.libraryTab === state.tab) return;
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
  scheduleLibraryRender({ resetPage: true });
});
byId("viewModeSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-view-mode]");
  if (!button || button.dataset.viewMode === state.view) return;
  state.view = button.dataset.viewMode;
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

function compareProjectEntries(left, right) {
  if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
  if (state.sort === "favorite") {
    const project = state.archive?.projects[Number(projectDialog.dataset.projectIndex)];
    const leftFavorite = left.kind === "folder" ? isFolderFavorite(project?.rootIndex, projectFolderPath(project, left.path)) : isFavorite(left.file);
    const rightFavorite = right.kind === "folder" ? isFolderFavorite(project?.rootIndex, projectFolderPath(project, right.path)) : isFavorite(right.file);
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
    .sort(compareProjectEntries);
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
    state.projectPath = "";
    state.projectPage = 1;
    state.projectSelection.clear();
    renderProjectContents(Number(card.dataset.projectIndex));
    projectDialog.showModal();
    if (state.projectView === "grid") {
      scheduleProjectGridCapacitySync();
      hydrateProjectPreviews();
    }
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
  state.viewerFileKey = sourceKey;
  openViewer();
  ensureViewer();
  model = releaseViewerModel(scene, model, disposeModel);
  model = object; scene.add(model);
  const dimensions = frameModel(object, camera, controls, 1.3);
  viewerGrid.position.y = -dimensions.y / 2;
  viewerGrid.scale.setScalar(Math.max(dimensions.x, dimensions.y, dimensions.z) / 500 || 1);
  byId("viewerName").textContent = file.name;
  byId("viewerInfo").textContent = `${dimensions.x.toFixed(1)} × ${dimensions.y.toFixed(1)} × ${dimensions.z.toFixed(1)} mm`;
}

async function openArchiveModel(rootIndex, relativePath) {
  try {
    const bytes = await invoke("read_model", { root: state.archive.roots[rootIndex].path, relativePath });
    await loadModel(new File([new Uint8Array(bytes)], relativePath.split("/").pop()), `${rootIndex}\n${relativePath}`);
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
  const requestedDemoFiles = Number(new URLSearchParams(location.search).get("demoFiles")) || 0;
  state.archive = createDemoArchive(requestedDemoFiles);
  state.roots = state.archive.roots.map(root => root.path);
  state.fileIndex = new Map(allFiles().map(file => [`${file.rootIndex}\n${file.path}`, file]));
  render();
} else {
  restoreConfiguration();
}
