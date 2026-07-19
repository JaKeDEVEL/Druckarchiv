import test from "node:test";
import assert from "node:assert/strict";
import { normalizePageSize, paginateEntries, paginationTokens } from "../src/pagination.js";

test("große Bibliotheken werden auf höchstens 25 Einträge begrenzt", () => {
  const entries = Array.from({ length: 4000 }, (_, index) => index + 1);
  const result = paginateEntries(entries, 1, 25);

  assert.equal(result.items.length, 25);
  assert.equal(result.totalPages, 160);
  assert.equal(result.start, 0);
  assert.equal(result.end, 25);
});

test("50er-Seiten und die letzte unvollständige Seite werden korrekt berechnet", () => {
  const entries = Array.from({ length: 123 }, (_, index) => index + 1);
  const result = paginateEntries(entries, 3, 50);

  assert.deepEqual(result.items, entries.slice(100));
  assert.equal(result.start, 100);
  assert.equal(result.end, 123);
  assert.equal(result.totalPages, 3);
});

test("ungültige Seitengrößen und Seitenzahlen werden sicher begrenzt", () => {
  assert.equal(normalizePageSize(500), 25);
  assert.equal(paginateEntries([1, 2, 3], 99, 25).page, 1);
  assert.equal(paginateEntries([], -4, 50).page, 1);
});

test("die Seitennavigation zeigt bei vielen Seiten nur den relevanten Ausschnitt", () => {
  assert.deepEqual(paginationTokens(1, 160), [1, 2, "ellipsis", 160]);
  assert.deepEqual(paginationTokens(80, 160), [1, "ellipsis", 79, 80, 81, "ellipsis", 160]);
  assert.deepEqual(paginationTokens(160, 160), [1, "ellipsis", 159, 160]);
});
