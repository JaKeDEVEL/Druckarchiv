import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createUpdateManifests } from "../scripts/create-update-manifest.mjs";

test("Update-Manifest verknüpft signierte Pakete für alle Desktop-Plattformen", async () => {
  const directory = await mkdtemp(join(tmpdir(), "druckarchiv-update-"));
  const nested = join(directory, "bundles");
  await mkdir(nested);
  const assets = [
    "Druckarchiv.app.tar.gz",
    "Druckarchiv_0.8.9_x64-setup.exe",
    "Druckarchiv_0.8.9_amd64.AppImage",
    "Druckarchiv_0.8.9_amd64.deb"
  ];
  for (const asset of assets) {
    await writeFile(join(nested, asset), "bundle");
    await writeFile(join(nested, `${asset}.sig`), `signature:${asset}`);
  }

  const manifests = await createUpdateManifests({
    assetsDirectory: directory,
    repository: "JaKeDEVEL/Druckarchiv",
    tag: "v0.8.9",
    version: "0.8.9",
    notes: "Signed updater",
    pubDate: "2026-07-20T00:00:00.000Z"
  });

  assert.equal(manifests["latest-app.json"].version, "0.8.9");
  assert.equal(manifests["latest-app.json"].platforms["darwin-aarch64"].url, manifests["latest-app.json"].platforms["darwin-x86_64"].url);
  assert.match(manifests["latest-nsis.json"].platforms["windows-x86_64"].signature, /x64-setup\.exe/);
  assert.match(manifests["latest-appimage.json"].platforms["linux-x86_64"].url, /\.AppImage$/);
  assert.match(manifests["latest-deb.json"].platforms["linux-x86_64"].url, /\.deb$/);
  await rm(directory, { recursive: true });
});

test("Update-Manifest bricht ohne Signatur ab", async () => {
  const directory = await mkdtemp(join(tmpdir(), "druckarchiv-update-missing-"));
  await writeFile(join(directory, "Druckarchiv.app.tar.gz"), "bundle");
  await assert.rejects(
    createUpdateManifests({ assetsDirectory: directory, repository: "JaKeDEVEL/Druckarchiv", tag: "v1.0.0", version: "1.0.0" }),
    /Signatur/
  );
  await rm(directory, { recursive: true });
});
