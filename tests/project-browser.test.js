import test from "node:test";
import assert from "node:assert/strict";
import { projectBreadcrumbs, projectBrowserEntries, projectRelativeFilePath } from "../src/project-browser.js";

const project = { name: "Drucker-Upgrades", displayName: "Drucker Upgrades" };
const files = [
  { name: "README.txt", path: "Drucker-Upgrades/README.txt", size: 5, modified: 10 },
  { name: "halter.stl", path: "Drucker-Upgrades/Varianten/halter.stl", size: 20, modified: 20 },
  { name: "halter-klein.stl", path: "Drucker-Upgrades/Varianten/Klein/halter-klein.stl", size: 30, modified: 30 },
  { name: "profil.gcode", path: "Drucker-Upgrades/Druckauftraege/profil.gcode", size: 40, modified: 15 }
];

test("die Projektwurzel zeigt direkte Dateien und unmittelbare Unterordner", () => {
  const entries = projectBrowserEntries(project, files);

  assert.deepEqual(entries.map(entry => [entry.kind, entry.name]), [
    ["folder", "Varianten"],
    ["folder", "Druckauftraege"],
    ["file", "README.txt"]
  ]);
  assert.equal(entries[0].files.length, 2);
  assert.equal(entries[0].size, 50);
  assert.equal(entries[0].modified, 30);
});

test("ein geöffneter Unterordner zeigt nur seine direkten Inhalte", () => {
  const entries = projectBrowserEntries(project, files, "Varianten");

  assert.deepEqual(entries.map(entry => [entry.kind, entry.name]), [
    ["folder", "Klein"],
    ["file", "halter.stl"]
  ]);
  assert.equal(projectBrowserEntries(project, files, "Varianten/Klein")[0].file.name, "halter-klein.stl");
});

test("Projektpfade und Brotkrumen bleiben relativ und navigierbar", () => {
  assert.equal(projectRelativeFilePath(project, files[1]), "Varianten/halter.stl");
  assert.deepEqual(projectBreadcrumbs(project, "Varianten/Klein"), [
    { name: "Drucker Upgrades", path: "" },
    { name: "Varianten", path: "Varianten" },
    { name: "Klein", path: "Varianten/Klein" }
  ]);
});
