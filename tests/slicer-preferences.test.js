import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SLICER,
  isSlicerCompatible,
  normalizeSlicer,
  slicerErrorKey,
  slicerLabel
} from "../src/slicer-preferences.js";

test("OrcaSlicer ist der sichere Standard und Bambu Studio bleibt auswählbar", () => {
  assert.equal(DEFAULT_SLICER, "orcaSlicer");
  assert.equal(normalizeSlicer(null), "orcaSlicer");
  assert.equal(normalizeSlicer("bambuStudio"), "bambuStudio");
  assert.equal(normalizeSlicer("custom-command"), "orcaSlicer");
  assert.equal(slicerLabel("bambuStudio"), "Bambu Studio");
});

test("nur von den Standard-Slicern unterstützte Druckdateien sind auswählbar", () => {
  for (const extension of ["stl", "3mf", "obj", "step", "gcode", "bgcode"]) {
    assert.equal(isSlicerCompatible(extension), true);
  }
  for (const extension of ["pdf", "png", "f3d", "fcstd", "zip"]) {
    assert.equal(isSlicerCompatible(extension), false);
  }
});

test("native Fehlercodes werden auf lokalisierbare Meldungen abgebildet", () => {
  assert.equal(slicerErrorKey("slicer_not_found"), "errors.slicerNotFound");
  assert.equal(slicerErrorKey("unsupported_file:pdf"), "errors.slicerUnsupportedFile");
  assert.equal(slicerErrorKey("unexpected"), "errors.slicerLaunchFailed");
});
