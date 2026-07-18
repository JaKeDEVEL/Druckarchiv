import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";

const CATEGORIES = {
  stl: { label: "STL", color: "var(--orange)", exts: ["stl"] },
  m3f: { label: "3MF", color: "var(--mint)", exts: ["3mf"] },
  cad: { label: "CAD", color: "var(--violet)", exts: ["step", "stp", "f3d", "fcstd", "scad", "iges", "igs", "dxf"] },
  gcode: { label: "G-Code", color: "var(--lime)", exts: ["gcode", "bgcode", "chitubox"] },
  image: { label: "Bilder", color: "var(--blue)", exts: ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"] },
  other: { label: "Sonstige", color: "var(--dim)", exts: [] }
};
const extCategory = new Map(Object.entries(CATEGORIES).flatMap(([key, item]) => item.exts.map(ext => [ext, key])));
const nf = new Intl.NumberFormat("de-DE");
const df = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const state = { archive: null, tab: "projects", category: "all", query: "", sort: "name", view: "grid" };

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

function allFiles() {
  if (!state.archive) return [];
  return [...state.archive.loose, ...state.archive.projects.flatMap(project => project.files)];
}

function renderStats() {
  const files = allFiles();
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map(key => [key, 0]));
  files.forEach(file => counts[categoryOf(file)]++);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const projects = state.archive?.projects.length || 0;
  const loose = state.archive?.loose.length || 0;
  const tiles = [
    { label: "Projekte", value: projects, sub: "Ordner", color: "var(--mint)", tab: "projects" },
    { label: "Dateien", value: files.length, sub: `${nf.format(loose)} einzeln`, color: "var(--dim)", tab: "loose" },
    { label: "STL", value: counts.stl, sub: "Modelle", color: "var(--orange)", category: "stl" },
    { label: "3MF", value: counts.m3f, sub: "Druckpakete", color: "var(--mint)", category: "m3f" },
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
  const cats = {};
  project.files.forEach(file => { const key = categoryOf(file); cats[key] = (cats[key] || 0) + 1; });
  const dominant = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";
  const badges = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key, count]) => `<span class="badge">${CATEGORIES[key].label} ${nf.format(count)}</span>`).join("");
  return `<button class="card" type="button" data-project="${escapeHtml(project.name)}" style="--tone:${CATEGORIES[dominant].color}"><div class="card-cover" aria-hidden="true">${CATEGORIES[dominant].label}</div><div class="card-body"><h3>${escapeHtml(project.displayName)}</h3><div class="meta"><span>${nf.format(project.files.length)} Dateien</span><span>${formatSize(project.size)}</span><span>${formatDate(project.modified)}</span></div><div class="badges">${badges}</div></div></button>`;
}

function fileCard(file) {
  const category = categoryOf(file);
  const viewable = ["stl", "m3f"].includes(category);
  return `<button class="card" type="button" data-file="${escapeHtml(file.path)}" ${viewable ? "data-viewable" : ""} style="--tone:${CATEGORIES[category].color}"><div class="card-cover" aria-hidden="true">${escapeHtml(file.extension.toUpperCase() || "DATEI")}</div><div class="card-body"><h3>${escapeHtml(file.name)}</h3><div class="meta"><span>${formatSize(file.size)}</span><span>${formatDate(file.modified)}</span></div><div class="badges"><span class="badge">${CATEGORIES[category].label}</span>${viewable ? '<span class="badge">Drehbar</span>' : ""}</div></div></button>`;
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
    entries = state.archive.projects.filter(project => project.files.some(matchesCategory) && matchesQuery(`${project.displayName} ${project.name} ${project.files.map(file => file.path).join(" ")}`));
  } else {
    entries = state.archive.loose.filter(file => matchesCategory(file) && matchesQuery(file.path));
  }
  entries.sort((a, b) => state.sort === "date" ? b.modified - a.modified : state.sort === "size" ? b.size - a.size : (a.displayName || a.name).localeCompare(b.displayName || b.name, "de"));
  library.innerHTML = entries.map(entry => state.tab === "projects" ? projectCard(entry) : fileCard(entry)).join("");
  byId("empty").classList.toggle("show", !entries.length);
  byId("empty").querySelector("b").textContent = entries.length ? "" : "Keine passenden Einträge.";
  byId("empty").querySelector("span").textContent = entries.length ? "" : "Passe Suche oder Dateifilter an.";
  byId("resultCount").textContent = `${nf.format(entries.length)} Treffer`;
  byId("sectionKicker").textContent = state.tab === "projects" ? "Projekte" : "Einzeldateien";
  byId("sectionTitle").textContent = state.category === "all" ? "Deine Bibliothek" : CATEGORIES[state.category].label;
}

function render() { renderStats(); renderLibrary(); }

async function chooseFolder() {
  const selected = await open({ directory: true, multiple: false, title: "3D-Druck-Archiv auswählen" });
  if (!selected) return;
  const button = byId("chooseFolder");
  button.disabled = true;
  button.textContent = "Ordner wird gelesen …";
  try {
    state.archive = await invoke("scan_archive", { root: selected });
    state.tab = "projects";
    state.category = "all";
    byId("rootLabel").textContent = state.archive.rootAbs;
    render();
  } catch (error) {
    window.alert(`Der Ordner konnte nicht gelesen werden:\n${error}`);
  } finally {
    button.disabled = false;
    button.textContent = "Anderen Ordner wählen";
  }
}

byId("chooseFolder").addEventListener("click", chooseFolder);
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
  if (card.dataset.project) {
    const project = state.archive.projects.find(item => item.name === card.dataset.project);
    byId("modalTitle").textContent = project.displayName;
    byId("modalList").innerHTML = project.files.map(file => { const category = categoryOf(file); return `<label class="file-row" style="--tone:${CATEGORIES[category].color}"><span class="dot"></span><span title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</span><span>${formatSize(file.size)}</span><input type="checkbox" data-path="${escapeHtml(file.path)}" aria-label="${escapeHtml(file.name)} auswählen"></label>`; }).join("");
    byId("selectedCount").textContent = "0";
    byId("copySelected").disabled = true;
    projectDialog.showModal();
  } else if (card.dataset.viewable) {
    await openArchiveModel(card.dataset.file);
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
  const paths = [...projectDialog.querySelectorAll('input[type="checkbox"]:checked')].map(box => `${state.archive.rootAbs}/${box.dataset.path}`).join("\n");
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

async function openArchiveModel(relativePath) {
  try {
    const bytes = await invoke("read_model", { root: state.archive.rootAbs, relativePath });
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

render();
