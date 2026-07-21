const concepts = {
  material: {
    index: "A",
    eyebrow: "Referenzrichtung",
    title: "Strict Material 3",
    description: "Eine bewusst nahe M3-Interpretation mit Navigation Rail, dynamischen Farbrollen, großzügigen Formen und klaren Zuständen.",
    properties: [["Dichte", "komfortabel"], ["Form", "M3 · weich"], ["Signatur", "Systemtreue"]]
  },
  workshop: {
    index: "B",
    eyebrow: "Empfohlene Richtung",
    title: "Druckarchiv × Material 3",
    description: "Material-Logik mit kompakter Desktop-Dichte, Filament-Orange und einer eigenständigen Werkstattidentität.",
    properties: [["Dichte", "kompakt"], ["Form", "präzise"], ["Signatur", "Druckschichten"]]
  },
  utility: {
    index: "C",
    eyebrow: "Konservative Richtung",
    title: "Quiet Desktop Utility",
    description: "Ein ruhiges professionelles Werkzeug: hierarchisch, informationsdicht und näher an vertrauten Desktop-Dateiverwaltern.",
    properties: [["Dichte", "hoch"], ["Form", "zurückhaltend"], ["Signatur", "Asset-Inspektor"]]
  },
  hybrid: {
    index: "D",
    eyebrow: "Synthese aus deinem Feedback",
    title: "Quiet Material",
    description: "Die Klarheit eines Desktop-Dateiwerkzeugs, ergänzt um weichere Material-Zustände, Mineralblau und sparsame räumliche Tiefe.",
    properties: [["Dichte", "hoch"], ["Form", "sanft"], ["Signatur", "Archivstufen"]]
  }
};

const assets = [
  { id: 1, parentId: null, kind: "folder", name: "Organizer-System", format: "stl", formats: ["stl", "3mf", "gcode"], detail: "7 Einträge", size: 24.8, sizeLabel: "24,8 MB", date: "16.07.2026", source: "Modelle", favorite: true, model: "tray" },
  { id: 2, parentId: null, kind: "folder", name: "Drucker-Upgrades", format: "3mf", formats: ["stl", "3mf", "obj"], detail: "5 Einträge", size: 18.7, sizeLabel: "18,7 MB", date: "15.07.2026", source: "Modelle", favorite: false, model: "bracket" },
  { id: 3, parentId: null, kind: "folder", name: "Varianten", format: "stl", formats: ["stl"], detail: "4 Einträge", size: 12.6, sizeLabel: "12,6 MB", date: "15.07.2026", source: "Modelle", favorite: true, model: "stand" },
  { id: 4, parentId: 2, kind: "file", name: "Kabelclip.3mf", format: "3mf", formats: ["3mf"], detail: "Drucker-Upgrades", size: 4.2, sizeLabel: "4,2 MB", date: "Heute, 08:17", source: "Modelle", favorite: true, model: "clip" },
  { id: 5, parentId: 1, kind: "file", name: "Werkzeughalter.stl", format: "stl", formats: ["stl"], detail: "Organizer-System", size: 3.8, sizeLabel: "3,8 MB", date: "Gestern", source: "Modelle", favorite: false, model: "holder" },
  { id: 6, parentId: 2, kind: "file", name: "Ersatzrad.obj", format: "obj", formats: ["obj"], detail: "Drucker-Upgrades", size: 2.1, sizeLabel: "2,1 MB", date: "14.07.2026", source: "Modelle", favorite: false, model: "gear" },
  { id: 7, parentId: 3, kind: "file", name: "Kalibrierwürfel.stl", format: "stl", formats: ["stl"], detail: "Varianten", size: 1.4, sizeLabel: "1,4 MB", date: "12.07.2026", source: "Modelle", favorite: true, model: "cube" },
  { id: 8, parentId: 1, kind: "file", name: "Organizer-Platte.gcode", format: "gcode", formats: ["gcode"], detail: "Organizer-System", size: 6.3, sizeLabel: "6,3 MB", date: "11.07.2026", source: "Druckaufträge", favorite: false, model: "layers" },
  { id: 9, parentId: 1, kind: "folder", name: "Schubladen", format: "stl", formats: ["stl"], detail: "2 Dateien", size: 4.9, sizeLabel: "4,9 MB", date: "10.07.2026", source: "Modelle", favorite: false, model: "tray" },
  { id: 10, parentId: 9, kind: "file", name: "Besteckeinsatz.stl", format: "stl", formats: ["stl"], detail: "Schubladen", size: 2.7, sizeLabel: "2,7 MB", date: "10.07.2026", source: "Modelle", favorite: false, model: "tray" },
  { id: 11, parentId: 1, kind: "file", name: "Eckenverbinder.stl", format: "stl", formats: ["stl"], detail: "Organizer-System", size: 1.2, sizeLabel: "1,2 MB", date: "09.07.2026", source: "Modelle", favorite: false, model: "bracket" },
  { id: 12, parentId: 2, kind: "file", name: "Düsenhalter.stl", format: "stl", formats: ["stl"], detail: "Drucker-Upgrades", size: 1.8, sizeLabel: "1,8 MB", date: "08.07.2026", source: "Modelle", favorite: false, model: "holder" },
  { id: 13, parentId: 2, kind: "file", name: "Druckerfuß.3mf", format: "3mf", formats: ["3mf"], detail: "Drucker-Upgrades", size: 3.4, sizeLabel: "3,4 MB", date: "07.07.2026", source: "Modelle", favorite: true, model: "stand" },
  { id: 14, parentId: 3, kind: "file", name: "Vase-Variante-A.stl", format: "stl", formats: ["stl"], detail: "Varianten", size: 2.9, sizeLabel: "2,9 MB", date: "06.07.2026", source: "Modelle", favorite: false, model: "stand" },
  { id: 15, parentId: 3, kind: "file", name: "Vase-Variante-B.stl", format: "stl", formats: ["stl"], detail: "Varianten", size: 3.1, sizeLabel: "3,1 MB", date: "05.07.2026", source: "Modelle", favorite: false, model: "stand" },
  { id: 16, parentId: 1, kind: "file", name: "Etikettenhalter.stl", format: "stl", formats: ["stl"], detail: "Organizer-System", size: 0.8, sizeLabel: "0,8 MB", date: "04.07.2026", source: "Modelle", favorite: false, model: "clip" },
  { id: 17, parentId: 1, kind: "file", name: "Fachtrenner.stl", format: "stl", formats: ["stl"], detail: "Organizer-System", size: 1.6, sizeLabel: "1,6 MB", date: "03.07.2026", source: "Modelle", favorite: true, model: "layers" },
  { id: 18, parentId: 9, kind: "file", name: "Kleinteilefach.stl", format: "stl", formats: ["stl"], detail: "Schubladen", size: 2.2, sizeLabel: "2,2 MB", date: "02.07.2026", source: "Modelle", favorite: false, model: "tray" },
  { id: 19, parentId: 2, kind: "folder", name: "Frontplatten", format: "stl", formats: ["stl"], detail: "1 Datei", size: 1.7, sizeLabel: "1,7 MB", date: "01.07.2026", source: "Modelle", favorite: false, model: "bracket" },
  { id: 20, parentId: 3, kind: "folder", name: "Kleine Varianten", format: "stl", formats: ["stl"], detail: "1 Datei", size: 1.1, sizeLabel: "1,1 MB", date: "30.06.2026", source: "Modelle", favorite: false, model: "cube" },
  { id: 21, parentId: 19, kind: "file", name: "Displayblende.stl", format: "stl", formats: ["stl"], detail: "Frontplatten", size: 1.7, sizeLabel: "1,7 MB", date: "29.06.2026", source: "Modelle", favorite: false, model: "bracket" },
  { id: 22, parentId: 20, kind: "file", name: "Miniwürfel.stl", format: "stl", formats: ["stl"], detail: "Kleine Varianten", size: 1.1, sizeLabel: "1,1 MB", date: "28.06.2026", source: "Modelle", favorite: false, model: "cube" },
  { id: 23, parentId: 1, kind: "file", name: "Schraubenlehre.stl", format: "stl", formats: ["stl"], detail: "Organizer-System", size: 2.3, sizeLabel: "2,3 MB", date: "27.06.2026", source: "Modelle", favorite: false, model: "gear" }
];

const state = {
  direction: new URLSearchParams(location.search).get("direction") || "hybrid",
  theme: new URLSearchParams(location.search).get("theme") || "light",
  view: "grid",
  format: "all",
  favoritesOnly: false,
  query: "",
  sort: "name",
  folderId: null,
  selected: new Set(),
  page: 1,
  scenario: "normal",
  transientLoading: false,
  loadingTimer: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function modelSvg(type, large = false) {
  const paths = {
    tray: '<path d="M20 30h72l12 14-8 42H26l-10-42z"/><path d="M26 45h66M30 58h58M34 71h50"/>',
    bracket: '<path d="M24 86V28h62v18H46v40z"/><circle cx="35" cy="39" r="5"/><circle cx="35" cy="73" r="5"/><path d="M55 57h35"/>',
    stand: '<path d="M24 87h72M36 84l8-48h32l8 48M47 51h26M44 66h32"/><path d="M56 36v-9h9v9"/>',
    clip: '<path d="M82 34c-8-12-34-13-44 1-8 12-7 38 8 46 11 6 30 3 36-8"/><path d="M78 48c-8-10-27-8-30 4-3 11 8 20 20 15"/><path d="M80 27v54"/>',
    holder: '<path d="M22 82h78M30 79V42h18v37M53 79V27h18v52M76 79V50h17v29"/><path d="M27 42h24M50 27h24M73 50h23"/>',
    gear: '<path d="M55 19h12l3 10 9 4 9-5 8 9-6 8 3 10 10 4-1 12-11 2-5 9 4 10-10 7-7-8-10 1-5 10-12-3v-10l-8-6-10 3-6-10 8-7-1-10-10-5 4-11 11 1 6-8-3-10 10-6 7 8z"/><circle cx="61" cy="61" r="17"/>',
    cube: '<path d="M26 42l35-20 34 20v40L61 101 26 81z"/><path d="M26 42l35 20 34-20M61 62v39"/><path d="M39 49l34-20M49 55l34-20"/>',
    layers: '<path d="M20 38l41-20 42 20-42 20zM20 52l41 20 42-20M20 66l41 20 42-20M20 80l41 20 42-20"/>'
  };
  return `<svg class="model-svg ${large ? "is-large" : ""}" viewBox="0 0 122 122" aria-hidden="true"><g>${paths[type] || paths.cube}</g></svg>`;
}

function updateConcept() {
  const concept = concepts[state.direction];
  document.body.dataset.direction = state.direction;
  document.body.dataset.theme = state.theme;
  $("#conceptIndex").textContent = concept.index;
  $("#conceptEyebrow").textContent = concept.eyebrow;
  $("#conceptTitle").textContent = concept.title;
  $("#conceptDescription").textContent = concept.description;
  $("#conceptProperties").innerHTML = concept.properties.map(([term, description]) => `<div><dt>${term}</dt><dd>${description}</dd></div>`).join("");
  $$('[data-direction]').forEach(button => button.classList.toggle("on", button.dataset.direction === state.direction));
  $$('[data-theme]').forEach(button => button.classList.toggle("on", button.dataset.theme === state.theme));
  const params = new URLSearchParams({ direction: state.direction, theme: state.theme });
  history.replaceState(null, "", `${location.pathname}?${params}`);
}

function visibleAssets() {
  const items = assets.filter(asset => {
    if (state.favoritesOnly && !asset.favorite) return false;
    if (!state.favoritesOnly && state.folderId !== null && asset.parentId !== state.folderId) return false;
    if (state.format !== "all" && !asset.formats.includes(state.format)) return false;
    const searchable = `${asset.name} ${asset.detail} ${asset.source} ${asset.format}`.toLocaleLowerCase("de");
    return !state.query || searchable.includes(state.query);
  });
  return items.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
    if (state.sort === "date") return right.id - left.id;
    if (state.sort === "size") return right.size - left.size;
    return left.name.localeCompare(right.name, "de");
  });
}

function assetCard(asset) {
  const kind = asset.kind === "folder" ? "Ordner" : "Datei";
  const favoriteLabel = asset.favorite ? "Aus Favoriten entfernen" : "Als Favorit markieren";
  const selected = state.selected.has(asset.id);
  return `<article class="asset-card ${asset.kind} ${selected ? "selected" : ""}" data-asset-id="${asset.id}">
    <button class="asset-open" type="button" aria-label="${escapeHtml(asset.name)} öffnen">
      <div class="asset-preview">
        <span class="kind-chip">${kind}</span>
        <span class="format-chip">${asset.format.toUpperCase()}</span>
        ${modelSvg(asset.model)}
        <span class="layer-count" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>
      <div class="asset-content">
        <div class="asset-title"><div><small>${kind} · ${asset.format.toUpperCase()}</small><h4>${escapeHtml(asset.name)}</h4></div><span class="row-format">${asset.format.toUpperCase()}</span></div>
        <p>${escapeHtml(asset.detail)}</p>
        <dl><div><dt>Größe</dt><dd>${asset.sizeLabel}</dd></div><div><dt>Geändert</dt><dd>${asset.date}</dd></div><div><dt>Quelle</dt><dd>${escapeHtml(asset.source)}</dd></div></dl>
      </div>
    </button>
    <button class="favorite-star ${asset.favorite ? "on" : ""}" type="button" aria-label="${favoriteLabel}" aria-pressed="${asset.favorite}">${asset.favorite ? "★" : "☆"}</button>
    ${asset.kind === "file" ? `<label class="select-box" title="Für Slicer auswählen"><input type="checkbox" data-select-id="${asset.id}" aria-label="${escapeHtml(asset.name)} für Slicer auswählen" ${selected ? "checked" : ""}></label>` : ""}
  </article>`;
}

function currentFolder() {
  return assets.find(asset => asset.id === state.folderId && asset.kind === "folder") || null;
}

function folderChain() {
  const chain = [];
  let folder = currentFolder();
  while (folder) {
    chain.unshift(folder);
    folder = assets.find(asset => asset.id === folder.parentId && asset.kind === "folder") || null;
  }
  return chain;
}

function renderBreadcrumbs() {
  const breadcrumbs = $("#breadcrumbs");
  if (state.folderId === null || state.favoritesOnly) {
    breadcrumbs.hidden = true;
    breadcrumbs.innerHTML = "";
    return;
  }
  const chain = folderChain();
  breadcrumbs.hidden = false;
  breadcrumbs.innerHTML = `<button type="button" data-folder-id="root">Bibliothek</button>${chain.map((folder, index) => {
    const isLast = index === chain.length - 1;
    return `<span aria-hidden="true">›</span>${isLast ? `<strong>${escapeHtml(folder.name)}</strong>` : `<button type="button" data-folder-id="${folder.id}">${escapeHtml(folder.name)}</button>`}`;
  }).join("")}`;
}

function updateSelectionBar() {
  const selectedFiles = assets.filter(asset => state.selected.has(asset.id) && asset.kind === "file");
  const count = selectedFiles.length;
  $("#selectionBar").hidden = count === 0;
  $("#selectionCount").textContent = `${count} ${count === 1 ? "Datei ausgewählt" : "Dateien ausgewählt"}`;
}

function pageSize() {
  return state.view === "list" ? 4 : 8;
}

function renderPagination(total) {
  const footer = $("#resultFooter");
  const size = pageSize();
  const pages = Math.max(1, Math.ceil(total / size));
  state.page = Math.min(Math.max(1, state.page), pages);
  if (!total || state.scenario !== "normal" || state.transientLoading) {
    footer.hidden = true;
    return;
  }
  footer.hidden = false;
  const from = (state.page - 1) * size + 1;
  const to = Math.min(total, state.page * size);
  $("#resultRange").textContent = `${from}–${to} von ${total} Einträgen`;
  const pageButtons = Array.from({ length: pages }, (_, index) => index + 1)
    .map(page => `<button class="${page === state.page ? "current" : ""}" type="button" data-page="${page}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`)
    .join("");
  $("#paginationNav").innerHTML = `<button type="button" data-page="prev" ${state.page === 1 ? "disabled" : ""} aria-label="Vorherige Seite">←</button>${pageButtons}<button type="button" data-page="next" ${state.page === pages ? "disabled" : ""} aria-label="Nächste Seite">→</button>`;
}

function loadingMarkup() {
  const count = state.view === "list" ? 4 : 8;
  return Array.from({ length: count }, () => `<article class="asset-card skeleton-card" aria-hidden="true"><div class="asset-preview"><i></i></div><div class="asset-content"><b></b><span></span><small></small></div></article>`).join("");
}

function stateMessage(kind) {
  if (kind === "error") {
    return '<div class="empty-state error-state"><span>!</span><b>Ordner nicht erreichbar</b><p>Prüfe, ob das Laufwerk verbunden ist, oder entferne den Ordner aus der Bibliothek.</p><button class="tonal-button" type="button" data-open-settings>Bibliothek verwalten</button></div>';
  }
  return '<div class="empty-state"><span>⌕</span><b>Keine passenden Einträge</b><p>Ändere Suche oder Filter, um weitere Dateien zu sehen.</p><button class="text-button" type="button" data-reset-filters>Filter zurücksetzen</button></div>';
}

function updateNavigation() {
  const favoriteCount = assets.filter(asset => asset.favorite).length;
  $("#favoriteFilter small").textContent = String(favoriteCount);
  $("#sideFavoriteCount").textContent = String(favoriteCount);
  $("#favoriteFilter").classList.toggle("on", state.favoritesOnly);
  $("#favoriteFilter").setAttribute("aria-pressed", String(state.favoritesOnly));
  $("#favoriteFilter span").textContent = state.favoritesOnly ? "★" : "☆";
  $$('[data-nav]').forEach(button => button.classList.toggle("active", state.favoritesOnly ? button.dataset.nav === "favorites" : button.dataset.nav === "library"));
}

function renderAssets() {
  const items = visibleAssets();
  const folder = currentFolder();
  const isLoading = state.scenario === "loading" || state.transientLoading;
  const shownTotal = state.scenario === "empty" ? 0 : items.length;
  renderBreadcrumbs();
  $("#assetGrid").classList.toggle("list", state.view === "list");
  $("#assetGrid").classList.toggle("is-loading", isLoading);
  if (isLoading) {
    $("#assetGrid").innerHTML = loadingMarkup();
  } else if (state.scenario === "error") {
    $("#assetGrid").innerHTML = stateMessage("error");
  } else if (state.scenario === "empty" || !items.length) {
    $("#assetGrid").innerHTML = stateMessage("empty");
  } else {
    const size = pageSize();
    const pages = Math.max(1, Math.ceil(items.length / size));
    state.page = Math.min(state.page, pages);
    const pageItems = items.slice((state.page - 1) * size, state.page * size);
    $("#assetGrid").innerHTML = pageItems.map(assetCard).join("");
  }
  $("#sectionLabel").textContent = state.favoritesOnly ? "Favoriten" : folder ? "Ordner" : state.format === "all" ? "Bibliothek" : `${state.format.toUpperCase()}-Filter`;
  $("#sectionTitle").textContent = state.favoritesOnly ? "Favorisierte Ordner und Dateien" : folder ? folder.name : "Projekte und Dateien";
  const fileCount = items.filter(asset => asset.kind === "file").length;
  const folderCount = items.filter(asset => asset.kind === "folder").length;
  const filteredSummary = state.format !== "all" && !state.favoritesOnly && state.folderId === null
    ? `${fileCount} ${fileCount === 1 ? "Datei" : "Dateien"} · ${folderCount} ${folderCount === 1 ? "Ordner" : "Ordner"}`
    : `${shownTotal} ${shownTotal === 1 ? "Eintrag" : "Einträge"}`;
  $("#resultCount").textContent = isLoading ? "Vorschauen werden geladen" : state.scenario === "error" ? "Lesefehler" : state.scenario === "empty" ? "0 Einträge" : filteredSummary;
  $$('[data-format]').forEach(button => button.classList.toggle("active", button.dataset.format === state.format));
  $$('[data-view]').forEach(button => button.classList.toggle("on", button.dataset.view === state.view));
  updateNavigation();
  updateSelectionBar();
  renderPagination(shownTotal);
}

function startLoading(duration = 700) {
  clearTimeout(state.loadingTimer);
  state.transientLoading = true;
  renderAssets();
  state.loadingTimer = setTimeout(() => {
    state.transientLoading = false;
    renderAssets();
  }, duration);
}

function openFolder(asset) {
  state.folderId = asset.id;
  state.favoritesOnly = false;
  state.view = "list";
  state.page = 1;
  state.query = "";
  state.selected.clear();
  state.scenario = "normal";
  $("#searchInput").value = "";
  $("#scenarioSelect").value = "normal";
  renderAssets();
}

function openPreview(asset) {
  $("#previewKind").textContent = `${asset.kind === "folder" ? "Ordner" : "Datei"} · ${asset.format.toUpperCase()}`;
  $("#previewName").textContent = asset.name;
  $("#previewFormat").textContent = asset.format.toUpperCase();
  $("#previewSize").textContent = asset.sizeLabel;
  $("#previewDate").textContent = asset.date;
  $("#previewSource").textContent = asset.source;
  $("#largeModel").innerHTML = `${modelSvg(asset.model, true)}<span class="orbit one"></span><span class="orbit two"></span>`;
  $("#previewDialog").showModal();
}

$("#directionSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-direction]");
  if (!button) return;
  state.direction = button.dataset.direction;
  updateConcept();
});

$("#themeSwitch").addEventListener("click", event => {
  const button = event.target.closest("[data-theme]");
  if (!button) return;
  state.theme = button.dataset.theme;
  updateConcept();
});

$(".metrics").addEventListener("click", event => {
  const button = event.target.closest("[data-format]");
  if (!button) return;
  state.format = button.dataset.format;
  state.page = 1;
  startLoading(420);
});

$("#favoriteFilter").addEventListener("click", () => {
  state.favoritesOnly = !state.favoritesOnly;
  state.folderId = null;
  state.page = 1;
  state.selected.clear();
  renderAssets();
});

$(".side-nav nav").addEventListener("click", event => {
  const button = event.target.closest("[data-nav]");
  if (!button || button.dataset.nav === "recent") return;
  state.favoritesOnly = button.dataset.nav === "favorites";
  state.folderId = null;
  state.page = 1;
  state.selected.clear();
  renderAssets();
});

$(".view-switch").addEventListener("click", event => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
  state.page = 1;
  renderAssets();
});

$("#searchInput").addEventListener("input", event => {
  state.query = event.target.value.trim().toLocaleLowerCase("de");
  state.page = 1;
  renderAssets();
});

$("#sortSelect").addEventListener("change", event => {
  state.sort = event.target.value;
  state.page = 1;
  renderAssets();
});

$("#assetGrid").addEventListener("click", event => {
  const card = event.target.closest("[data-asset-id]");
  if (!card) return;
  const asset = assets.find(item => item.id === Number(card.dataset.assetId));
  if (!asset) return;
  if (event.target.closest(".favorite-star")) {
    asset.favorite = !asset.favorite;
    renderAssets();
    return;
  }
  if (event.target.closest(".select-box")) return;
  if (event.target.closest(".asset-open")) {
    if (asset.kind === "folder") openFolder(asset);
    else openPreview(asset);
  }
});

$("#assetGrid").addEventListener("change", event => {
  const input = event.target.closest("[data-select-id]");
  if (!input) return;
  const id = Number(input.dataset.selectId);
  if (input.checked) state.selected.add(id);
  else state.selected.delete(id);
  renderAssets();
});

$("#assetGrid").addEventListener("click", event => {
  if (event.target.closest("[data-open-settings]")) $("#settingsDialog").showModal();
  if (event.target.closest("[data-reset-filters]")) {
    state.format = "all";
    state.query = "";
    state.scenario = "normal";
    state.page = 1;
    $("#searchInput").value = "";
    $("#scenarioSelect").value = "normal";
    renderAssets();
  }
});

$("#breadcrumbs").addEventListener("click", event => {
  const button = event.target.closest("[data-folder-id]");
  if (!button) return;
  state.folderId = button.dataset.folderId === "root" ? null : Number(button.dataset.folderId);
  state.page = 1;
  state.selected.clear();
  renderAssets();
});

$("#paginationNav").addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled) return;
  const pages = Math.max(1, Math.ceil(visibleAssets().length / pageSize()));
  if (button.dataset.page === "prev") state.page -= 1;
  else if (button.dataset.page === "next") state.page += 1;
  else state.page = Number(button.dataset.page);
  state.page = Math.min(Math.max(1, state.page), pages);
  renderAssets();
  $("#assetGrid").scrollIntoView({ block: "nearest", behavior: "smooth" });
});

$("#clearSelection").addEventListener("click", () => {
  state.selected.clear();
  renderAssets();
});

$("#scenarioSelect").addEventListener("change", event => {
  state.scenario = event.target.value;
  state.transientLoading = false;
  clearTimeout(state.loadingTimer);
  state.page = 1;
  renderAssets();
});

$("#reloadLibrary").addEventListener("click", () => {
  state.scenario = "normal";
  $("#scenarioSelect").value = "normal";
  startLoading(900);
});

$("#manageLibrary").addEventListener("click", () => $("#settingsDialog").showModal());

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
    event.preventDefault();
    $("#searchInput").focus();
  }
});

$$('.prototype-dialog').forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
}));

if (!concepts[state.direction]) state.direction = "hybrid";
if (!["light", "dark"].includes(state.theme)) state.theme = "light";
updateConcept();
renderAssets();
