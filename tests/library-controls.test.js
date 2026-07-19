import test from "node:test";
import assert from "node:assert/strict";
import { libraryControlState } from "../src/library-controls.js";

test("die Bibliotheksverwaltung bleibt während eines Scans erreichbar", () => {
  const controls = libraryControlState({ scanning: true, rootCount: 2, pendingRootCount: 2 });
  assert.equal(controls.manageDisabled, false);
  assert.equal(controls.refreshDisabled, true);
  assert.equal(controls.applyDisabled, true);
  assert.equal(controls.statusKey, "settings.statusScanning");
});

test("nach dem Scan lassen sich Änderungen wieder übernehmen", () => {
  const controls = libraryControlState({ scanning: false, rootCount: 2, pendingRootCount: 2 });
  assert.equal(controls.manageDisabled, false);
  assert.equal(controls.refreshDisabled, false);
  assert.equal(controls.applyDisabled, false);
  assert.equal(controls.statusKey, "settings.statusSelected");
  assert.deepEqual(controls.statusParams, { count: 2 });
});
