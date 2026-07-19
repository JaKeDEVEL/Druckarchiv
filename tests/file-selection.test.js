import test from "node:test";
import assert from "node:assert/strict";
import { compatibleSelection, fileSelectionKey, selectionPayload } from "../src/file-selection.js";

const stl = { rootIndex: 0, path: "Modelle/Halter.stl", extension: "stl" };
const ply = { rootIndex: 1, path: "Scans/Teil.ply", extension: "ply" };
const index = new Map([[fileSelectionKey(stl), stl], [fileSelectionKey(ply), ply]]);

test("Dateiauswahlen bleiben über unabhängig gerenderte Seiten eindeutig", () => {
  const selection = new Set([fileSelectionKey(stl), fileSelectionKey(ply)]);
  assert.deepEqual(selectionPayload(selection, index), [
    { rootIndex: 0, relativePath: "Modelle/Halter.stl" },
    { rootIndex: 1, relativePath: "Scans/Teil.ply" }
  ]);
});

test("ein Slicerwechsel entfernt nur inkompatible oder verschwundene Dateien", () => {
  const selection = new Set([fileSelectionKey(stl), fileSelectionKey(ply), "9\nFehlt.stl"]);
  const compatible = compatibleSelection(selection, index, file => file.extension === "stl");
  assert.deepEqual([...compatible], [fileSelectionKey(stl)]);
});
