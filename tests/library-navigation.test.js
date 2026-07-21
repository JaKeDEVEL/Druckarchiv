import assert from "node:assert/strict";
import test from "node:test";
import {
  folderLocation,
  isProjectLocation,
  libraryLocation,
  locationBreadcrumbs,
  projectLocation,
  sourceLocation
} from "../src/library-navigation.js";

const project = { displayName: "Werkstatt", name: "Werkstatt" };

test("library, source, project, and folder locations stay mutually exclusive", () => {
  assert.deepEqual(libraryLocation(), { projectIndex: null, path: "", rootIndex: null });
  assert.deepEqual(sourceLocation(2), { projectIndex: null, path: "", rootIndex: 2 });
  assert.deepEqual(projectLocation(3, "Varianten/Final"), { projectIndex: 3, path: "Varianten/Final", rootIndex: null });
  assert.deepEqual(folderLocation(projectLocation(3), "Varianten\\Final"), { projectIndex: 3, path: "Varianten/Final", rootIndex: null });
  assert.equal(isProjectLocation(sourceLocation(2)), false);
  assert.equal(isProjectLocation(projectLocation(3)), true);
});

test("main-window breadcrumbs lead from the library into nested folders", () => {
  assert.deepEqual(locationBreadcrumbs(project, "Varianten/Final", "Bibliothek"), [
    { name: "Bibliothek", path: null, kind: "library" },
    { name: "Werkstatt", path: "", kind: "folder" },
    { name: "Varianten", path: "Varianten", kind: "folder" },
    { name: "Final", path: "Varianten/Final", kind: "folder" }
  ]);
});
