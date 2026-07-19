import test from "node:test";
import assert from "node:assert/strict";
import { releaseViewerModel } from "../src/viewer-lifecycle.js";

test("beim Schließen wird das angezeigte Modell vollständig freigegeben", () => {
  const model = { name: "halter.stl" };
  const removed = [];
  const disposed = [];

  const result = releaseViewerModel({ remove: value => removed.push(value) }, model, value => disposed.push(value));

  assert.equal(result, null);
  assert.deepEqual(removed, [model]);
  assert.deepEqual(disposed, [model]);
});

test("ein leerer Viewer lässt sich ohne Nebenwirkungen schließen", () => {
  let changed = false;
  const result = releaseViewerModel({ remove: () => { changed = true; } }, null, () => { changed = true; });

  assert.equal(result, null);
  assert.equal(changed, false);
});
