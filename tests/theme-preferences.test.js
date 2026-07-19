import test from "node:test";
import assert from "node:assert/strict";
import { normalizeThemePreference, resolveTheme, THEME_PREFERENCES } from "../src/theme-preferences.js";

test("der Systemstandard ist die sichere Vorgabe", () => {
  assert.equal(normalizeThemePreference(null), "system");
  assert.equal(normalizeThemePreference("invalid"), "system");
});

test("alle drei Darstellungen bleiben als gespeicherte Auswahl erhalten", () => {
  assert.deepEqual(THEME_PREFERENCES, ["system", "light", "dark"]);
  THEME_PREFERENCES.forEach(preference => assert.equal(normalizeThemePreference(preference), preference));
});

test("der Systemmodus folgt der aktuellen Betriebssystemdarstellung", () => {
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});
