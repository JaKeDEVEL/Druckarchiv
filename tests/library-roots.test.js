import assert from "node:assert/strict";
import test from "node:test";
import { isNestedLibraryRoot, mergeLibraryRoots, rootDisplayName } from "../src/library-roots.js";

test("ein bereits ausgewählter Ordner wird als Duplikat gemeldet", () => {
  const result = mergeLibraryRoots(["/Modelle"], ["/Modelle/"]);

  assert.deepEqual(result.roots, ["/Modelle"]);
  assert.deepEqual(result.skippedDuplicates, [{ candidate: "/Modelle/", existing: "/Modelle" }]);
  assert.deepEqual(result.skippedNested, []);
  assert.deepEqual(result.replacedNested, []);
});

test("ein bereits abgedeckter Unterordner wird mit seinem Hauptordner gemeldet", () => {
  const result = mergeLibraryRoots(["/Modelle"], ["/Modelle/Figuren"]);

  assert.deepEqual(result.roots, ["/Modelle"]);
  assert.deepEqual(result.skippedDuplicates, []);
  assert.deepEqual(result.skippedNested, [{ candidate: "/Modelle/Figuren", parent: "/Modelle" }]);
  assert.deepEqual(result.replacedNested, []);
});

test("ein nachträglich gewählter Hauptordner ersetzt abgedeckte Unterordner", () => {
  const result = mergeLibraryRoots(["/Modelle/Figuren", "/Modelle/Ersatzteile", "/GCode"], ["/Modelle"]);

  assert.deepEqual(result.roots, ["/GCode", "/Modelle"]);
  assert.deepEqual(result.replacedNested, [{
    parent: "/Modelle",
    children: ["/Modelle/Figuren", "/Modelle/Ersatzteile"]
  }]);
});

test("Pfadgrenzen und Windows-Schreibweisen werden korrekt unterschieden", () => {
  assert.equal(isNestedLibraryRoot("/Modelle-Alt", "/Modelle"), false);
  assert.equal(isNestedLibraryRoot("C:\\Modelle\\Figuren", "c:/modelle"), true);
  assert.equal(rootDisplayName("C:\\Modelle\\Figuren\\"), "Figuren");
});
