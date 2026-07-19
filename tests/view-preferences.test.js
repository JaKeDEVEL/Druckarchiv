import test from "node:test";
import assert from "node:assert/strict";
import { normalizeViewMode, toggleViewMode } from "../src/view-preferences.js";

test("die Ordneransicht startet ohne gespeicherte Auswahl als Liste", () => {
  assert.equal(normalizeViewMode(null), "list");
  assert.equal(normalizeViewMode("invalid"), "list");
});

test("gespeicherte Listen- und Rasteransichten werden wiederhergestellt", () => {
  assert.equal(normalizeViewMode("list"), "list");
  assert.equal(normalizeViewMode("grid"), "grid");
});

test("die Ordneransicht wechselt zuverlässig zwischen Liste und Raster", () => {
  assert.equal(toggleViewMode("list"), "grid");
  assert.equal(toggleViewMode("grid"), "list");
});
