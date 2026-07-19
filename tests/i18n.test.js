import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOCALE,
  flattenedLocaleKeys,
  formatNumber,
  getLocale,
  localeResources,
  resolveLocale,
  setLocale,
  t
} from "../src/i18n.js";

test("System-Locale wird auf Deutsch oder Englisch aufgelöst", () => {
  assert.equal(resolveLocale("de-AT"), "de");
  assert.equal(resolveLocale(["fr-FR", "en-GB"]), "en");
  assert.equal(resolveLocale("fr-FR"), DEFAULT_LOCALE);
});

test("Deutsch und Englisch besitzen dieselben Übersetzungsschlüssel", () => {
  assert.deepEqual(flattenedLocaleKeys(localeResources.en), flattenedLocaleKeys(localeResources.de));
});

test("Interpolation, Pluralformen und Zahlen folgen der aktiven Sprache", () => {
  setLocale("en", { persist: false });
  assert.equal(getLocale(), "en");
  assert.equal(t("common.filesCount", { count: 1 }), "1 file");
  assert.equal(t("common.filesCount", { count: 4000 }), "4,000 files");
  assert.equal(formatNumber(4000), "4,000");

  setLocale("de", { persist: false });
  assert.equal(t("common.filesCount", { count: 1 }), "1 Datei");
  assert.equal(t("common.filesCount", { count: 4000 }), "4.000 Dateien");
});

test("fehlende Übersetzungen fallen auf den Schlüssel zurück", () => {
  assert.equal(t("missing.translation"), "missing.translation");
});
