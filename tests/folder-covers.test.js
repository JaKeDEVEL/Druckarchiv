import test from "node:test";
import assert from "node:assert/strict";
import {
  folderContents,
  folderCoverKey,
  normalizeFolderCoverPreference,
  normalizeFolderCoverPreferences,
  resolveFolderCover
} from "../src/folder-covers.js";

const project = { name: "Großes-Modell" };
const files = [
  { name: "notiz.txt", path: "Großes-Modell/notiz.txt", extension: "txt" },
  { name: "kopf.stl", path: "Großes-Modell/Teile/Kopf/kopf.stl", extension: "stl" },
  { name: "arm-a.stl", path: "Großes-Modell/Teile/Arme/arm-a.stl", extension: "stl" },
  { name: "arm-b.3mf", path: "Großes-Modell/Teile/Arme/arm-b.3mf", extension: "3mf" }
];
const isPreviewable = file => ["stl", "3mf", "obj"].includes(file.extension);

test("Strukturordner verwenden nie ein Modell aus tieferen Ebenen", () => {
  const root = resolveFolderCover({ project, allFiles: files, isPreviewable });
  const parts = resolveFolderCover({ project, folderPath: "Teile", allFiles: files, isPreviewable });

  assert.equal(root.kind, "icon");
  assert.deepEqual(root.childFolders, ["Teile"]);
  assert.equal(parts.kind, "icon");
  assert.deepEqual(parts.childFolders, ["Kopf", "Arme"]);
});

test("ein Endordner wählt nur aus direkt enthaltenen Dateien", () => {
  const contents = folderContents(project, files, "Teile/Arme");
  const cover = resolveFolderCover({ project, folderPath: "Teile/Arme", allFiles: files, isPreviewable });

  assert.equal(contents.isLeaf, true);
  assert.deepEqual(contents.directFiles.map(file => file.name), ["arm-a.stl", "arm-b.3mf"]);
  assert.equal(cover.kind, "model");
  assert.equal(cover.representative.name, "arm-a.stl");
});

test("Ordnersymbol und eigenes Cover überschreiben die Automatik im Endordner", () => {
  const icon = resolveFolderCover({ project, folderPath: "Teile/Arme", allFiles: files, preference: { mode: "icon" }, isPreviewable });
  const custom = resolveFolderCover({ project, folderPath: "Teile/Arme", allFiles: files, preference: { mode: "custom", image: "data:image/jpeg;base64,abc" }, isPreviewable });

  assert.equal(icon.kind, "icon");
  assert.equal(custom.kind, "custom");
  assert.equal(custom.image, "data:image/jpeg;base64,abc");
});

test("Strukturordner verwenden keine tieferen Modelle, können aber ein eigenes Cover erhalten", () => {
  const cover = resolveFolderCover({ project, folderPath: "Teile", allFiles: files, preference: { mode: "custom", image: "data:image/png;base64,abc" }, isPreviewable });
  assert.equal(cover.kind, "custom");
  assert.equal(cover.image, "data:image/png;base64,abc");
});

test("Cover-Schlüssel sind über Bibliotheksquellen hinweg eindeutig und Einstellungen werden bereinigt", () => {
  assert.notEqual(folderCoverKey("/Archiv A", "Projekt"), folderCoverKey("/Archiv B", "Projekt"));
  assert.deepEqual(normalizeFolderCoverPreference({ mode: "custom" }), { mode: "auto", image: "", fileName: "" });
  assert.deepEqual(normalizeFolderCoverPreferences({ bad: { mode: "unknown" }, good: { mode: "icon" } }), {
    good: { mode: "icon", image: "", fileName: "" }
  });
});
