import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_MATERIAL_OPTIONS,
  PREVIEW_MODEL_COLOR,
  PREVIEW_MODEL_COLOR_CSS
} from "../src/preview-style.js";

test("preview models use one neutral near-white material", () => {
  assert.equal(PREVIEW_MODEL_COLOR, 0xf4f7f6);
  assert.equal(PREVIEW_MODEL_COLOR_CSS, "#f4f7f6");
  assert.deepEqual(PREVIEW_MATERIAL_OPTIONS, {
    color: PREVIEW_MODEL_COLOR,
    roughness: 0.68,
    metalness: 0.02
  });
});
