import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/quiet-material-tokens.css", import.meta.url), "utf8");

test("Quiet Material defines the selected light and dark semantic palette", () => {
  [
    "--qm-canvas: #171d1e",
    "--qm-surface: #202829",
    "--qm-primary: #9acbd0",
    "--qm-folder: #e1b477",
    "--qm-canvas: #edf1f1",
    "--qm-surface: #fbfcfb",
    "--qm-primary: #315f66",
    "--qm-folder: #94652b"
  ].forEach(token => assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

test("legacy component colors map to semantic Quiet Material roles", () => {
  assert.match(css, /--bg:\s*var\(--qm-canvas\)/);
  assert.match(css, /--panel:\s*var\(--qm-surface\)/);
  assert.match(css, /--mint:\s*var\(--qm-primary\)/);
  assert.match(css, /--orange:\s*var\(--qm-folder\)/);
  assert.match(css, /outline:\s*3px solid var\(--qm-focus\)/);
});

test("system light mode receives the same semantic role set", () => {
  const systemLight = css.match(/@media \(prefers-color-scheme: light\)[\s\S]*?:root:not\(\[data-theme\]\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || "";
  ["--qm-canvas", "--qm-surface", "--qm-primary", "--qm-folder", "--qm-focus"].forEach(token => {
    assert.ok(systemLight.includes(token), `${token} fehlt im System-Light-Modus`);
  });
});

test("quiet material shell uses stateful depth and a unified search control", () => {
  assert.match(css, /\.archive-mark\s*\{/);
  assert.match(css, /\.stat\.action\.on\s*\{/);
  assert.match(css, /\.search-control:focus-within\s*\{/);
  assert.match(css, /\.toolbar \.search-control input\s*\{/);
  assert.match(css, /@media \(max-width: 1120px\)[\s\S]*?\.stats\s*\{[\s\S]*?repeat\(3,/);
});

test("archive cards separate object type from selection and pagination state", () => {
  assert.match(css, /\.card\s*\{[\s\S]*?0 6px 0 -3px var\(--qm-outline\)/);
  assert.match(css, /\.library\.list \.card\s*\{[\s\S]*?box-shadow:\s*none/);
  assert.match(css, /\.file-card\.is-selected\s*\{[\s\S]*?var\(--qm-primary\)/);
  assert.match(css, /\.favorite-button:hover,[\s\S]*?var\(--qm-folder\)/);
  assert.match(css, /\.page-buttons button\.current\s*\{[\s\S]*?var\(--qm-primary\)/);
});
