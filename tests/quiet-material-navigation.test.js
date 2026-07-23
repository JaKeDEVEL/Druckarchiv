import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/quiet-material-tokens.css", import.meta.url), "utf8");
const componentCss = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("the production shell contains the agreed sidebar and main breadcrumbs", () => {
  assert.match(index, /class="app-frame"/);
  assert.match(index, /class="side-nav"/);
  assert.match(index, /id="sideLibrary"/);
  assert.match(index, /id="sideFavorites"/);
  assert.match(index, /id="sideRootList"/);
  assert.match(index, /id="libraryBreadcrumb"/);
  assert.match(css, /\.app-frame\s*\{[\s\S]*?grid-template-columns:\s*232px/);
});

test("the native webview context menu stays disabled until the app provides its own actions", () => {
  assert.match(app, /document\.addEventListener\("contextmenu", event => event\.preventDefault\(\)\)/);
});

test("project cards navigate in place instead of opening the legacy project dialog", () => {
  assert.match(app, /setLibraryLocation\(projectLocation\(/);
  assert.match(app, /libraryProjectFolderCard/);
  assert.match(app, /locationBreadcrumbs/);
  assert.doesNotMatch(app, /projectDialog\.showModal\(\)/);
});

test("switching between folder and file results preserves the selected library source", () => {
  const modeSwitchHandler = app.match(/byId\("libraryModeSwitch"\)\.addEventListener[\s\S]*?\n\}\);/)?.[0] || "";
  assert.match(modeSwitchHandler, /state\.tab = button\.dataset\.libraryTab/);
  assert.doesNotMatch(modeSwitchHandler, /state\.libraryLocation = libraryLocation\(\)/);
});

test("files at the end of navigation keep using the model viewer popup", () => {
  assert.match(app, /else if \(canOpenModelCard\(card\)\)\s*\{[\s\S]*?openArchiveModel/);
  assert.match(app, /byId\("viewer"\)\.classList\.add\("open"\)/);
});

test("unavailable library folders stay visible without hiding available results", () => {
  assert.match(index, /id="librarySourceWarning"/);
  assert.match(index, /id="retryUnavailableRoots"/);
  assert.match(app, /unavailableLibraryRoots\(state\.archive\)/);
  assert.match(app, /source-offline-status/);
  assert.match(css, /\.library-source-warning\s*\{/);
  assert.match(css, /\.side-root-item\.is-unavailable/);
});

test("card controls keep selection, favorite, and object type permanently visible in that order", () => {
  const controls = app.match(/function cardCornerControls[\s\S]*?\n\}/)?.[0] || "";
  assert.match(controls, /return `<div class="card-corner-controls">\$\{managementSelectionControl\(entry\)\}\$\{favoriteControl\}\$\{cardKindFlag\(entry\.kind\)\}<\/div>`/);
  assert.match(componentCss, /\.card-corner-controls\{[^}]*display:flex/);
  assert.match(componentCss, /\.card-corner-controls \.entry-select,\.card-corner-controls \.favorite-button,\.card-corner-controls \.kind-flag\{[^}]*opacity:1/);
});
