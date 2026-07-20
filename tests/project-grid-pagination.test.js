import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PROJECT_GRID_PAGE_SIZE,
  projectGridPageCapacity
} from "../src/project-grid-pagination.js";

test("das Projektraster nutzt nur vollständig passende Karten", () => {
  assert.equal(projectGridPageCapacity(1080, 560), 10);
  assert.equal(projectGridPageCapacity(860, 380), 4);
  assert.equal(projectGridPageCapacity(700, 440), 4);
  assert.equal(projectGridPageCapacity(400, 440), 2);
});

test("nicht messbare Dialoge starten mit einer sicheren Rastergröße", () => {
  assert.equal(projectGridPageCapacity(0, 0), DEFAULT_PROJECT_GRID_PAGE_SIZE);
  assert.equal(projectGridPageCapacity(undefined, undefined), DEFAULT_PROJECT_GRID_PAGE_SIZE);
});
