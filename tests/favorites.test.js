import assert from "node:assert/strict";
import test from "node:test";
import { compareFavoriteState, favoriteFileKey, normalizeFavoriteKeys } from "../src/favorites.js";

test("Favoritenschlüssel unterscheiden gleiche Dateipfade aus mehreren Bibliotheken", () => {
  const file = { path: "Figuren/Drache.3mf" };
  assert.notEqual(favoriteFileKey(file, "/Archiv A"), favoriteFileKey(file, "/Archiv B"));
  assert.equal(favoriteFileKey(file, "/Archiv A"), '["/Archiv A","Figuren/Drache.3mf"]');
});

test("gespeicherte Favoriten werden sicher und eindeutig wiederhergestellt", () => {
  assert.deepEqual(normalizeFavoriteKeys(["a", "a", null, "b", 2]), ["a", "b"]);
  assert.deepEqual(normalizeFavoriteKeys(null), []);
});

test("Favoriten werden vor normalen Dateien einsortiert", () => {
  assert.ok(compareFavoriteState(true, false) < 0);
  assert.ok(compareFavoriteState(false, true) > 0);
  assert.equal(compareFavoriteState(true, true), 0);
});
