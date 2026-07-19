import test from "node:test";
import assert from "node:assert/strict";
import { defaultLibrarySettings } from "../src/library-settings.js";
import { selectedKpiExtensions } from "../src/kpi-settings.js";

test("standardmäßig erscheinen nur KPIs für aktivierte Druckformate", () => {
  assert.deepEqual(selectedKpiExtensions(defaultLibrarySettings()), {
    stl: ["stl"],
    m3f: ["3mf"],
    mesh: ["obj"],
    gcode: ["gcode"]
  });
});

test("optionale Dateitypen schalten ihre KPI-Gruppen sichtbar", () => {
  assert.deepEqual(selectedKpiExtensions({
    enabledExtensions: ["obj", "ply", "step", "png"],
    includeUnknown: false
  }), {
    mesh: ["obj", "ply"],
    cad: ["step"],
    other: ["png"]
  });
});

test("unbekannte Dateitypen halten die Sonstige-KPI sichtbar", () => {
  assert.deepEqual(selectedKpiExtensions({ enabledExtensions: [], includeUnknown: true }), { other: [] });
});
