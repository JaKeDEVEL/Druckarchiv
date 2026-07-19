import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";
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
const nf = new Intl.NumberFormat("de-DE");
const df = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const STORAGE_KEY = "druckarchiv.library.v1";
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
  scanning: false
};

const byId = id => document.getElementById(id);
const categoryOf = file => extCategory.get(file.extension.toLowerCase()) || "other";
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

function renderStats() {
  const files = visibleFiles();
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map(key => [key, 0]));
  files.forEach(file => counts[categoryOf(file)]++);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const projects = state.archive?.projects.filter(project => project.files.some(visibleFile)).length || 0;
  const loose = state.archive?.loose.filter(visibleFile).length || 0;
  const tiles = [
    { label: "Projekte", value: projects, sub: "Ordner", color: "var(--mint)", tab: "projects" },
    { label: "Dateien", value: files.length, sub: `${nf.format(loose)} einzeln`, color: "var(--dim)", tab: "loose" },
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
  return `<button class="card" type="button" data-project-index="${projectIndex}" style="--tone:${CATEGORIES[dominant].color}"><div class="card-cover" aria-hidden="true">${CATEGORIES[dominant].label}</div><div class="card-body"><h3>${escapeHtml(project.displayName)}</h3><div class="meta"><span>${nf.format(shownFiles.length)} Dateien</span><span>${formatSize(size)}</span><span>${formatDate(project.modified)}</span></div><div class="badges">${badges}<span class="badge source-badge" title="${escapeHtml(root?.path || "")}">${escapeHtml(root?.name || "Ordner")}</span></div></div></button>`;
}

function fileCard(file) {
  const category = categoryOf(file);
  const viewable = ["stl", "m3f"].includes(category);
  const root = rootOf(file);
  return `<button class="card" type="button" data-file="${escapeHtml(file.path)}" data-root-index="${file.rootIndex}" ${viewable ? "data-viewable" : ""} style="--tone:${CATEGORIES[category].color}"><div class="card-cover" aria-hidden="true">${escapeHtml(file.extension.toUpperCase() || "DATEI")}</div><div class="card-body"><h3>${escapeHtml(file.name)}</h3><div class="meta"><span>${formatSize(file.size)}</span><span>${formatDate(file.modified)}</span></div><div class="badges"><span class="badge">${CATEGORIES[category].label}</span>${viewable ? '<span class="badge">Drehbar</span>' : ""}<span class="badge source-badge">${escapeHtml(root?.name || "Ordner")}</span></div></div></button>`;
}

function renderLibrary() {
  const library = byId("library");
  library.classList.toggle("list", state.view === "list");
  if (!state.archive) {
    library.innerHTML = "";
    byId("empty").classList.add("show");
    byId("resultCount").textContent = "0 Treffer";
    return;
  }
  let entries;
  if (state.tab === "projects") {
    entries = state.archive.projects.filter(project => {
      const files = filteredProjectFiles(project);
      return files.length && matchesQuery(`${project.displayName} ${project.name} ${files.map(file => file.path).join(" ")}`);
    });
  } else {
    entries = state.archive.loose.filter(file => visibleFile(file) && matchesCategory(file) && matchesQuery(file.path));
  }
  entries.sort((a, b) => state.sort === "date" ? b.modified - a.modified : state.sort === "size" ? b.size - a.size : (a.displayName || a.name).localeCompare(b.displayName || b.name, "de"));
  library.innerHTML = entries.map(entry => state.tab === "projects" ? projectCard(entry) : fileCard(entry)).join("");
  byId("empty").classList.toggle("show", !entries.length);
  byId("empty").querySelector("b").textContent = entries.length ? "" : "Keine passenden Einträge.";
  byId("empty").querySelector("span").textContent = entries.length ? "" : "Passe Suche oder Dateitypen in den Bibliothekseinstellungen an.";
  byId("resultCount").textContent = `${nf.format(entries.length)} Treffer`;
  byId("sectionKicker").textContent = state.tab === "projects" ? "Projekte" : "Einzeldateien";
  byId("sectionTitle").textContent = state.category === "all" ? "Deine Bibliothek" : CATEGORIES[state.category].label;
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
  byId("chooseFolder").textContent = state.roots.length ? "Bibliothek verwalten" : "Bibliothek einrichten";
  byId("refreshLibrary").disabled = !state.roots.length || state.scanning;
}

function render() { updateRootLabel(); renderStats(); renderLibrary(); }

function saveConfiguration() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ roots: state.roots, settings: state.settings }));
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
    includeUnknown: byId("includeUnknown").checked,
    excludedExtensions: splitExtensionRules(byId("excludedExtensions").value),
    excludedFiles: splitFileRules(byId("excludedFiles").value)
  });
}

const libraryDialog = byId("libraryDialog");
byId("chooseFolder").addEventListener("click", openLibraryDialog);
byId("openLibrarySettings").addEventListener("click", openLibraryDialog);
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
  const applied = await scanLibrary(state.pendingRoots, settingsFromForm());
  if (applied) libraryDialog.close();
});

byId("stats").addEventListener("click", event => {
  const tile = event.target.closest(".action");
  if (!tile) return;
  if (tile.dataset.category) state.category = state.category === tile.dataset.category ? "all" : tile.dataset.category;
  if (tile.dataset.tab) { state.tab = tile.dataset.tab; state.category = "all"; }
  render();
});
byId("search").addEventListener("input", event => { state.query = event.target.value.trim().toLocaleLowerCase("de"); renderLibrary(); });
byId("sort").addEventListener("change", event => { state.sort = event.target.value; renderLibrary(); });
byId("viewToggle").addEventListener("click", event => { state.view = state.view === "grid" ? "list" : "grid"; event.currentTarget.textContent = state.view === "grid" ? "Listenansicht" : "Rasteransicht"; renderLibrary(); });

const projectDialog = byId("projectDialog");
byId("library").addEventListener("click", async event => {
  const card = event.target.closest(".card");
  if (!card) return;
  if (card.dataset.projectIndex !== undefined) {
    const project = state.archive.projects[Number(card.dataset.projectIndex)];
    const files = filteredProjectFiles(project);
    byId("modalTitle").textContent = project.displayName;
    byId("modalList").innerHTML = files.map(file => { const category = categoryOf(file); return `<label class="file-row" style="--tone:${CATEGORIES[category].color}"><span class="dot"></span><span title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</span><span>${formatSize(file.size)}</span><input type="checkbox" data-path="${escapeHtml(file.path)}" data-root-index="${file.rootIndex}" aria-label="${escapeHtml(file.name)} auswählen"></label>`; }).join("");
    byId("selectedCount").textContent = "0";
    byId("copySelected").disabled = true;
    projectDialog.showModal();
  } else if (card.dataset.viewable) {
    await openArchiveModel(Number(card.dataset.rootIndex), card.dataset.file);
  }
});
projectDialog.querySelector("[data-close]").addEventListener("click", () => projectDialog.close());
projectDialog.addEventListener("click", event => { if (event.target === projectDialog) projectDialog.close(); });
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

let renderer, scene, camera, controls, model, animation;
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
  const grid = new THREE.GridHelper(500, 50, 0x37545c, 0x1f343a); scene.add(grid);
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
  let object;
  if (/\.stl$/i.test(file.name)) {
    const geometry = new STLLoader().parse(buffer); geometry.computeVertexNormals();
    object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x52d7bd, roughness: .52, metalness: .06, side: THREE.DoubleSide }));
  } else {
    object = new ThreeMFLoader().parse(buffer);
    object.traverse(child => { if (child.isMesh) { if (!child.material) child.material = new THREE.MeshStandardMaterial({ color: 0x52d7bd, roughness: .52 }); child.material.side = THREE.DoubleSide; } });
  }
  const dimensions = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  object.rotation.x = -Math.PI / 2;
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.set(-center.x, -box.min.y, -center.z);
  if (model) scene.remove(model);
  model = object; scene.add(model);
  const size = Math.max(dimensions.x, dimensions.y, dimensions.z) || 10;
  camera.position.set(size * 1.45, size * 1.05, size * 1.45);
  camera.near = Math.max(size / 1000, .001); camera.far = size * 100; camera.updateProjectionMatrix();
  controls.target.set(0, size * .25, 0); controls.update();
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
byId("viewerStage").addEventListener("drop", event => { event.preventDefault(); byId("viewerDrop").classList.remove("active"); const file = [...event.dataTransfer.files].find(item => /\.(stl|3mf)$/i.test(item.name)); if (file) loadModel(file); });
addEventListener("keydown", event => { if (event.key === "Escape" && byId("viewer").classList.contains("open")) closeViewer(); });

async function restoreConfiguration() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return;
    state.roots = Array.isArray(saved.roots) ? saved.roots.filter(root => typeof root === "string" && root) : [];
    state.settings = normalizeLibrarySettings(saved.settings);
    render();
    if (state.roots.length) await scanLibrary(state.roots, state.settings, true);
  } catch (_) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

render();
restoreConfiguration();
