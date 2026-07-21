import test from "node:test";
import assert from "node:assert/strict";
import { createUpdateProgress, reduceUpdateProgress, updateProgressPercent } from "../src/update-progress.js";

test("Update-Fortschritt verarbeitet bekannte Downloadgrößen", () => {
  let progress = createUpdateProgress();
  progress = reduceUpdateProgress(progress, { event: "Started", data: { contentLength: 1000 } });
  progress = reduceUpdateProgress(progress, { event: "Progress", data: { chunkLength: 420 } });
  assert.equal(updateProgressPercent(progress), 42);
  progress = reduceUpdateProgress(progress, { event: "Finished" });
  assert.equal(updateProgressPercent(progress), 100);
});

test("Update-Fortschritt bleibt bei unbekannter Größe unbestimmt", () => {
  let progress = reduceUpdateProgress(createUpdateProgress(), { event: "Started", data: {} });
  progress = reduceUpdateProgress(progress, { event: "Progress", data: { chunkLength: 2048 } });
  assert.equal(progress.downloaded, 2048);
  assert.equal(updateProgressPercent(progress), null);
});
