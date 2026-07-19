const previewSvg = (kind, accent = "#52d7bd") => {
  const shapes = {
    organizer: '<path d="M82 64 210 31l128 34-128 34zM82 64v91l128 39 128-39V65M210 99v95M130 81v88M290 82v87"/><path d="m105 119 105 31 105-31"/>',
    gear: '<path d="m210 42 20 25 31-4 10 30 30 9-4 31 25 20-16 27 16 27-25 20 4 31-30 9-10 30-31-4-20 25-20-25-31 4-10-30-30-9 4-31-25-20 16-27-16-27 25-20-4-31 30-9 10-30 31 4z"/><circle cx="210" cy="180" r="58"/><circle cx="210" cy="180" r="18"/>',
    spool: '<ellipse cx="210" cy="81" rx="94" ry="38"/><path d="M116 81v112c0 21 42 38 94 38s94-17 94-38V81M147 98v80c0 14 28 25 63 25s63-11 63-25V98"/><ellipse cx="210" cy="81" rx="35" ry="14"/>',
    bracket: '<path d="M113 53h93v81h101v92H113z"/><path d="M147 87h26v81h100v25H147z"/><circle cx="160" cy="91" r="12"/><circle cx="265" cy="180" r="12"/>',
    clamp: '<path d="M110 68h200v47H170v44h115v97H110z"/><path d="M145 103v118h105v-27h-70v-91z"/><circle cx="276" cy="91" r="12"/><circle cx="145" cy="230" r="12"/>'
  };
  const shape = shapes[kind] || shapes.organizer;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 240"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#17272c"/><stop offset="1" stop-color="#091114"/></linearGradient><filter id="g"><feGaussianBlur stdDeviation="10"/></filter></defs><rect width="420" height="240" fill="url(#b)"/><path d="M0 40h420M0 100h420M0 160h420M0 220h420M60 0v240M140 0v240M220 0v240M300 0v240M380 0v240" stroke="#294047" stroke-width="1" opacity=".42"/><ellipse cx="210" cy="202" rx="125" ry="17" fill="${accent}" opacity=".16" filter="url(#g)"/><g transform="translate(0 -5)" fill="${accent}" fill-opacity=".13" stroke="${accent}" stroke-width="5" stroke-linejoin="round">${shape}</g><path d="M28 213h84" stroke="#ff9952" stroke-width="3"/><circle cx="28" cy="213" r="4" fill="#ff9952"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const previewByProject = [
  previewSvg("organizer"),
  previewSvg("gear", "#68a7de"),
  previewSvg("spool"),
  previewSvg("bracket", "#ff9952"),
  previewSvg("clamp"),
  previewSvg("gear", "#9f8ee8")
];

const formatSizes = { stl: 2_840_000, "3mf": 4_190_000, obj: 3_260_000, gcode: 748_000 };
const extensions = ["stl", "3mf", "obj", "gcode"];

function demoFile(rootIndex, projectName, baseName, extension, projectIndex, offset) {
  return {
    rootIndex,
    name: `${baseName}.${extension}`,
    path: `${projectName}/${baseName}.${extension}`,
    extension,
    size: formatSizes[extension] + projectIndex * 137_000 + offset * 41_000,
    modified: 1_784_323_200 - (projectIndex * 86_400 + offset * 3_600),
    demoPreview: ["stl", "3mf", "obj"].includes(extension) ? previewByProject[projectIndex] : null
  };
}

export function createDemoArchive() {
  const definitions = [
    [0, "Werkstatthelfer", "Kabelclip"],
    [0, "Organizer-System", "Schubladenmodul"],
    [0, "Drucker-Upgrades", "Spulenhalter"],
    [1, "Montagehilfen", "Winkelanschlag"],
    [1, "Prototypen", "Schnellspanner"],
    [1, "Ersatzteile", "Antriebsrad"]
  ];
  const projects = definitions.map(([rootIndex, name, baseName], projectIndex) => {
    const selectedExtensions = projectIndex % 2 ? extensions : ["stl", "3mf", "gcode"];
    const files = selectedExtensions.map((extension, offset) => demoFile(rootIndex, name, baseName, extension, projectIndex, offset));
    return {
      rootIndex,
      name,
      displayName: name,
      files,
      size: files.reduce((sum, file) => sum + file.size, 0),
      modified: Math.max(...files.map(file => file.modified))
    };
  });
  const loose = [
    demoFile(0, "", "Kalibrierwuerfel", "stl", 0, 5),
    demoFile(1, "", "PLA-Profil", "gcode", 1, 5)
  ].map(file => ({ ...file, path: file.name }));
  return {
    roots: [
      { name: "Modelle", path: "/Druckarchiv-Demo/Modelle" },
      { name: "Druckauftraege", path: "/Druckarchiv-Demo/Druckauftraege" }
    ],
    projects,
    loose
  };
}
