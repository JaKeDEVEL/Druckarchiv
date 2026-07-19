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
import { PAGE_SIZES, normalizePageSize, paginateEntries, paginationTokens } from "./pagination.js";
import { applyTranslations, formatDateValue, formatNumber, getLocale, onLocaleChange, setLocale, t } from "./i18n.js";

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
const APP_VERSION = __APP_VERSION__;
const state = {
  archive: null,
  roots: [],
  pendingRoots: [],
  pendingSettings: null,
  settings: defaultLibrarySettings(),
  tab: "projects",
  category: "all",
  query: "",
  sort: "name",
  view: "grid",
  page: 1,
  pageSize: normalizePageSize(localStorage.getItem(PAGE_SIZE_KEY)),
  scanning: false,
  fileIndex: new Map()
};

const byId = id => document.getElementById(id);
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
const filteredProjectFiles = project => project.files.filter(file => visibleFile(file) && matchesCategory(file));

function allFiles() {
  if (!state.archive) return [];
  return [...state.archive.loose, ...state.archive.projects.flatMap(project => project.files)];
}

function visibleFiles() {
  return allFiles().filter(visibleFile);
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
  return `<button class="card folder-card" type="button" data-project-index="${projectIndex}" aria-label="${escapeHtml(t("cards.openProject", { name: project.displayName }))}" style="--tone:${CATEGORIES[dominant].color}"><div class="card-cover folder-cover ${previewCoverClass(representative)}" ${previewAttributes(representative)} aria-hidden="true">${demoPreviewMarkup(representative)}<span class="folder-mark"><svg viewBox="0 0 64 48"><path d="M4 12h22l6 7h28v25H4z"/></svg></span><span class="kind-flag folder-flag"><svg viewBox="0 0 16 13"><path d="M1 3h6l2 2h6v7H1z"/></svg> ${t("common.folder")}</span><span class="cover-label">${categoryLabel(dominant)}</span></div><div class="card-body"><div class="entry-kind">${t("cards.projectFolder")}</div><h3>${escapeHtml(project.displayName)}</h3><div class="meta"><span>${t("common.filesCount", { count: shownFiles.length })}</span><span>${formatSize(size)}</span><span>${formatDate(project.modified)}</span></div><div class="badges">${badges}<span class="badge source-badge" title="${escapeHtml(root?.path || "")}">${escapeHtml(root?.name || t("common.library"))}</span></div></div></button>`;
}

function fileCard(file) {
  const category = categoryOf(file);
  const viewable = isViewable(file);
  const root = rootOf(file);
  const ariaLabel = `${t("cards.openFile", { name: file.name })}${viewable ? t("cards.openFileViewerSuffix") : ""}`;
  return `<button class="card file-card" type="button" data-file="${escapeHtml(file.path)}" data-root-index="${file.rootIndex}" ${viewable ? 'data-viewable="true"' : ""} aria-label="${escapeHtml(ariaLabel)}" style="--tone:${CATEGORIES[category].color}"><div class="card-cover file-cover ${previewCoverClass(file)}" ${previewAttributes(file)} aria-hidden="true">${demoPreviewMarkup(file)}<span class="file-mark">${escapeHtml(file.extension.toUpperCase() || t("common.file").toUpperCase())}</span><span class="kind-flag file-flag">${t("common.file")}</span></div><div class="card-body"><div class="entry-kind">${t("cards.fileEntry", { extension: escapeHtml(file.extension || "–") })}</div><h3>${escapeHtml(file.name)}</h3><div class="meta"><span>${formatSize(file.size)}</span><span>${formatDate(file.modified)}</span><span>${escapeHtml(file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : t("common.mainFolder"))}</span></div><div class="badges"><span class="badge">${categoryLabel(category)}</span>${viewable ? `<span class="badge">${t("cards.preview")}</span>` : ""}<span class="badge source-badge">${escapeHtml(root?.name || t("common.library"))}</span></div></div></button>`;
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

function updateSectionLabels() {
  const selected = selectedKpiExtensions(state.settings);
  const categoryLabel = state.category === "all" ? "" : kpiDescriptor(state.category, selected[state.category] || []).label;
  byId("sectionKicker").textContent = state.tab === "projects" ? t("sections.projectFolders") : t("sections.filesFromAllFolders");
  byId("sectionTitle").textContent = state.category === "all"
    ? (state.tab === "projects" ? t("sections.folderOverview") : t("sections.allFiles"))
    : t(state.tab === "projects" ? "sections.categoryFolders" : "sections.categoryFiles", { category: categoryLabel });
}

function scheduleLibraryRender({ resetPage = false, scrollToResults = false } = {}) {
  if (resetPage) state.page = 1;
  const sequence = ++libraryRenderSequence;
  previewObserver?.disconnect();
  previewQueue.length = 0;
  resetPreviewProgress(sequence);
  updateSectionLabels();
  byId("pagination").hidden = true;
  setLibraryLoading(true, byId("sectionTitle").textContent, state.settings.showPreviews ? t("loading.preparingWithPreviews") : t("loading.preparingEntries"));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (sequence !== libraryRenderSequence) return;
    renderLibrary(sequence);
    if (scrollToResults) byId("sectionTitle").scrollIntoView({ block: "start" });
  }));
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
      if (!state.query || matchesQuery(`${project.displayName} ${project.name}`)) return true;
      return files.some(file => matchesQuery(file.path));
    });
  } else {
    entries = allFiles().filter(file => visibleFile(file) && matchesCategory(file) && matchesQuery(`${file.name} ${file.path} ${rootOf(file)?.name || ""}`));
  }
  entries.sort((a, b) => state.sort === "date" ? b.modified - a.modified : state.sort === "size" ? b.size - a.size : (a.displayName || a.name).localeCompare(b.displayName || b.name, getLocale()));
  byId("empty").classList.toggle("show", !entries.length);
  byId("empty").querySelector("b").textContent = entries.length ? "" : t("empty.noMatchesTitle");
  byId("empty").querySelector("span").textContent = entries.length ? "" : t("empty.noMatchesDetail");
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

function render() { updateRootLabel(); renderStats(); renderLibrary(); }

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
  state.pendingSettings = normalizeLibrarySettings(state.settings);
  renderSettingsDialog();
  if (!byId("libraryDialog").open) byId("libraryDialog").showModal();
}

async function addFolders() {
  const selected = await open({ directory: true, multiple: true, title: t("settings.addDialogTitle") });
  if (!selected) return;
  state.pendingSettings = settingsFromForm();
  const additions = Array.isArray(selected) ? selected : [selected];
  state.pendingRoots = [...new Set([...state.pendingRoots, ...additions])];
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
let searchTimer;
byId("search").addEventListener("input", event => {
  state.query = event.target.value.trim().toLocaleLowerCase("de");
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => scheduleLibraryRender({ resetPage: true }), 90);
});
byId("sort").addEventListener("change", event => { state.sort = event.target.value; scheduleLibraryRender({ resetPage: true }); });
byId("viewToggle").addEventListener("click", event => { state.view = state.view === "grid" ? "list" : "grid"; event.currentTarget.textContent = t(state.view === "grid" ? "nav.listView" : "nav.gridView"); scheduleLibraryRender(); });
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
function renderProjectContents(projectIndex) {
  const project = state.archive.projects[projectIndex];
  if (!project) return;
  const files = filteredProjectFiles(project);
  projectDialog.dataset.projectIndex = String(projectIndex);
  byId("modalTitle").textContent = project.displayName;
  byId("modalList").innerHTML = files.map(file => {
    const category = categoryOf(file);
    const name = isViewable(file)
      ? `<button class="file-preview-button" type="button" data-model-root="${file.rootIndex}" data-model-path="${escapeHtml(file.path)}" title="${escapeHtml(file.path)}"><span>${escapeHtml(file.path)}</span><small>${t("project.openViewer")}</small></button>`
      : `<span class="file-name" title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</span>`;
    return `<div class="file-row" style="--tone:${CATEGORIES[category].color}"><span class="dot"></span>${name}<span>${formatSize(file.size)}</span><span class="file-format">${escapeHtml(file.extension.toUpperCase() || t("common.file"))}</span><input type="checkbox" data-path="${escapeHtml(file.path)}" data-root-index="${file.rootIndex}" aria-label="${escapeHtml(t("project.selectFile", { name: file.name }))}"></div>`;
  }).join("");
  byId("selectedCount").textContent = "0";
  byId("copySelected").disabled = true;
  byId("copySelected").textContent = t("project.copyPaths");
}

byId("library").addEventListener("click", async event => {
  const card = event.target.closest(".card");
  if (!card) return;
  if (card.dataset.projectIndex !== undefined) {
    renderProjectContents(Number(card.dataset.projectIndex));
    projectDialog.showModal();
  } else if (canOpenModelCard(card)) {
    await openArchiveModel(Number(card.dataset.rootIndex), card.dataset.file);
  }
});
projectDialog.querySelector("[data-close]").addEventListener("click", () => projectDialog.close());
projectDialog.addEventListener("click", event => { if (event.target === projectDialog) projectDialog.close(); });
projectDialog.addEventListener("close", () => { delete projectDialog.dataset.projectIndex; });
byId("modalList").addEventListener("click", async event => {
  const button = event.target.closest("[data-model-path]");
  if (!button) return;
  projectDialog.close();
  await openArchiveModel(Number(button.dataset.modelRoot), button.dataset.modelPath);
});
projectDialog.addEventListener("change", () => {
  const count = projectDialog.querySelectorAll('input[type="checkbox"]:checked').length;
  byId("selectedCount").textContent = nf.format(count);
  byId("copySelected").disabled = count === 0;
});
byId("copySelected").addEventListener("click", async () => {
  const paths = [...projectDialog.querySelectorAll('input[type="checkbox"]:checked')].map(box => {
    const root = state.archive.roots[Number(box.dataset.rootIndex)].path;
    const separator = root.includes("\\") ? "\\" : "/";
    return `${root}${separator}${box.dataset.path.replaceAll("/", separator)}`;
  }).join("\n");
  try {
    await navigator.clipboard.writeText(paths);
    byId("copySelected").textContent = t("project.copied");
    setTimeout(() => { byId("copySelected").textContent = t("project.copyPaths"); }, 1300);
  } catch (_) {
    window.prompt(t("project.selectedPathsPrompt"), paths);
  }
});

function createModelObject(buffer, name, neutralMaterial = false) {
  const extension = name.split(".").pop().toLowerCase();
  let object;
  if (extension === "stl") {
    const geometry = new STLLoader().parse(buffer);
    geometry.computeVertexNormals();
    object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x52d7bd, roughness: .52, metalness: .06, side: THREE.DoubleSide }));
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
    if (neutralMaterial || !child.material) {
      child.material = new THREE.MeshStandardMaterial({ color: 0x52d7bd, roughness: .52, metalness: .06, side: THREE.DoubleSide });
    } else if (Array.isArray(child.material)) {
      child.material.forEach(material => { material.side = THREE.DoubleSide; });
    } else {
      child.material.side = THREE.DoubleSide;
    }
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
  thumbnailScene = new THREE.Scene();
  thumbnailScene.background = new THREE.Color(0x101d21);
  thumbnailCamera = new THREE.PerspectiveCamera(38, 420 / 240, .001, 100000);
  thumbnailScene.add(new THREE.HemisphereLight(0xe8fffa, 0x0c1518, 1.75));
  const key = new THREE.DirectionalLight(0xffffff, 2.25);
  key.position.set(2, 3, 2);
  thumbnailScene.add(key);
  const rim = new THREE.DirectionalLight(0x52d7bd, .9);
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
    const object = createModelObject(new Uint8Array(bytes).buffer, file.name, true);
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
function ensureViewer() {
  if (renderer) return;
  const stage = byId("viewerStage");
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x081013);
  camera = new THREE.PerspectiveCamera(42, 1, .01, 100000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xe8fffa, 0x101a1e, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(1.2, 1.6, .9); scene.add(key);
  const rim = new THREE.DirectionalLight(0x52d7bd, .65); rim.position.set(-1, .5, -1); scene.add(rim);
  viewerGrid = new THREE.GridHelper(500, 50, 0x37545c, 0x1f343a); scene.add(viewerGrid);
  const resize = () => { const width = stage.clientWidth, height = stage.clientHeight; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  addEventListener("resize", resize); resize();
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

async function loadModel(file) {
  openViewer();
  ensureViewer();
  const buffer = await file.arrayBuffer();
  const object = createModelObject(buffer, file.name);
  if (model) { scene.remove(model); disposeModel(model); }
  model = object; scene.add(model);
  const dimensions = frameModel(object, camera, controls, 1.3);
  viewerGrid.position.y = -dimensions.y / 2;
  viewerGrid.scale.setScalar(Math.max(dimensions.x, dimensions.y, dimensions.z) / 500 || 1);
  byId("viewerDrop").style.display = "none";
  byId("viewerName").textContent = file.name;
  byId("viewerInfo").textContent = `${dimensions.x.toFixed(1)} × ${dimensions.y.toFixed(1)} × ${dimensions.z.toFixed(1)} mm`;
}

async function openArchiveModel(rootIndex, relativePath) {
  try {
    const bytes = await invoke("read_model", { root: state.archive.roots[rootIndex].path, relativePath });
    await loadModel(new File([new Uint8Array(bytes)], relativePath.split("/").pop()));
  } catch (error) { window.alert(t("viewer.loadError", { error })); }
}
function openViewer() { byId("viewer").classList.add("open"); byId("viewer").setAttribute("aria-hidden", "false"); requestAnimationFrame(() => { ensureViewer(); startViewerLoop(); }); }
function closeViewer() { byId("viewer").classList.remove("open"); byId("viewer").setAttribute("aria-hidden", "true"); if (animation) cancelAnimationFrame(animation); animation = null; }
byId("openViewer").addEventListener("click", openViewer);
byId("closeViewer").addEventListener("click", closeViewer);
byId("pickModel").addEventListener("click", () => byId("modelInput").click());
byId("modelInput").addEventListener("change", event => event.target.files[0] && loadModel(event.target.files[0]));
for (const eventName of ["dragenter", "dragover"]) byId("viewerStage").addEventListener(eventName, event => { event.preventDefault(); byId("viewerDrop").classList.add("active"); });
byId("viewerStage").addEventListener("dragleave", () => byId("viewerDrop").classList.remove("active"));
byId("viewerStage").addEventListener("drop", event => { event.preventDefault(); byId("viewerDrop").classList.remove("active"); const file = [...event.dataTransfer.files].find(item => /\.(stl|3mf|obj)$/i.test(item.name)); if (file) loadModel(file); });
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
  byId("localeSelect").value = getLocale();
  byId("viewToggle").textContent = t(state.view === "grid" ? "nav.listView" : "nav.gridView");
  render();
  if (libraryDialog.open) renderSettingsDialog();
  if (projectDialog.open && projectDialog.dataset.projectIndex !== undefined) renderProjectContents(Number(projectDialog.dataset.projectIndex));
}

byId("localeSelect").addEventListener("change", event => setLocale(event.target.value));
onLocaleChange(refreshLocalizedInterface);
applyTranslations();
byId("localeSelect").value = getLocale();
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
