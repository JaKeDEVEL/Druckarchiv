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
