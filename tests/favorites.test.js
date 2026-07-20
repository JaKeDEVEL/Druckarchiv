import assert from "node:assert/strict";
import test from "node:test";
import { compareFavoriteState, favoriteFileKey, favoriteFolderKey, folderPathsForFiles, normalizeFavoriteKeys } from "../src/favorites.js";

test("Favoritenschlüssel unterscheiden gleiche Dateipfade aus mehreren Bibliotheken", () => {
  const file = { path: "Figuren/Drache.3mf" };
  assert.notEqual(favoriteFileKey(file, "/Archiv A"), favoriteFileKey(file, "/Archiv B"));
  assert.equal(favoriteFileKey(file, "/Archiv A"), '["/Archiv A","Figuren/Drache.3mf"]');
});

test("Ordnerfavoriten sind von Dateien und gleichnamigen Ordnern anderer Bibliotheken getrennt", () => {
  assert.equal(favoriteFolderKey("/Archiv A", "/Figuren//Drachen/"), '["folder","/Archiv A","Figuren/Drachen"]');
  assert.notEqual(favoriteFolderKey("/Archiv A", "Figuren"), favoriteFileKey({ path: "Figuren" }, "/Archiv A"));
  assert.notEqual(favoriteFolderKey("/Archiv A", "Figuren"), favoriteFolderKey("/Archiv B", "Figuren"));
});

test("vorhandene Projekt- und Unterordner werden aus den Dateipfaden abgeleitet", () => {
  const files = [
    { path: "Drucker-Upgrades/Spulenhalter.stl" },
    { path: "Drucker-Upgrades/Varianten/Kompakt/Spulenhalter.3mf" },
    { path: "Anderes Projekt/Fremd.stl" }
  ];
  assert.deepEqual(folderPathsForFiles("Drucker-Upgrades", files), [
    "Drucker-Upgrades",
    "Drucker-Upgrades/Varianten",
    "Drucker-Upgrades/Varianten/Kompakt"
  ]);
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
