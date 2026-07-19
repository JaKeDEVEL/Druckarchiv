import test from "node:test";
import assert from "node:assert/strict";
import { canOpenModelCard } from "../src/model-card.js";

function card(attributes, file = "Modelle/halter.stl") {
  return {
    dataset: { file },
    hasAttribute: name => attributes.includes(name)
  };
}

test("eine Modellkarte öffnet auch bei einem wertlosen data-viewable-Attribut den Viewer", () => {
  assert.equal(canOpenModelCard(card(["data-viewable"])), true);
});

test("normale Dateikarten öffnen keinen 3D-Viewer", () => {
  assert.equal(canOpenModelCard(card([])), false);
  assert.equal(canOpenModelCard(card(["data-viewable"], "")), false);
});
