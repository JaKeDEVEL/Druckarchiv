import assert from "node:assert/strict";
import test from "node:test";
import { sourceBrowserEntries } from "../src/source-browser.js";

test("eine einzelne Datei direkt auf einem Bibliothekslaufwerk bleibt beim Öffnen sichtbar", () => {
  const file = {
    rootIndex: 0,
    name: "Einzelteil.stl",
    path: "Einzelteil.stl",
    extension: "stl",
    size: 42,
    modified: 100
  };
  const archive = {
    roots: [{ name: "USB-Stick", path: "/Volumes/USB-Stick" }],
    projects: [],
    loose: [file]
  };

  assert.deepEqual(sourceBrowserEntries(archive, 0), [{
    kind: "file",
    name: "Einzelteil.stl",
    rootIndex: 0,
    size: 42,
    modified: 100,
    file
  }]);
});

test("eine Bibliotheksquelle zeigt direkte Dateien und Projektordner gemeinsam", () => {
  const loose = { rootIndex: 1, name: "Kalibrierung.stl", size: 12, modified: 10 };
  const projectFile = { rootIndex: 1, name: "Bauteil.3mf", size: 20, modified: 30 };
  const archive = {
    projects: [{
      rootIndex: 1,
      name: "Projekt",
      displayName: "Projekt",
      files: [projectFile]
    }],
    loose: [loose, { rootIndex: 0, name: "Andere.stl", size: 9, modified: 5 }]
  };

  const entries = sourceBrowserEntries(archive, 1);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].kind, "folder");
  assert.equal(entries[0].project.name, "Projekt");
  assert.equal(entries[1].kind, "file");
  assert.equal(entries[1].file.name, "Kalibrierung.stl");
});

test("ausgeblendete Dateitypen erzeugen weder leere Projektordner noch direkte Treffer", () => {
  const archive = {
    projects: [{
      rootIndex: 0,
      name: "CAD",
      displayName: "CAD",
      files: [{ rootIndex: 0, name: "Quelle.step", extension: "step" }]
    }],
    loose: [{ rootIndex: 0, name: "Quelle.iges", extension: "iges" }]
  };

  assert.deepEqual(sourceBrowserEntries(archive, 0, file => file.extension === "stl"), []);
});
