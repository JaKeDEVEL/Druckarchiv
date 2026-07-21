import assert from "node:assert/strict";
import test from "node:test";
import {
  isLibraryRootAvailable,
  libraryRootConnectionType,
  unavailableLibraryConnectionType,
  unavailableLibraryRoots
} from "../src/library-availability.js";

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

test("typische externe Laufwerkspfade werden plattformübergreifend erkannt", () => {
  assert.equal(libraryRootConnectionType({ path: "/Volumes/Druckdaten/Modelle" }), "external");
  assert.equal(libraryRootConnectionType({ path: "/run/media/jana/USB/Modelle" }), "external");
  assert.equal(libraryRootConnectionType({ path: "E:\\Modelle" }), "external");
  assert.equal(libraryRootConnectionType({ path: "\\\\?\\F:\\Druckarchiv" }), "external");
});

test("Netzlaufwerke und gewöhnliche lokale Ordner bleiben unterscheidbar", () => {
  assert.equal(libraryRootConnectionType({ path: "\\\\server\\druckarchiv" }), "network");
  assert.equal(libraryRootConnectionType({ path: "\\\\?\\UNC\\server\\druckarchiv" }), "network");
  assert.equal(libraryRootConnectionType({ path: "/Druckarchiv-Test/Lokal" }), "folder");
  assert.equal(libraryRootConnectionType({ path: "C:\\Modelle" }), "folder");
});

test("eine gemeinsame Verbindungsart steuert den passenden Hinweis", () => {
  assert.equal(unavailableLibraryConnectionType([
    { path: "/Volumes/USB-A" },
    { path: "E:\\Modelle" }
  ]), "external");
  assert.equal(unavailableLibraryConnectionType([
    { path: "/Volumes/USB-A" },
    { path: "/Druckarchiv-Test/Fehlt" }
  ]), "folder");
});
