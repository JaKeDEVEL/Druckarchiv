import assert from "node:assert/strict";
import test from "node:test";
import {
  destinationContainsEntry,
  entryParentPath,
  libraryFolderOptions,
  managementEntryKey,
  mutationErrorKey,
  splitEntryName
} from "../src/library-mutations.js";

test("Dateien und Ordner erhalten getrennte stabile Auswahlschlüssel", () => {
  assert.notEqual(managementEntryKey("file", 0, "Projekt/Teil.stl"), managementEntryKey("folder", 0, "Projekt/Teil.stl"));
  assert.notEqual(managementEntryKey("file", 0, "Teil.stl"), managementEntryKey("file", 1, "Teil.stl"));
});

test("Dateiendungen bleiben beim Umbenennen getrennt und Ordnernamen vollständig", () => {
  assert.deepEqual(splitEntryName("Teil.v2.stl"), { base: "Teil.v2", extension: ".stl" });
  assert.deepEqual(splitEntryName("Projekt.v2", "folder"), { base: "Projekt.v2", extension: "" });
});

test("alle bekannten Bibliotheksordner werden als echte Ziele abgeleitet", () => {
  const options = libraryFolderOptions({
    roots: [{ name: "Archiv", available: true }, { name: "USB", available: false }],
    projects: [{ rootIndex: 0, name: "Projekt", files: [{ path: "Projekt/Teile/Arme/arm.stl" }] }]
  });

  assert.deepEqual(options.map(option => [option.rootIndex, option.relativePath]), [
    [0, ""],
    [0, "Projekt"],
    [0, "Projekt/Teile"],
    [0, "Projekt/Teile/Arme"]
  ]);
});

test("Ordner können nicht in sich selbst oder ihre Nachfahren verschoben werden", () => {
  const entry = { kind: "folder", rootIndex: 0, relativePath: "Projekt/Teile" };
  assert.equal(destinationContainsEntry({ rootIndex: 0, relativePath: "Projekt/Teile" }, entry), true);
  assert.equal(destinationContainsEntry({ rootIndex: 0, relativePath: "Projekt/Teile/Arme" }, entry), true);
  assert.equal(destinationContainsEntry({ rootIndex: 0, relativePath: "Projekt" }, entry), false);
  assert.equal(entryParentPath("Projekt/Teile/arm.stl"), "Projekt/Teile");
});

test("native Mutationsfehler werden auf lokalisierbare Meldungen begrenzt", () => {
  assert.equal(mutationErrorKey("mutation_collision"), "mutations.errors.collision");
  assert.equal(mutationErrorKey("ein interner absoluter Pfad"), "mutations.errors.failed");
});
