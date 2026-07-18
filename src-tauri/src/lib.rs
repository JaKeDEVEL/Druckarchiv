use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tauri::ipc::Response;

const MAX_FILES: usize = 200_000;
const MAX_MODEL_BYTES: u64 = 512 * 1024 * 1024;
const EXCLUDED_ROOT_DIRS: &[&str] = &["_uebersicht", "_druckarchiv_app"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileEntry {
    name: String,
    path: String,
    extension: String,
    size: u64,
    modified: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectEntry {
    name: String,
    display_name: String,
    files: Vec<FileEntry>,
    size: u64,
    modified: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveData {
    root: String,
    root_abs: String,
    projects: Vec<ProjectEntry>,
    loose: Vec<FileEntry>,
}

fn name_of(path: &Path) -> String {
    path.file_name().unwrap_or_default().to_string_lossy().into_owned()
}

fn is_hidden(path: &Path) -> bool {
    name_of(path).starts_with('.')
}

fn display_name(name: &str) -> String {
    name.replace(['_', '+'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn file_entry(path: &Path, root: &Path) -> Result<FileEntry, String> {
    let metadata = path.metadata().map_err(|error| format!("Metadaten fehlen: {error}"))?;
    let relative = path.strip_prefix(root).map_err(|_| "Ungültiger Dateipfad")?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |value| value.as_secs());
    Ok(FileEntry {
        name: name_of(path),
        path: relative.to_string_lossy().replace('\\', "/"),
        extension: path.extension().unwrap_or_default().to_string_lossy().to_lowercase(),
        size: metadata.len(),
        modified,
    })
}

fn collect_files(directory: &Path, root: &Path, found: &mut Vec<FileEntry>) -> Result<(), String> {
    let mut entries = fs::read_dir(directory)
        .map_err(|error| format!("{} kann nicht gelesen werden: {error}", directory.display()))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());

    for entry in entries {
        let path = entry.path();
        if is_hidden(&path) {
            continue;
        }
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_files(&path, root, found)?;
        } else if file_type.is_file() {
            if found.len() >= MAX_FILES {
                return Err(format!("Das Sicherheitslimit von {MAX_FILES} Dateien wurde erreicht."));
            }
            found.push(file_entry(&path, root)?);
        }
    }
    Ok(())
}

#[tauri::command]
fn scan_archive(root: String) -> Result<ArchiveData, String> {
    let root_path = PathBuf::from(root)
        .canonicalize()
        .map_err(|error| format!("Ordner nicht gefunden: {error}"))?;
    if !root_path.is_dir() {
        return Err("Der ausgewählte Pfad ist kein Ordner.".into());
    }

    let mut top_entries = fs::read_dir(&root_path)
        .map_err(|error| format!("Ordner kann nicht gelesen werden: {error}"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    top_entries.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());

    let mut projects = Vec::new();
    let mut loose = Vec::new();
    let mut total_files = 0usize;
    for entry in top_entries {
        let path = entry.path();
        let name = name_of(&path);
        if is_hidden(&path) || EXCLUDED_ROOT_DIRS.contains(&name.as_str()) {
            continue;
        }
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_file() {
            loose.push(file_entry(&path, &root_path)?);
            total_files += 1;
        } else if file_type.is_dir() {
            let mut files = Vec::new();
            collect_files(&path, &root_path, &mut files)?;
            total_files += files.len();
            if total_files > MAX_FILES {
                return Err(format!("Das Sicherheitslimit von {MAX_FILES} Dateien wurde erreicht."));
            }
            let size = files.iter().map(|file| file.size).sum();
            let modified = files.iter().map(|file| file.modified).max().unwrap_or(0);
            projects.push(ProjectEntry { display_name: display_name(&name), name, files, size, modified });
        }
    }

    Ok(ArchiveData {
        root: name_of(&root_path),
        root_abs: root_path.to_string_lossy().into_owned(),
        projects,
        loose,
    })
}

#[tauri::command]
fn read_model(root: String, relative_path: String) -> Result<Response, String> {
    let root_path = PathBuf::from(root).canonicalize().map_err(|error| error.to_string())?;
    let requested = root_path
        .join(relative_path)
        .canonicalize()
        .map_err(|error| format!("Datei nicht gefunden: {error}"))?;
    if !requested.starts_with(&root_path) || !requested.is_file() {
        return Err("Zugriff außerhalb des ausgewählten Archivs wurde blockiert.".into());
    }
    let extension = requested.extension().unwrap_or_default().to_string_lossy().to_lowercase();
    if !matches!(extension.as_str(), "stl" | "3mf") {
        return Err("Nur STL- und 3MF-Dateien dürfen in den Viewer geladen werden.".into());
    }
    let size = requested.metadata().map_err(|error| error.to_string())?.len();
    if size > MAX_MODEL_BYTES {
        return Err("Das Modell ist größer als 512 MB und wird aus Sicherheitsgründen nicht geladen.".into());
    }
    let bytes = fs::read(requested).map_err(|error| format!("Datei kann nicht gelesen werden: {error}"))?;
    Ok(Response::new(bytes))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_archive, read_model])
        .run(tauri::generate_context!())
        .expect("Druckarchiv konnte nicht gestartet werden");
}
