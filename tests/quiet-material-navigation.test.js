import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/quiet-material-tokens.css", import.meta.url), "utf8");

test("the production shell contains the agreed sidebar and main breadcrumbs", () => {
  assert.match(index, /class="app-frame"/);
  assert.match(index, /class="side-nav"/);
  assert.match(index, /id="sideLibrary"/);
  assert.match(index, /id="sideFavorites"/);
  assert.match(index, /id="sideRootList"/);
  assert.match(index, /id="libraryBreadcrumb"/);
  assert.match(css, /\.app-frame\s*\{[\s\S]*?grid-template-columns:\s*232px/);
});

test("project cards navigate in place instead of opening the legacy project dialog", () => {
  assert.match(app, /setLibraryLocation\(projectLocation\(/);
  assert.match(app, /libraryProjectFolderCard/);
  assert.match(app, /locationBreadcrumbs/);
  assert.doesNotMatch(app, /projectDialog\.showModal\(\)/);
});

test("files at the end of navigation keep using the model viewer popup", () => {
  assert.match(app, /else if \(canOpenModelCard\(card\)\)\s*\{[\s\S]*?openArchiveModel/);
  assert.match(app, /byId\("viewer"\)\.classList\.add\("open"\)/);
});
