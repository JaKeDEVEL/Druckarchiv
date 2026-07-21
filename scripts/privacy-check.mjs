import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const ignoredDirectories = new Set([".git", "node_modules", "dist", "target", "gen"]);
const privateModelExtensions = new Set([".stl", ".3mf", ".gcode", ".bgcode", ".step", ".stp", ".f3d", ".fcstd"]);
const sensitiveNames = [/^\.env(?:\.|$)/i, /\.(?:p12|pfx|key|mobileprovision|provisionprofile|keystore)$/i, /^(?:inventory|thumb_map)\.json$/i];
const forbiddenContent = [
  { label: "macOS-Benutzerpfad", pattern: /\/Users\/[A-Za-z0-9._-]+\// },
  { label: "Windows-Benutzerpfad", pattern: /[A-Z]:\\Users\\[^\\\r\n]+\\/i },
  { label: "privater Schlüssel", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: "Tauri-Updater-Privatschlüssel", pattern: /untrusted comment:\s*minisign encrypted secret key/i },
  { label: "GitHub-Token", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/ }
];

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await walk(path);
    } else if (entry.isFile()) files.push(path);
  }
}
await walk(root);

const problems = [];
for (const path of files) {
  const local = relative(root, path);
  const name = local.split(/[\\/]/).pop();
  if (privateModelExtensions.has(extname(name).toLowerCase())) problems.push(`${local}: private Modelldatei`);
  if (sensitiveNames.some(pattern => pattern.test(name))) problems.push(`${local}: sensible Laufzeit- oder Schlüsseldatei`);
  const content = await readFile(path);
  if (content.includes(0)) continue;
  const text = content.toString("utf8");
  for (const rule of forbiddenContent) if (rule.pattern.test(text)) problems.push(`${local}: ${rule.label}`);
}

if (problems.length) {
  console.error("Datenschutzprüfung fehlgeschlagen:\n" + problems.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Datenschutzprüfung bestanden (${files.length} Quelldateien).`);
