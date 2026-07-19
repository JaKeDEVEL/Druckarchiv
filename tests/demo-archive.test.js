import test from "node:test";
import assert from "node:assert/strict";
import { createDemoArchive } from "../src/demo-archive.js";

test("Screenshot-Demo enthält ausschließlich synthetische Pfade und Vorschaubilder", () => {
  const archive = createDemoArchive();
  const files = [...archive.loose, ...archive.projects.flatMap(project => project.files)];
  assert.ok(archive.roots.every(root => root.path.startsWith("/Druckarchiv-Demo/")));
  assert.ok(files.length >= 20);
  assert.ok(files.filter(file => ["stl", "3mf", "obj"].includes(file.extension)).every(file => file.demoPreview?.startsWith("data:image/svg+xml")));
  assert.equal(JSON.stringify(archive).includes("janos"), false);
});

test("die Lasttest-Demo kann 4.000 sichere Dateien bereitstellen", () => {
  const archive = createDemoArchive(4000);
  const files = [...archive.loose, ...archive.projects.flatMap(project => project.files)];

  assert.equal(files.length, 4000);
  assert.match(archive.loose.at(-1).path, /^Lasttest\/Demo-Modell-/);
  assert.doesNotMatch(JSON.stringify(archive), /Users|janos/i);
});
