import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function updaterBundle(files, pattern, label) {
  const matches = files.filter(path => pattern.test(basename(path)) && !path.endsWith(".sig"));
  if (matches.length !== 1) throw new Error(`${label}: genau ein Update-Paket erwartet, ${matches.length} gefunden`);
  const bundle = matches[0];
  const signature = files.find(path => path === `${bundle}.sig` || basename(path) === `${basename(bundle)}.sig`);
  if (!signature) throw new Error(`${label}: Signatur für ${basename(bundle)} fehlt`);
  return { bundle, signature };
}

function assetUrl(repository, tag, path) {
  return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(basename(path))}`;
}

export async function createUpdateManifests({ assetsDirectory, repository, tag, version, notes = "", pubDate = new Date().toISOString() }) {
  const files = await filesBelow(assetsDirectory);
  const mac = updaterBundle(files, /\.app\.tar\.gz$/i, "macOS");
  const windows = updaterBundle(files, /-setup\.exe$/i, "Windows");
  const appImage = updaterBundle(files, /\.AppImage$/i, "Linux AppImage");
  const deb = updaterBundle(files, /\.deb$/i, "Linux Debian");

  const platform = async ({ bundle, signature }) => ({
    url: assetUrl(repository, tag, bundle),
    signature: (await readFile(signature, "utf8")).trim()
  });
  const base = {
    version: String(version).replace(/^v/, ""),
    notes: String(notes).trim(),
    pub_date: pubDate
  };
  const manifest = platforms => ({ ...base, platforms });
  const macPlatform = await platform(mac);
  const windowsPlatform = await platform(windows);
  const appImagePlatform = await platform(appImage);
  const debPlatform = await platform(deb);

  return {
    "latest-app.json": manifest({
      "darwin-aarch64": macPlatform,
      "darwin-x86_64": macPlatform
    }),
    "latest-nsis.json": manifest({ "windows-x86_64": windowsPlatform }),
    "latest-appimage.json": manifest({ "linux-x86_64": appImagePlatform }),
    "latest-deb.json": manifest({ "linux-x86_64": debPlatform })
  };
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const assetsDirectory = argument("assets");
  const repository = argument("repository");
  const tag = argument("tag");
  const version = argument("version") || tag;
  if (!assetsDirectory || !repository || !tag) throw new Error("--assets, --repository und --tag sind erforderlich");
  const manifests = await createUpdateManifests({
    assetsDirectory,
    repository,
    tag,
    version,
    notes: process.env.RELEASE_NOTES || ""
  });
  await Promise.all(Object.entries(manifests).map(([name, manifest]) =>
    writeFile(join(assetsDirectory, name), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  ));
}
