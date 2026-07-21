import { projectBreadcrumbs } from "./project-browser.js";

function normalizedIndex(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function normalizedPath(value) {
  return String(value || "").replace(/\\/g, "/").split("/").filter(Boolean).join("/");
}

export function libraryLocation() {
  return { projectIndex: null, path: "", rootIndex: null };
}

export function sourceLocation(rootIndex) {
  return { projectIndex: null, path: "", rootIndex: normalizedIndex(rootIndex) };
}

export function projectLocation(projectIndex, path = "") {
  return { projectIndex: normalizedIndex(projectIndex), path: normalizedPath(path), rootIndex: null };
}

export function folderLocation(location, path) {
  if (normalizedIndex(location?.projectIndex) === null) return libraryLocation();
  return projectLocation(location.projectIndex, path);
}

export function isProjectLocation(location) {
  return normalizedIndex(location?.projectIndex) !== null;
}

export function locationBreadcrumbs(project, path, libraryLabel) {
  if (!project) return [];
  return [
    { name: libraryLabel, path: null, kind: "library" },
    ...projectBreadcrumbs(project, normalizedPath(path)).map(crumb => ({ ...crumb, kind: "folder" }))
  ];
}
