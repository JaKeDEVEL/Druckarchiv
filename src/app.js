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

const CATEGORIES = {
  stl: { label: "STL", color: "var(--orange)", exts: ["stl"] },
  m3f: { label: "3MF", color: "var(--mint)", exts: ["3mf"] },
  mesh: { label: "Mesh", color: "var(--blue)", exts: ["obj", "ply", "amf"] },
  cad: { label: "CAD", color: "var(--violet)", exts: ["step", "stp", "f3d", "fcstd", "scad", "iges", "igs", "dxf"] },
  gcode: { label: "G-Code", color: "var(--lime)", exts: ["gcode", "bgcode", "chitubox", "ctb", "goo"] },
  image: { label: "Bilder", color: "var(--blue)", exts: ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"] },
  other: { label: "Sonstige", color: "var(--dim)", exts: [] }
};
const extCategory = new Map(Object.entries(CATEGORIES).flatMap(([key, item]) => item.exts.map(ext => [ext, key])));
const MODEL_EXTENSIONS = new Set(["stl", "3mf", "obj"]);
const SETTINGS_VERSION = 2;
const nf = new Intl.NumberFormat("de-DE");
const df = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const STORAGE_KEY = "druckarchiv.library.v1";
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
  scanning: false,
  fileIndex: new Map()
};

const byId = id => document.getElementById(id);
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
  if (!state.settings.showPreviews || !file || !isViewable(file)) return "";
  return `data-preview-root="${file.rootIndex}" data-preview-path="${escapeHtml(file.path)}"`;
}

function renderStats() {
  const files = visibleFiles();
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map(key => [key, 0]));
  files.forEach(file => counts[categoryOf(file)]++);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const projects = state.archive?.projects.filter(project => project.files.some(visibleFile)).length || 0;
  const tiles = [
    { label: "Projektordner", value: projects, sub: "Ordner mit Dateien", color: "var(--mint)", tab: "projects" },
    { label: "Alle Dateien", value: files.length, sub: "inkl. Unterordner", color: "var(--dim)", tab: "files" },
    { label: "STL", value: counts.stl, sub: "Modelle", color: "var(--orange)", category: "stl" },
    { label: "3MF", value: counts.m3f, sub: "Druckpakete", color: "var(--mint)", category: "m3f" },
    { label: "Mesh", value: counts.mesh, sub: "OBJ · PLY · AMF", color: "var(--blue)", category: "mesh" },
    { label: "CAD", value: counts.cad, sub: "Quelldateien", color: "var(--violet)", category: "cad" },
    { label: "G-Code", value: counts.gcode, sub: "Druckaufträge", color: "var(--lime)", category: "gcode" },
    { label: "Sonstige", value: counts.other + counts.image, sub: "inkl. Bilder", color: "var(--dim)", category: "other" },
    { label: "Speicher", value: formatSize(totalSize), sub: "gesamt", color: "var(--line)", static: true }
  ];
  byId("stats").innerHTML = tiles.map(tile => {
    const active = tile.category ? state.category === tile.category : state.category === "all" && state.tab === tile.tab;
    const attrs = tile.static ? "" : `data-${tile.category ? "category" : "tab"}="${tile.category || tile.tab}" aria-pressed="${active}"`;
    return `<${tile.static ? "div" : "button"} class="stat ${tile.static ? "" : "action"} ${active ? "on" : ""}" style="--tone:${tile.color}" ${attrs}><label>${tile.label}</label><b>${typeof tile.value === "number" ? nf.format(tile.value) : tile.value}</b><span>${tile.sub}</span></${tile.static ? "div" : "button"}>`;
  }).join("");
}

function projectCard(project) {
  const shownFiles = filteredProjectFiles(project);
  const cats = {};
  shownFiles.forEach(file => { const key = categoryOf(file); cats[key] = (cats[key] || 0) + 1; });
  const dominant = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";
  const badges = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key, count]) => `<span class="badge">${CATEGORIES[key].label} ${nf.format(count)}</span>`).join("");
  const size = shownFiles.reduce((sum, file) => sum + file.size, 0);
  const root = rootOf(project);
  const projectIndex = state.archive.projects.indexOf(project);
  const representative = shownFiles.find(isViewable);
  return `<button class="card folder-card" type="button" data-project-index="${projectIndex}" aria-label="Projektordner ${escapeHtml(project.displayName)} öffnen" style="--tone:${CATEGORIES[dominant].color}"><div class="card-cover folder-cover" ${previewAttributes(representative)} aria-hidden="true"><span class="folder-mark"><svg viewBox="0 0 64 48"><path d="M4 12h22l6 7h28v25H4z"/></svg></span><span class="kind-flag folder-flag"><svg viewBox="0 0 16 13"><path d="M1 3h6l2 2h6v7H1z"/></svg> Ordner</span><span class="cover-label">${CATEGORIES[dominant].label}</span></div><div class="card-body"><div class="entry-kind">Projektordner</div><h3>${escapeHtml(project.displayName)}</h3><div class="meta"><span>${nf.format(shownFiles.length)} Dateien</span><span>${formatSize(size)}</span><span>${formatDate(project.modified)}</span></div><div class="badges">${badges}<span class="badge source-badge" title="${escapeHtml(root?.path || "")}">${escapeHtml(root?.name || "Bibliothek")}</span></div></div></button>`;
}

function fileCard(file) {
  const category = categoryOf(file);
  const viewable = isViewable(file);
  const root = rootOf(file);
  return `<button class="card file-card" type="button" data-file="${escapeHtml(file.path)}" data-root-index="${file.rootIndex}" ${viewable ? "data-viewable" : ""} aria-label="Datei ${escapeHtml(file.name)}${viewable ? " im 3D-Viewer öffnen" : ""}" style="--tone:${CATEGORIES[category].color}"><div class="card-cover file-cover" ${previewAttributes(file)} aria-hidden="true"><span class="file-mark">${escapeHtml(file.extension.toUpperCase() || "DATEI")}</span><span class="kind-flag file-flag">Datei</span></div><div class="card-body"><div class="entry-kind">Datei · .${escapeHtml(file.extension || "–")}</div><h3>${escapeHtml(file.name)}</h3><div class="meta"><span>${formatSize(file.size)}</span><span>${formatDate(file.modified)}</span><span>${escapeHtml(file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : "Hauptordner")}</span></div><div class="badges"><span class="badge">${CATEGORIES[category].label}</span>${viewable ? '<span class="badge">3D-Vorschau</span>' : ""}<span class="badge source-badge">${escapeHtml(root?.name || "Bibliothek")}</span></div></div></button>`;
}

let libraryRenderSequence = 0;
let previewProgress = { sequence: 0, total: 0, completed: 0 };

function setLibraryLoading(loading, title = "Ansicht wird vorbereitet", detail = "Einträge werden sortiert …") {
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
  byId("sectionKicker").textContent = state.tab === "projects" ? "Projektordner" : "Dateien aus allen Ordnern";
  byId("sectionTitle").textContent = state.category === "all"
    ? (state.tab === "projects" ? "Ordnerübersicht" : "Alle Dateien")
    : `${CATEGORIES[state.category].label}-${state.tab === "projects" ? "Ordner" : "Dateien"}`;
}

function scheduleLibraryRender() {
  const sequence = ++libraryRenderSequence;
  previewObserver?.disconnect();
  previewQueue.length = 0;
  resetPreviewProgress(sequence);
  updateSectionLabels();
  setLibraryLoading(true, byId("sectionTitle").textContent, state.settings.showPreviews ? "Einträge werden vorbereitet, Vorschauen folgen …" : "Einträge werden vorbereitet …");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (sequence === libraryRenderSequence) renderLibrary(sequence);
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
    byId("resultCount").textContent = "0 Treffer";
    updateSectionLabels();
    return;
  }
  let entries;
  if (state.tab === "projects") {
    entries = state.archive.projects.filter(project => {
      const files = filteredProjectFiles(project);
      return files.length && matchesQuery(`${project.displayName} ${project.name} ${files.map(file => file.path).join(" ")}`);
    });
  } else {
    entries = allFiles().filter(file => visibleFile(file) && matchesCategory(file) && matchesQuery(`${file.name} ${file.path} ${rootOf(file)?.name || ""}`));
  }
  entries.sort((a, b) => state.sort === "date" ? b.modified - a.modified : state.sort === "size" ? b.size - a.size : (a.displayName || a.name).localeCompare(b.displayName || b.name, "de"));
  byId("empty").classList.toggle("show", !entries.length);
  byId("empty").querySelector("b").textContent = entries.length ? "" : "Keine passenden Einträge.";
  byId("empty").querySelector("span").textContent = entries.length ? "" : "Passe Suche oder Dateitypen in den Bibliothekseinstellungen an.";
  byId("resultCount").textContent = `${nf.format(entries.length)} Treffer`;
  updateSectionLabels();
  if (!entries.length) {
    setLibraryLoading(false);
    return;
  }
  renderEntryBatch(entries, sequence);
}

function updateRootLabel() {
  const roots = state.archive?.roots || [];
  if (!roots.length) {
    byId("rootLabel").textContent = state.roots.length
      ? `${nf.format(state.roots.length)} gespeicherte Ordner · Neu einlesen erforderlich`
      : "Noch keine Bibliotheksordner ausgewählt";
  } else if (roots.length === 1) {
    byId("rootLabel").textContent = roots[0].path;
  } else {
    byId("rootLabel").textContent = `${nf.format(roots.length)} Ordner · ${roots.map(root => root.name).join(" · ")}`;
  }
  byId("chooseFolder").textContent = "Bibliothek verwalten";
  byId("refreshLibrary").disabled = !state.roots.length || state.scanning;
}

function render() { updateRootLabel(); renderStats(); renderLibrary(); }

function saveConfiguration() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ settingsVersion: SETTINGS_VERSION, roots: state.roots, settings: state.settings }));
}

function setScanning(scanning) {
  state.scanning = scanning;
  byId("chooseFolder").disabled = scanning;
  byId("refreshLibrary").disabled = scanning || !state.roots.length;
  byId("applyLibrarySettings").disabled = scanning;
  if (scanning) {
    byId("chooseFolder").textContent = "Bibliothek wird gelesen …";
    byId("settingsStatus").textContent = "Ordner werden sicher und nur lesend eingelesen …";
  }
}

async function scanLibrary(roots, settings = state.settings, silent = false) {
  if (!roots.length) {
    state.archive = null;
    state.fileIndex = new Map();
    state.roots = [];
    state.settings = normalizeLibrarySettings(settings);
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
    saveConfiguration();
    render();
    return true;
  } catch (error) {
    if (!silent) window.alert(`Die Bibliothek konnte nicht gelesen werden:\n${error}`);
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
    return `<div class="root-row"><span class="root-index">${String(index + 1).padStart(2, "0")}</span><span><b>${escapeHtml(name)}</b><small title="${escapeHtml(path)}">${escapeHtml(path)}</small></span><button type="button" data-remove-root="${index}" aria-label="${escapeHtml(name)} entfernen">Entfernen</button></div>`;
  }).join("") : '<div class="root-empty"><b>Noch keine Quelle</b><span>Füge einen oder mehrere Ordner mit deinen Druckdateien hinzu.</span></div>';

  const draft = state.pendingSettings || state.settings;
  const enabled = new Set(draft.enabledExtensions);
  byId("formatGroups").innerHTML = FORMAT_GROUPS.map(group => `<fieldset><legend>${group.label}</legend><div>${group.formats.map(format => `<label class="format-chip"><input type="checkbox" value="${format.ext}" ${enabled.has(format.ext) ? "checked" : ""}><span><b>${format.label}</b><small>.${format.ext}</small></span></label>`).join("")}</div></fieldset>`).join("");
  byId("showPreviews").checked = draft.showPreviews;
  byId("includeUnknown").checked = draft.includeUnknown;
  byId("excludedExtensions").value = draft.excludedExtensions.join(", ");
  byId("excludedFiles").value = draft.excludedFiles.join("\n");
  byId("settingsStatus").textContent = state.pendingRoots.length
    ? `${nf.format(state.pendingRoots.length)} Ordner ausgewählt`
    : "Noch keine Ordner ausgewählt";
}

function openLibraryDialog() {
  state.pendingRoots = [...state.roots];
  state.pendingSettings = normalizeLibrarySettings(state.settings);
  renderSettingsDialog();
  byId("libraryDialog").showModal();
}

async function addFolders() {
  const selected = await open({ directory: true, multiple: true, title: "Bibliotheksordner hinzufügen" });
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
libraryDialog.addEventListener("click", event => { if (event.target === libraryDialog) libraryDialog.close(); });
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
  scheduleLibraryRender();
});
let searchTimer;
byId("search").addEventListener("input", event => {
  state.query = event.target.value.trim().toLocaleLowerCase("de");
  clearTimeout(searchTimer);
  searchTimer = setTimeout(scheduleLibraryRender, 90);
});
byId("sort").addEventListener("change", event => { state.sort = event.target.value; scheduleLibraryRender(); });
byId("viewToggle").addEventListener("click", event => { state.view = state.view === "grid" ? "list" : "grid"; event.currentTarget.textContent = state.view === "grid" ? "Listenansicht" : "Rasteransicht"; scheduleLibraryRender(); });

const projectDialog = byId("projectDialog");
byId("library").addEventListener("click", async event => {
  const card = event.target.closest(".card");
  if (!card) return;
  if (card.dataset.projectIndex !== undefined) {
    const project = state.archive.projects[Number(card.dataset.projectIndex)];
    const files = filteredProjectFiles(project);
    byId("modalTitle").textContent = project.displayName;
    byId("modalList").innerHTML = files.map(file => {
      const category = categoryOf(file);
      const name = isViewable(file)
        ? `<button class="file-preview-button" type="button" data-model-root="${file.rootIndex}" data-model-path="${escapeHtml(file.path)}" title="${escapeHtml(file.path)}"><span>${escapeHtml(file.path)}</span><small>Im 3D-Viewer öffnen</small></button>`
        : `<span class="file-name" title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</span>`;
      return `<div class="file-row" style="--tone:${CATEGORIES[category].color}"><span class="dot"></span>${name}<span>${formatSize(file.size)}</span><span class="file-format">${escapeHtml(file.extension.toUpperCase() || "Datei")}</span><input type="checkbox" data-path="${escapeHtml(file.path)}" data-root-index="${file.rootIndex}" aria-label="${escapeHtml(file.name)} auswählen"></div>`;
    }).join("");
    byId("selectedCount").textContent = "0";
    byId("copySelected").disabled = true;
    projectDialog.showModal();
  } else if (card.dataset.viewable) {
    await openArchiveModel(Number(card.dataset.rootIndex), card.dataset.file);
  }
});
projectDialog.querySelector("[data-close]").addEventListener("click", () => projectDialog.close());
projectDialog.addEventListener("click", event => { if (event.target === projectDialog) projectDialog.close(); });
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
    byId("copySelected").textContent = "Kopiert ✓";
    setTimeout(() => { byId("copySelected").textContent = "Pfade kopieren"; }, 1300);
  } catch (_) {
    window.prompt("Ausgewählte Pfade:", paths);
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
    throw new Error("Nicht unterstütztes Modellformat");
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
  if (box.isEmpty()) throw new Error("Das Modell enthält keine darstellbare Geometrie.");
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
    if (file.size > MAX_PREVIEW_BYTES) throw new Error("Modell ist für eine automatische Vorschau zu groß.");
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
  byId("previewStatusText").textContent = `Vorschaubilder ${nf.format(completed)} von ${nf.format(total)} · Einträge sind bereits nutzbar`;
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
    }).catch(() => cover.isConnected && cover.classList.add("preview-failed")).finally(() => {
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
  } catch (error) { window.alert(`Das Modell konnte nicht geladen werden:\n${error}`); }
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

render();
byId("appVersion").textContent = APP_VERSION.includes("beta") ? `Beta ${APP_VERSION}` : `v${APP_VERSION}`;
restoreConfiguration();
