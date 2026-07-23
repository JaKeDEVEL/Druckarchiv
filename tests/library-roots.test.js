import assert from "node:assert/strict";
import test from "node:test";
import { isNestedLibraryRoot, mergeLibraryRoots, normalizeLibraryRoots, rootDisplayName } from "../src/library-roots.js";

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

test("kanonische Windows-Pfade werden als derselbe Ordner erkannt", () => {
  const result = mergeLibraryRoots(
    ["\\\\?\\C:\\Users\\Jana\\3D-Druck"],
    ["c:\\users\\jana\\3d-druck\\"]
  );

  assert.deepEqual(result.roots, ["\\\\?\\C:\\Users\\Jana\\3D-Druck"]);
  assert.deepEqual(result.skippedDuplicates, [{
    candidate: "c:\\users\\jana\\3d-druck\\",
    existing: "\\\\?\\C:\\Users\\Jana\\3D-Druck"
  }]);
});

test("Unterordner werden auch zwischen kanonischen und normalen Windows-Pfaden erkannt", () => {
  const driveResult = mergeLibraryRoots(
    ["\\\\?\\D:\\Druckarchiv"],
    ["D:\\Druckarchiv\\Modelle\\Figuren"]
  );
  const networkResult = mergeLibraryRoots(
    ["\\\\?\\UNC\\NAS\\Druckarchiv"],
    ["\\\\nas\\druckarchiv\\Modelle"]
  );

  assert.equal(driveResult.skippedNested.length, 1);
  assert.equal(networkResult.skippedNested.length, 1);
});

test("bereits gespeicherte gleichwertige Windows-Pfade werden beim Wiederherstellen bereinigt", () => {
  assert.deepEqual(normalizeLibraryRoots([
    "C:\\Users\\Jana\\3D-Druck",
    "\\\\?\\C:\\Users\\Jana\\3D-Druck\\"
  ]), ["C:\\Users\\Jana\\3D-Druck"]);
});

test("bereits gespeicherte Unterordner werden unabhängig von ihrer Reihenfolge bereinigt", () => {
  assert.deepEqual(normalizeLibraryRoots([
    "/Modelle/Figuren",
    "/Modelle",
    "/Modelle/Ersatzteile"
  ]), ["/Modelle"]);
});
