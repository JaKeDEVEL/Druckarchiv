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
  { id: 1, kind: "folder", name: "Organizer-System", format: "stl", formats: ["stl", "3mf", "obj"], detail: "4 Dateien", size: 11.8, sizeLabel: "11,8 MB", date: "16.07.2026", source: "Modelle", favorite: true, model: "tray" },
  { id: 2, kind: "folder", name: "Drucker-Upgrades", format: "3mf", formats: ["stl", "3mf", "gcode"], detail: "3 Dateien", size: 8.7, sizeLabel: "8,7 MB", date: "15.07.2026", source: "Modelle", favorite: false, model: "bracket" },
  { id: 3, kind: "folder", name: "Varianten", format: "stl", formats: ["stl", "3mf"], detail: "2 Dateien", size: 7.6, sizeLabel: "7,6 MB", date: "15.07.2026", source: "Modelle", favorite: true, model: "stand" },
  { id: 4, kind: "file", name: "Kabelclip.3mf", format: "3mf", formats: ["3mf"], detail: "Werkstatthelfer", size: 4.2, sizeLabel: "4,2 MB", date: "Heute, 08:17", source: "Modelle", favorite: true, model: "clip" },
  { id: 5, kind: "file", name: "Werkzeughalter.stl", format: "stl", formats: ["stl"], detail: "Organizer-System", size: 3.8, sizeLabel: "3,8 MB", date: "Gestern", source: "Modelle", favorite: false, model: "holder" },
  { id: 6, kind: "file", name: "Ersatzrad.obj", format: "obj", formats: ["obj"], detail: "Drucker-Upgrades", size: 2.1, sizeLabel: "2,1 MB", date: "14.07.2026", source: "Modelle", favorite: false, model: "gear" },
  { id: 7, kind: "file", name: "Kalibrierwürfel.stl", format: "stl", formats: ["stl"], detail: "Testdrucke", size: 1.4, sizeLabel: "1,4 MB", date: "12.07.2026", source: "Modelle", favorite: true, model: "cube" },
  { id: 8, kind: "file", name: "Organizer-Platte.gcode", format: "gcode", formats: ["gcode"], detail: "Organizer-System", size: 6.3, sizeLabel: "6,3 MB", date: "11.07.2026", source: "Druckaufträge", favorite: false, model: "layers" }
];

const state = {
  direction: new URLSearchParams(location.search).get("direction") || "hybrid",
  theme: new URLSearchParams(location.search).get("theme") || "light",
  view: "grid",
  format: "all",
  favoritesOnly: false,
  query: "",
  sort: "name"
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
    if (state.format !== "all" && !asset.formats.includes(state.format)) return false;
    const searchable = `${asset.name} ${asset.detail} ${asset.source} ${asset.format}`.toLocaleLowerCase("de");
    return !state.query || searchable.includes(state.query);
  });
  return items.sort((left, right) => {
    if (state.sort === "date") return right.id - left.id;
    if (state.sort === "size") return right.size - left.size;
    return left.name.localeCompare(right.name, "de");
  });
}

function assetCard(asset) {
  const kind = asset.kind === "folder" ? "Ordner" : "Datei";
  const favoriteLabel = asset.favorite ? "Aus Favoriten entfernen" : "Als Favorit markieren";
  return `<article class="asset-card ${asset.kind}" data-asset-id="${asset.id}">
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
    ${asset.kind === "file" ? '<label class="select-box" title="Für Slicer auswählen"><input type="checkbox" aria-label="Für Slicer auswählen"></label>' : ""}
  </article>`;
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
  $("#assetGrid").classList.toggle("list", state.view === "list");
  $("#assetGrid").innerHTML = items.length
    ? items.map(assetCard).join("")
    : '<div class="empty-state"><span>⌕</span><b>Keine passenden Einträge</b><p>Ändere Suche oder Filter, um weitere Dateien zu sehen.</p></div>';
  $("#sectionLabel").textContent = state.favoritesOnly ? "Favoriten" : state.format === "all" ? "Bibliothek" : `${state.format.toUpperCase()}-Filter`;
  $("#sectionTitle").textContent = state.favoritesOnly ? "Favorisierte Ordner und Dateien" : "Projekte und Dateien";
  $("#resultCount").textContent = `${items.length} ${items.length === 1 ? "Eintrag" : "Einträge"}`;
  $$('[data-format]').forEach(button => button.classList.toggle("active", button.dataset.format === state.format));
  $$('[data-view]').forEach(button => button.classList.toggle("on", button.dataset.view === state.view));
  updateNavigation();
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
  renderAssets();
});

$("#favoriteFilter").addEventListener("click", () => {
  state.favoritesOnly = !state.favoritesOnly;
  renderAssets();
});

$(".side-nav nav").addEventListener("click", event => {
  const button = event.target.closest("[data-nav]");
  if (!button || button.dataset.nav === "recent") return;
  state.favoritesOnly = button.dataset.nav === "favorites";
  renderAssets();
});

$(".view-switch").addEventListener("click", event => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
  renderAssets();
});

$("#searchInput").addEventListener("input", event => {
  state.query = event.target.value.trim().toLocaleLowerCase("de");
  renderAssets();
});

$("#sortSelect").addEventListener("change", event => {
  state.sort = event.target.value;
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
  if (event.target.closest(".asset-open")) openPreview(asset);
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

if (!concepts[state.direction]) state.direction = "workshop";
if (!["light", "dark"].includes(state.theme)) state.theme = "light";
updateConcept();
renderAssets();
