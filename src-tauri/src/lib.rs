use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tauri::ipc::Response;

const MAX_FILES: usize = 200_000;
const MAX_ROOTS: usize = 32;
const MAX_MODEL_BYTES: u64 = 512 * 1024 * 1024;
const EXCLUDED_ROOT_DIRS: &[&str] = &["_uebersicht", "_druckarchiv_app"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileEntry {
    root_index: usize,
    name: String,
    path: String,
    extension: String,
    size: u64,
    modified: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectEntry {
    root_index: usize,
    name: String,
    display_name: String,
    files: Vec<FileEntry>,
    size: u64,
    modified: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveData {
    roots: Vec<ArchiveRoot>,
    projects: Vec<ProjectEntry>,
    loose: Vec<FileEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveRoot {
    name: String,
    path: String,
}

fn name_of(path: &Path) -> String {
    path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned()
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

fn file_entry(path: &Path, root: &Path, root_index: usize) -> Result<FileEntry, String> {
    let metadata = path
        .metadata()
        .map_err(|error| format!("Metadaten fehlen: {error}"))?;
    let relative = path
        .strip_prefix(root)
        .map_err(|_| "Ungültiger Dateipfad")?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |value| value.as_secs());
    Ok(FileEntry {
        root_index,
        name: name_of(path),
        path: relative.to_string_lossy().replace('\\', "/"),
        extension: path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase(),
        size: metadata.len(),
        modified,
    })
}

fn collect_files(
    directory: &Path,
    root: &Path,
    root_index: usize,
    found: &mut Vec<FileEntry>,
) -> Result<(), String> {
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
            collect_files(&path, root, root_index, found)?;
        } else if file_type.is_file() {
            if found.len() >= MAX_FILES {
                return Err(format!(
                    "Das Sicherheitslimit von {MAX_FILES} Dateien wurde erreicht."
                ));
            }
            found.push(file_entry(&path, root, root_index)?);
        }
    }
    Ok(())
}

fn canonical_roots(roots: Vec<String>) -> Result<Vec<PathBuf>, String> {
    if roots.is_empty() {
        return Err("Wähle mindestens einen Bibliotheksordner aus.".into());
    }
    if roots.len() > MAX_ROOTS {
        return Err(format!(
            "Es können höchstens {MAX_ROOTS} Ordner gleichzeitig verwendet werden."
        ));
    }

    let mut unique = Vec::<PathBuf>::new();
    for root in roots {
        let path = PathBuf::from(root)
            .canonicalize()
            .map_err(|error| format!("Ordner nicht gefunden: {error}"))?;
        if !path.is_dir() {
            return Err(format!("{} ist kein Ordner.", path.display()));
        }
        if unique.iter().any(|parent| path.starts_with(parent)) {
            continue;
        }
        unique.retain(|child| !child.starts_with(&path));
        unique.push(path);
    }
    Ok(unique)
}

fn scan_root(
    root_path: &Path,
    root_index: usize,
    projects: &mut Vec<ProjectEntry>,
    loose: &mut Vec<FileEntry>,
    total_files: &mut usize,
) -> Result<(), String> {
    let mut top_entries = fs::read_dir(root_path)
        .map_err(|error| format!("Ordner kann nicht gelesen werden: {error}"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    top_entries.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());

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
            loose.push(file_entry(&path, root_path, root_index)?);
            *total_files += 1;
            if *total_files > MAX_FILES {
                return Err(format!(
                    "Das Sicherheitslimit von {MAX_FILES} Dateien wurde erreicht."
                ));
            }
        } else if file_type.is_dir() {
            let mut files = Vec::new();
            collect_files(&path, root_path, root_index, &mut files)?;
            *total_files += files.len();
            if *total_files > MAX_FILES {
                return Err(format!(
                    "Das Sicherheitslimit von {MAX_FILES} Dateien wurde erreicht."
                ));
            }
            let size = files.iter().map(|file| file.size).sum();
            let modified = files.iter().map(|file| file.modified).max().unwrap_or(0);
            projects.push(ProjectEntry {
                root_index,
                display_name: display_name(&name),
                name,
                files,
                size,
                modified,
            });
        }
    }

    Ok(())
}

#[tauri::command]
fn scan_archives(roots: Vec<String>) -> Result<ArchiveData, String> {
    let root_paths = canonical_roots(roots)?;
    let archive_roots = root_paths
        .iter()
        .map(|path| ArchiveRoot {
            name: name_of(path),
            path: path.to_string_lossy().into_owned(),
        })
        .collect::<Vec<_>>();
    let mut projects = Vec::new();
    let mut loose = Vec::new();
    let mut total_files = 0usize;
    for (root_index, root_path) in root_paths.iter().enumerate() {
        scan_root(
            root_path,
            root_index,
            &mut projects,
            &mut loose,
            &mut total_files,
        )?;
    }

    Ok(ArchiveData {
        roots: archive_roots,
        projects,
        loose,
    })
}

#[tauri::command]
fn read_model(root: String, relative_path: String) -> Result<Response, String> {
    let root_path = PathBuf::from(root)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let requested = root_path
        .join(relative_path)
        .canonicalize()
        .map_err(|error| format!("Datei nicht gefunden: {error}"))?;
    if !requested.starts_with(&root_path) || !requested.is_file() {
        return Err("Zugriff außerhalb des ausgewählten Archivs wurde blockiert.".into());
    }
    let extension = requested
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    if !matches!(extension.as_str(), "stl" | "3mf" | "obj") {
        return Err("Nur STL-, 3MF- und OBJ-Dateien dürfen in den Viewer geladen werden.".into());
    }
    let size = requested
        .metadata()
        .map_err(|error| error.to_string())?
        .len();
    if size > MAX_MODEL_BYTES {
        return Err(
            "Das Modell ist größer als 512 MB und wird aus Sicherheitsgründen nicht geladen."
                .into(),
        );
    }
    let bytes =
        fs::read(requested).map_err(|error| format!("Datei kann nicht gelesen werden: {error}"))?;
    Ok(Response::new(bytes))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_archives, read_model])
        .run(tauri::generate_context!())
        .expect("Druckarchiv konnte nicht gestartet werden");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_directory(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Systemzeit")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "druckarchiv-{label}-{}-{nonce}",
            std::process::id()
        ))
    }

    #[test]
    fn scans_multiple_roots_and_keeps_the_source_index() {
        let first = test_directory("first");
        let second = test_directory("second");
        fs::create_dir_all(first.join("Project_A")).expect("erster Projektordner");
        fs::create_dir_all(&second).expect("zweiter Archivordner");
        fs::write(
            first.join("Project_A").join("model.stl"),
            b"solid test\nendsolid test",
        )
        .expect("STL-Testdatei");
        fs::write(second.join("plate.3mf"), b"test").expect("3MF-Testdatei");

        let archive = scan_archives(vec![
            first.to_string_lossy().into_owned(),
            second.to_string_lossy().into_owned(),
        ])
        .expect("Mehrordner-Scan");

        assert_eq!(archive.roots.len(), 2);
        assert_eq!(archive.projects.len(), 1);
        assert_eq!(archive.projects[0].root_index, 0);
        assert_eq!(archive.projects[0].files[0].root_index, 0);
        assert_eq!(archive.loose.len(), 1);
        assert_eq!(archive.loose[0].root_index, 1);

        fs::remove_dir_all(first).expect("ersten Testordner entfernen");
        fs::remove_dir_all(second).expect("zweiten Testordner entfernen");
    }

    #[test]
    fn avoids_duplicate_scans_for_nested_roots() {
        let parent = test_directory("parent");
        let child = parent.join("child");
        fs::create_dir_all(&child).expect("verschachtelte Testordner");
        let canonical_parent = parent.canonicalize().expect("kanonischer Elternordner");

        let roots = canonical_roots(vec![
            child.to_string_lossy().into_owned(),
            parent.to_string_lossy().into_owned(),
        ])
        .expect("kanonische Ordner");

        assert_eq!(roots, vec![canonical_parent]);
        fs::remove_dir_all(parent).expect("Testordner entfernen");
    }
}
