import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultLibrarySettings,
  isFileVisible,
  normalizeLibrarySettings,
  splitExtensionRules,
  splitFileRules
} from "../src/library-settings.js";

const file = (name, path = name) => ({ name, path, extension: name.split(".").pop().toLowerCase() });

test("druckrelevante Formate sind standardmäßig sichtbar", () => {
  const settings = defaultLibrarySettings();
  assert.equal(isFileVisible(file("halter.stl"), settings), true);
  assert.equal(isFileVisible(file("halter.obj"), settings), true);
  assert.equal(isFileVisible(file("notizen.docx"), settings), false);
});

test("ein expliziter Endungsausschluss hat Vorrang", () => {
  const settings = normalizeLibrarySettings({
    enabledExtensions: ["stl", "3mf"],
    excludedExtensions: [".STL"]
  });
  assert.equal(isFileVisible(file("halter.stl"), settings), false);
  assert.equal(isFileVisible(file("halter.3mf"), settings), true);
});

test("Dateiregeln unterstützen Namen, Pfade und Platzhalter", () => {
  const settings = normalizeLibrarySettings({
    enabledExtensions: ["stl", "obj"],
    excludedFiles: splitFileRules("README*\nEntwürfe/*.obj\ndefekt?.stl")
  });
  assert.equal(isFileVisible(file("README-old.stl"), settings), false);
  assert.equal(isFileVisible(file("test.obj", "Entwürfe/test.obj"), settings), false);
  assert.equal(isFileVisible(file("defekt1.stl"), settings), false);
  assert.equal(isFileVisible(file("final.stl"), settings), true);
});

test("Endungslisten werden tolerant und eindeutig eingelesen", () => {
  assert.deepEqual(splitExtensionRules(".PDF, *.zip; pdf  BAK"), ["pdf", "zip", "bak"]);
});

test("unbekannte Endungen lassen sich gesammelt aktivieren", () => {
  const settings = normalizeLibrarySettings({ enabledExtensions: [], includeUnknown: true });
  assert.equal(isFileVisible(file("materialliste.xlsx"), settings), true);
  assert.equal(isFileVisible(file("modell.stl"), settings), false);
});
