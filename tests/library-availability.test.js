import assert from "node:assert/strict";
import test from "node:test";
import { isLibraryRootAvailable, unavailableLibraryRoots } from "../src/library-availability.js";

test("ältere und verfügbare Bibliotheksordner bleiben nutzbar", () => {
  assert.equal(isLibraryRootAvailable({ path: "/Modelle" }), true);
  assert.equal(isLibraryRootAvailable({ path: "/Modelle", available: true }), true);
});

test("nicht erreichbare Bibliotheksordner werden getrennt ausgewiesen", () => {
  const archive = {
    roots: [
      { name: "USB", path: "/Volumes/USB", available: false },
      { name: "Lokal", path: "/Druckarchiv-Test/Lokal", available: true }
    ]
  };

  assert.deepEqual(unavailableLibraryRoots(archive), [archive.roots[0]]);
});
