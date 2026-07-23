use serde::{Deserialize, Serialize};
#[cfg(target_os = "windows")]
use std::env;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
use std::process::Command;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::UNIX_EPOCH,
};
use tauri::ipc::Response;

const MAX_FILES: usize = 200_000;
const MAX_ROOTS: usize = 32;
const MAX_MODEL_BYTES: u64 = 512 * 1024 * 1024;
const MAX_COVER_IMAGE_BYTES: u64 = 16 * 1024 * 1024;
const MAX_SLICER_FILES: usize = 100;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
const EXCLUDED_ROOT_DIRS: &[&str] = &["_uebersicht", "_druckarchiv_app"];
const SLICER_EXTENSIONS: &[&str] = &[
    "stl", "3mf", "obj", "step", "stp", "amf", "ply", "gcode", "bgcode",
];
const PRUSA_SLICER_EXTENSIONS: &[&str] =
    &["stl", "3mf", "obj", "step", "stp", "amf", "gcode", "bgcode"];

#[derive(Default)]
struct AppState {
    roots: Mutex<Vec<PathBuf>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SlicerKind {
    OrcaSlicer,
    BambuStudio,
    PrusaSlicer,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SlicerFileRequest {
    root_index: usize,
    relative_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LibraryEntryRequest {
    root_index: usize,
    relative_path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LibraryFolderRequest {
    root_index: usize,
    relative_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MutationResult {
    root_index: usize,
    relative_path: String,
}

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
    available: bool,
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

#[cfg(test)]
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

#[cfg(test)]
fn scan_root_paths(root_paths: &[PathBuf]) -> Result<ArchiveData, String> {
    let archive_roots = root_paths
        .iter()
        .map(|path| ArchiveRoot {
            name: name_of(path),
            path: path.to_string_lossy().into_owned(),
            available: true,
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

fn scan_configured_roots(roots: Vec<String>) -> Result<(ArchiveData, Vec<PathBuf>), String> {
    if roots.is_empty() {
        return Err("Wähle mindestens einen Bibliotheksordner aus.".into());
    }
    if roots.len() > MAX_ROOTS {
        return Err(format!(
            "Es können höchstens {MAX_ROOTS} Ordner gleichzeitig verwendet werden."
        ));
    }

    struct PreparedRoot {
        configured: String,
        configured_path: PathBuf,
        resolved_path: Option<PathBuf>,
        comparable: String,
    }

    fn comparable_root(path: &Path) -> String {
        let mut value = path.to_string_lossy().replace('\\', "/");
        if value.to_ascii_lowercase().starts_with("//?/unc/") {
            value = format!("//{}", &value[8..]);
        } else if value.starts_with("//?/") || value.starts_with("//./") {
            value = value[4..].to_owned();
        }
        while value.contains("//") {
            value = value.replace("//", "/");
        }
        if value.len() > 1 {
            value = value.trim_end_matches('/').to_owned();
        }
        #[cfg(target_os = "windows")]
        {
            value = value.to_lowercase();
        }
        value
    }

    fn nested_root(candidate: &str, parent: &str) -> bool {
        candidate != parent
            && if parent == "/" {
                candidate.starts_with('/')
            } else {
                candidate.starts_with(&format!("{parent}/"))
            }
    }

    let mut prepared = Vec::<PreparedRoot>::new();
    for configured in roots {
        let configured_path = PathBuf::from(&configured);
        let resolved_path = configured_path
            .canonicalize()
            .ok()
            .filter(|path| path.is_dir());
        let comparable = comparable_root(resolved_path.as_deref().unwrap_or(&configured_path));

        if prepared.iter().any(|root| root.comparable == comparable) {
            continue;
        }
        if prepared
            .iter()
            .any(|root| nested_root(&comparable, &root.comparable))
        {
            continue;
        }
        prepared.retain(|root| !nested_root(&root.comparable, &comparable));
        prepared.push(PreparedRoot {
            configured,
            configured_path,
            resolved_path,
            comparable,
        });
    }

    let mut archive = ArchiveData {
        roots: Vec::with_capacity(prepared.len()),
        projects: Vec::new(),
        loose: Vec::new(),
    };
    let mut root_paths = Vec::with_capacity(prepared.len());
    let mut total_files = 0usize;

    for prepared_root in prepared {
        let root_path = prepared_root
            .resolved_path
            .as_ref()
            .unwrap_or(&prepared_root.configured_path);
        let name = {
            let folder_name = name_of(root_path);
            if folder_name.is_empty() {
                prepared_root.configured.clone()
            } else {
                folder_name
            }
        };
        let root_index = archive.roots.len();
        archive.roots.push(ArchiveRoot {
            name,
            path: root_path.to_string_lossy().into_owned(),
            available: prepared_root.resolved_path.is_some(),
        });
        root_paths.push(root_path.to_path_buf());

        let Some(resolved_path) = prepared_root.resolved_path else {
            continue;
        };

        let projects_before = archive.projects.len();
        let loose_before = archive.loose.len();
        let total_before = total_files;
        if scan_root(
            &resolved_path,
            root_index,
            &mut archive.projects,
            &mut archive.loose,
            &mut total_files,
        )
        .is_err()
        {
            archive.projects.truncate(projects_before);
            archive.loose.truncate(loose_before);
            total_files = total_before;
            archive.roots[root_index].available = false;
        }
    }

    Ok((archive, root_paths))
}

#[tauri::command]
fn scan_archives(
    roots: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<ArchiveData, String> {
    let (archive, root_paths) = scan_configured_roots(roots)?;
    *state.roots.lock().map_err(|_| "library_unavailable")? = root_paths;
    Ok(archive)
}

fn mutation_io_error(error: std::io::Error) -> String {
    match error.kind() {
        std::io::ErrorKind::NotFound => "mutation_missing".into(),
        std::io::ErrorKind::AlreadyExists => "mutation_collision".into(),
        std::io::ErrorKind::PermissionDenied => "mutation_permission_denied".into(),
        std::io::ErrorKind::CrossesDevices => "mutation_cross_device".into(),
        _ => "mutation_failed".into(),
    }
}

fn safe_relative_path(value: &str, allow_empty: bool) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if value.is_empty() && allow_empty {
        return Ok(PathBuf::new());
    }
    if value.is_empty() || path.is_absolute() {
        return Err("mutation_outside_library".into());
    }
    if path
        .components()
        .any(|component| !matches!(component, std::path::Component::Normal(_)))
    {
        return Err("mutation_outside_library".into());
    }
    Ok(path.to_path_buf())
}

fn safe_entry_name(value: &str) -> Result<&str, String> {
    if value.is_empty()
        || value.trim() != value
        || value.len() > 240
        || value.chars().any(|character| {
            character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
        })
    {
        return Err("mutation_invalid_name".into());
    }
    let mut components = Path::new(value).components();
    if !matches!(components.next(), Some(std::path::Component::Normal(_)))
        || components.next().is_some()
        || matches!(value, "." | "..")
    {
        return Err("mutation_invalid_name".into());
    }
    Ok(value)
}

fn available_library_root(roots: &[PathBuf], root_index: usize) -> Result<PathBuf, String> {
    roots
        .get(root_index)
        .ok_or_else(|| "mutation_library_unavailable".to_string())?
        .canonicalize()
        .map_err(|_| "mutation_library_unavailable".to_string())
        .and_then(|root| {
            if root.is_dir() {
                Ok(root)
            } else {
                Err("mutation_library_unavailable".into())
            }
        })
}

fn existing_library_entry(
    roots: &[PathBuf],
    entry: &LibraryEntryRequest,
) -> Result<(PathBuf, PathBuf), String> {
    let root = available_library_root(roots, entry.root_index)?;
    let relative = safe_relative_path(&entry.relative_path, false)?;
    let requested = root.join(relative);
    let metadata = fs::symlink_metadata(&requested).map_err(mutation_io_error)?;
    if metadata.file_type().is_symlink() {
        return Err("mutation_symlink".into());
    }
    let resolved = requested.canonicalize().map_err(mutation_io_error)?;
    if resolved == root || !resolved.starts_with(&root) {
        return Err("mutation_root_protected".into());
    }
    Ok((root, resolved))
}

fn existing_library_folder(
    roots: &[PathBuf],
    folder: &LibraryFolderRequest,
) -> Result<(PathBuf, PathBuf), String> {
    let root = available_library_root(roots, folder.root_index)?;
    let relative = safe_relative_path(&folder.relative_path, true)?;
    let requested = root.join(relative);
    let metadata = fs::symlink_metadata(&requested).map_err(mutation_io_error)?;
    if metadata.file_type().is_symlink() {
        return Err("mutation_symlink".into());
    }
    let resolved = requested.canonicalize().map_err(mutation_io_error)?;
    if !resolved.starts_with(&root) || !resolved.is_dir() {
        return Err("mutation_invalid_destination".into());
    }
    Ok((root, resolved))
}

fn relative_result(root: &Path, path: &Path, root_index: usize) -> Result<MutationResult, String> {
    let relative_path = path
        .strip_prefix(root)
        .map_err(|_| "mutation_outside_library")?
        .to_string_lossy()
        .into_owned();
    Ok(MutationResult {
        root_index,
        relative_path,
    })
}

fn rename_library_entry_at(
    roots: &[PathBuf],
    entry: &LibraryEntryRequest,
    new_name: &str,
) -> Result<MutationResult, String> {
    let new_name = safe_entry_name(new_name)?;
    let (root, source) = existing_library_entry(roots, entry)?;
    if source.file_name() == Some(std::ffi::OsStr::new(new_name)) {
        return Err("mutation_same_name".into());
    }
    let target = source.with_file_name(new_name);
    if target.exists() {
        return Err("mutation_collision".into());
    }
    fs::rename(&source, &target).map_err(mutation_io_error)?;
    relative_result(&root, &target, entry.root_index)
}

fn move_library_entry_at(
    roots: &[PathBuf],
    entry: &LibraryEntryRequest,
    destination: &LibraryFolderRequest,
) -> Result<MutationResult, String> {
    let (_, source) = existing_library_entry(roots, entry)?;
    let (destination_root, destination_folder) = existing_library_folder(roots, destination)?;
    if source.is_dir() && destination_folder.starts_with(&source) {
        return Err("mutation_into_descendant".into());
    }
    let name = source.file_name().ok_or("mutation_invalid_name")?;
    let target = destination_folder.join(name);
    if source == target || source.parent() == Some(destination_folder.as_path()) {
        return Err("mutation_same_location".into());
    }
    if target.exists() {
        return Err("mutation_collision".into());
    }
    fs::rename(&source, &target).map_err(mutation_io_error)?;
    relative_result(&destination_root, &target, destination.root_index)
}

fn create_library_folder_at(
    roots: &[PathBuf],
    destination: &LibraryFolderRequest,
    name: &str,
) -> Result<MutationResult, String> {
    let name = safe_entry_name(name)?;
    let (root, destination_folder) = existing_library_folder(roots, destination)?;
    let target = destination_folder.join(name);
    if target.exists() {
        return Err("mutation_collision".into());
    }
    fs::create_dir(&target).map_err(mutation_io_error)?;
    relative_result(&root, &target, destination.root_index)
}

fn copy_files_to_library_at(
    roots: &[PathBuf],
    sources: &[String],
    destination: &LibraryFolderRequest,
) -> Result<Vec<MutationResult>, String> {
    if sources.is_empty() || sources.len() > 100 {
        return Err("mutation_invalid_selection".into());
    }
    let (root, destination_folder) = existing_library_folder(roots, destination)?;
    let mut prepared = Vec::<(PathBuf, PathBuf)>::new();
    for source in sources {
        let source_path = PathBuf::from(source);
        let metadata = fs::symlink_metadata(&source_path).map_err(mutation_io_error)?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err("mutation_invalid_source".into());
        }
        let source_path = source_path.canonicalize().map_err(mutation_io_error)?;
        let name = source_path.file_name().ok_or("mutation_invalid_name")?;
        let target = destination_folder.join(name);
        if target.exists() || prepared.iter().any(|(_, existing)| existing == &target) {
            return Err("mutation_collision".into());
        }
        prepared.push((source_path, target));
    }

    let mut copied = Vec::with_capacity(prepared.len());
    for (source, target) in prepared {
        fs::copy(source, &target).map_err(mutation_io_error)?;
        copied.push(relative_result(&root, &target, destination.root_index)?);
    }
    Ok(copied)
}

#[tauri::command]
fn rename_library_entry(
    entry: LibraryEntryRequest,
    new_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<MutationResult, String> {
    let roots = state
        .roots
        .lock()
        .map_err(|_| "mutation_library_unavailable")?;
    rename_library_entry_at(&roots, &entry, &new_name)
}

#[tauri::command]
fn move_library_entry(
    entry: LibraryEntryRequest,
    destination: LibraryFolderRequest,
    state: tauri::State<'_, AppState>,
) -> Result<MutationResult, String> {
    let roots = state
        .roots
        .lock()
        .map_err(|_| "mutation_library_unavailable")?;
    move_library_entry_at(&roots, &entry, &destination)
}

#[tauri::command]
fn create_library_folder(
    destination: LibraryFolderRequest,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<MutationResult, String> {
    let roots = state
        .roots
        .lock()
        .map_err(|_| "mutation_library_unavailable")?;
    create_library_folder_at(&roots, &destination, &name)
}

#[tauri::command]
fn copy_files_to_library(
    sources: Vec<String>,
    destination: LibraryFolderRequest,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MutationResult>, String> {
    let roots = state
        .roots
        .lock()
        .map_err(|_| "mutation_library_unavailable")?;
    copy_files_to_library_at(&roots, &sources, &destination)
}

#[tauri::command]
fn trash_library_entry(
    entry: LibraryEntryRequest,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let roots = state
        .roots
        .lock()
        .map_err(|_| "mutation_library_unavailable")?;
    let (_, source) = existing_library_entry(&roots, &entry)?;
    trash::delete(source).map_err(|_| "mutation_trash_failed".to_string())
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

fn cover_image_bytes(path: &Path) -> Result<Vec<u8>, String> {
    let requested = path
        .canonicalize()
        .map_err(|error| format!("Bild nicht gefunden: {error}"))?;
    if !requested.is_file() {
        return Err("Der ausgewählte Pfad ist keine Datei.".into());
    }
    let extension = requested
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg") {
        return Err("Nur PNG- und JPG-Bilder können als Ordner-Cover verwendet werden.".into());
    }
    let size = requested
        .metadata()
        .map_err(|error| error.to_string())?
        .len();
    if size > MAX_COVER_IMAGE_BYTES {
        return Err("Das Cover-Bild ist größer als 16 MB.".into());
    }
    fs::read(requested).map_err(|error| format!("Bild kann nicht gelesen werden: {error}"))
}

#[tauri::command]
fn read_cover_image(path: String) -> Result<Response, String> {
    cover_image_bytes(Path::new(&path)).map(Response::new)
}

fn slicer_kind(id: &str) -> Result<SlicerKind, String> {
    match id {
        "orcaSlicer" => Ok(SlicerKind::OrcaSlicer),
        "bambuStudio" => Ok(SlicerKind::BambuStudio),
        "prusaSlicer" => Ok(SlicerKind::PrusaSlicer),
        _ => Err("unknown_slicer".into()),
    }
}

fn is_slicer_extension(kind: SlicerKind, path: &Path) -> bool {
    let supported = match kind {
        SlicerKind::PrusaSlicer => PRUSA_SLICER_EXTENSIONS,
        SlicerKind::OrcaSlicer | SlicerKind::BambuStudio => SLICER_EXTENSIONS,
    };
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| supported.contains(&extension.to_lowercase().as_str()))
}

fn resolve_slicer_files(
    kind: SlicerKind,
    roots: &[PathBuf],
    requests: &[SlicerFileRequest],
) -> Result<Vec<PathBuf>, String> {
    if requests.is_empty() {
        return Err("no_files".into());
    }
    if requests.len() > MAX_SLICER_FILES {
        return Err("too_many_files".into());
    }

    let mut resolved = Vec::with_capacity(requests.len());
    for request in requests {
        let root = roots.get(request.root_index).ok_or("path_blocked")?;
        let requested = root
            .join(&request.relative_path)
            .canonicalize()
            .map_err(|_| "file_not_found")?;
        if !requested.starts_with(root) || !requested.is_file() {
            return Err("path_blocked".into());
        }
        if !is_slicer_extension(kind, &requested) {
            return Err("unsupported_file".into());
        }
        if !resolved.contains(&requested) {
            resolved.push(requested);
        }
    }
    Ok(resolved)
}

#[cfg(any(target_os = "windows", test))]
fn windows_external_path(path: &Path) -> PathBuf {
    let value = path.as_os_str().to_string_lossy();
    if let Some(network_path) = value.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{network_path}"));
    }
    value
        .strip_prefix(r"\\?\")
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_path_buf())
}

#[cfg(target_os = "macos")]
fn launch_slicer(kind: SlicerKind, files: &[PathBuf]) -> Result<(), String> {
    let mut command = Command::new("/usr/bin/open");
    match kind {
        SlicerKind::OrcaSlicer => {
            command.arg("-b").arg("com.orcaslicer.OrcaSlicer");
        }
        SlicerKind::BambuStudio => {
            command.arg("-b").arg("com.bambulab.bambu-studio");
        }
        SlicerKind::PrusaSlicer => {
            command.arg("-a").arg("PrusaSlicer");
        }
    }
    let output = command.args(files).output().map_err(|_| "launch_failed")?;
    if output.status.success() {
        Ok(())
    } else {
        Err("slicer_not_found".into())
    }
}

#[cfg(target_os = "windows")]
fn windows_slicer_candidates(kind: SlicerKind) -> Vec<PathBuf> {
    let (directories, executable): (Vec<&[&str]>, &str) = match kind {
        SlicerKind::OrcaSlicer => (vec![&["OrcaSlicer"]], "orca-slicer.exe"),
        SlicerKind::BambuStudio => (
            vec![
                &["Bambu Studio"],
                &["BambuStudio"],
                &["Bambu Lab", "Bambu Studio"],
            ],
            "bambu-studio.exe",
        ),
        SlicerKind::PrusaSlicer => (
            vec![&["Prusa3D", "PrusaSlicer"], &["PrusaSlicer"]],
            "prusa-slicer.exe",
        ),
    };
    let mut candidates = Vec::new();
    for variable in ["ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"] {
        if let Some(base) = env::var_os(variable) {
            for directory in &directories {
                let mut path = PathBuf::from(&base);
                path.extend(directory.iter().copied());
                candidates.push(path.join(executable));
            }
        }
    }
    if let Some(base) = env::var_os("LOCALAPPDATA") {
        for directory in &directories {
            let mut programs_path = PathBuf::from(&base).join("Programs");
            programs_path.extend(directory.iter().copied());
            candidates.push(programs_path.join(executable));

            let mut direct_path = PathBuf::from(&base);
            direct_path.extend(directory.iter().copied());
            candidates.push(direct_path.join(executable));
        }
    }
    candidates
}

#[cfg(target_os = "windows")]
fn find_windows_slicer(kind: SlicerKind) -> Option<PathBuf> {
    if let Some(path) = windows_slicer_candidates(kind)
        .into_iter()
        .find(|path| path.is_file())
    {
        return Some(path);
    }
    let executable = match kind {
        SlicerKind::OrcaSlicer => "orca-slicer.exe",
        SlicerKind::BambuStudio => "bambu-studio.exe",
        SlicerKind::PrusaSlicer => "prusa-slicer.exe",
    };
    let mut command = Command::new("where.exe");
    command.creation_flags(CREATE_NO_WINDOW).arg(executable);
    let output = command.output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .map(PathBuf::from)
        .find(|path| path.is_file())
}

#[cfg(target_os = "windows")]
fn launch_slicer(kind: SlicerKind, files: &[PathBuf]) -> Result<(), String> {
    let executable = find_windows_slicer(kind).ok_or("slicer_not_found")?;
    let mut command = Command::new(&executable);
    command.creation_flags(CREATE_NO_WINDOW);
    if let Some(directory) = executable.parent() {
        command.current_dir(directory);
    }
    command
        .args(files.iter().map(|path| windows_external_path(path)))
        .spawn()
        .map(|_| ())
        .map_err(|_| "launch_failed".into())
}

#[cfg(any(target_os = "linux", test))]
fn linux_slicer_targets(kind: SlicerKind) -> (&'static [&'static str], &'static str) {
    match kind {
        SlicerKind::OrcaSlicer => (&["orca-slicer", "OrcaSlicer"], "com.orcaslicer.OrcaSlicer"),
        SlicerKind::BambuStudio => (&["bambu-studio", "BambuStudio"], "com.bambulab.BambuStudio"),
        SlicerKind::PrusaSlicer => (&["prusa-slicer", "PrusaSlicer"], "com.prusa3d.PrusaSlicer"),
    }
}

#[cfg(target_os = "linux")]
fn launch_slicer(kind: SlicerKind, files: &[PathBuf]) -> Result<(), String> {
    let (executables, flatpak_id) = linux_slicer_targets(kind);
    for executable in executables {
        match Command::new(executable).args(files).spawn() {
            Ok(_) => return Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => return Err("launch_failed".into()),
        }
    }

    let installed_as_flatpak = Command::new("flatpak")
        .args(["info", flatpak_id])
        .output()
        .is_ok_and(|output| output.status.success());
    if installed_as_flatpak {
        return Command::new("flatpak")
            .args(["run", flatpak_id])
            .args(files)
            .spawn()
            .map(|_| ())
            .map_err(|_| "launch_failed".into());
    }

    Err("slicer_not_found".into())
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn launch_slicer(_kind: SlicerKind, _files: &[PathBuf]) -> Result<(), String> {
    Err("unsupported_platform".into())
}

#[tauri::command]
fn open_in_slicer(
    slicer: String,
    files: Vec<SlicerFileRequest>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let kind = slicer_kind(&slicer)?;
    let roots = state.roots.lock().map_err(|_| "library_unavailable")?;
    let resolved = resolve_slicer_files(kind, &roots, &files)?;
    drop(roots);
    launch_slicer(kind, &resolved)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_archives,
            rename_library_entry,
            move_library_entry,
            create_library_folder,
            copy_files_to_library,
            trash_library_entry,
            read_model,
            read_cover_image,
            open_in_slicer
        ])
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

        let roots = canonical_roots(vec![
            first.to_string_lossy().into_owned(),
            second.to_string_lossy().into_owned(),
        ])
        .expect("kanonische Testordner");
        let archive = scan_root_paths(&roots).expect("Mehrordner-Scan");

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

    #[test]
    fn keeps_unavailable_roots_while_scanning_available_ones() {
        let missing = test_directory("missing-usb");
        let available = test_directory("available");
        fs::create_dir_all(&available).expect("verfügbarer Bibliotheksordner");
        fs::write(available.join("plate.stl"), b"solid test\nendsolid test").expect("Testmodell");

        let (archive, native_roots) = scan_configured_roots(vec![
            missing.to_string_lossy().into_owned(),
            available.to_string_lossy().into_owned(),
        ])
        .expect("teilweiser Bibliotheksscan");

        assert_eq!(archive.roots.len(), 2);
        assert!(!archive.roots[0].available);
        assert!(archive.roots[1].available);
        assert_eq!(archive.loose.len(), 1);
        assert_eq!(archive.loose[0].root_index, 1);
        assert_eq!(native_roots.len(), 2);

        fs::remove_dir_all(available).expect("Testordner entfernen");
    }

    #[test]
    fn configured_scan_deduplicates_the_same_available_root() {
        let available = test_directory("duplicate-root");
        fs::create_dir_all(&available).expect("verfügbarer Bibliotheksordner");
        fs::write(available.join("plate.stl"), b"solid test\nendsolid test").expect("Testmodell");

        let equivalent = available.join(".");
        let (archive, native_roots) = scan_configured_roots(vec![
            available.to_string_lossy().into_owned(),
            equivalent.to_string_lossy().into_owned(),
        ])
        .expect("Scan ohne doppelten Bibliotheksordner");

        assert_eq!(archive.roots.len(), 1);
        assert_eq!(native_roots.len(), 1);
        assert_eq!(archive.loose.len(), 1);

        fs::remove_dir_all(available).expect("Testordner entfernen");
    }

    #[test]
    fn configured_scan_prefers_a_parent_over_its_child() {
        let parent = test_directory("configured-parent");
        let child = parent.join("child");
        fs::create_dir_all(&child).expect("verschachtelte Bibliotheksordner");
        fs::write(child.join("plate.stl"), b"solid test\nendsolid test").expect("Testmodell");

        let (archive, native_roots) = scan_configured_roots(vec![
            child.to_string_lossy().into_owned(),
            parent.to_string_lossy().into_owned(),
        ])
        .expect("Scan mit übergeordnetem Bibliotheksordner");

        assert_eq!(archive.roots.len(), 1);
        assert_eq!(native_roots.len(), 1);
        assert_eq!(
            native_roots[0],
            parent.canonicalize().expect("kanonischer Elternordner")
        );

        fs::remove_dir_all(parent).expect("Testordner entfernen");
    }

    #[test]
    fn library_mutations_stay_inside_registered_roots() {
        let root = test_directory("mutation-boundary");
        fs::create_dir_all(root.join("Projekt")).expect("Projektordner");
        fs::write(
            root.join("Projekt").join("teil.stl"),
            b"solid test\nendsolid test",
        )
        .expect("Testmodell");
        let roots = vec![root.canonicalize().expect("kanonischer Bibliotheksordner")];

        let traversal = LibraryEntryRequest {
            root_index: 0,
            relative_path: "../fremd.stl".into(),
        };
        let root_entry = LibraryEntryRequest {
            root_index: 0,
            relative_path: "".into(),
        };

        assert_eq!(
            existing_library_entry(&roots, &traversal).unwrap_err(),
            "mutation_outside_library"
        );
        assert_eq!(
            existing_library_entry(&roots, &root_entry).unwrap_err(),
            "mutation_outside_library"
        );

        fs::remove_dir_all(root).expect("Testordner entfernen");
    }

    #[test]
    fn library_entries_can_be_created_renamed_moved_and_copied_without_overwrite() {
        let root = test_directory("mutations");
        let imports = test_directory("mutation-imports");
        fs::create_dir_all(root.join("Projekt").join("Quelle")).expect("Quellordner");
        fs::create_dir_all(root.join("Projekt").join("Ziel")).expect("Zielordner");
        fs::create_dir_all(&imports).expect("Importordner");
        fs::write(
            root.join("Projekt").join("Quelle").join("teil.stl"),
            b"solid test",
        )
        .expect("Testmodell");
        fs::write(imports.join("platte.3mf"), b"test").expect("Importdatei");
        let roots = vec![root.canonicalize().expect("kanonischer Bibliotheksordner")];

        let renamed = rename_library_entry_at(
            &roots,
            &LibraryEntryRequest {
                root_index: 0,
                relative_path: "Projekt/Quelle/teil.stl".into(),
            },
            "halter.stl",
        )
        .expect("Datei umbenennen");
        assert!(renamed.relative_path.ends_with("Projekt/Quelle/halter.stl"));

        let destination = LibraryFolderRequest {
            root_index: 0,
            relative_path: "Projekt/Ziel".into(),
        };
        let moved = move_library_entry_at(
            &roots,
            &LibraryEntryRequest {
                root_index: 0,
                relative_path: renamed.relative_path,
            },
            &destination,
        )
        .expect("Datei verschieben");
        assert!(moved.relative_path.ends_with("Projekt/Ziel/halter.stl"));

        let created = create_library_folder_at(&roots, &destination, "Varianten")
            .expect("Unterordner erstellen");
        assert!(created.relative_path.ends_with("Projekt/Ziel/Varianten"));

        let copied = copy_files_to_library_at(
            &roots,
            &[imports.join("platte.3mf").to_string_lossy().into_owned()],
            &destination,
        )
        .expect("Datei kopieren");
        assert_eq!(copied.len(), 1);
        assert!(copied[0].relative_path.ends_with("Projekt/Ziel/platte.3mf"));

        assert_eq!(
            rename_library_entry_at(
                &roots,
                &LibraryEntryRequest {
                    root_index: 0,
                    relative_path: moved.relative_path,
                },
                "platte.3mf",
            )
            .unwrap_err(),
            "mutation_collision"
        );

        fs::remove_dir_all(root).expect("Bibliotheksordner entfernen");
        fs::remove_dir_all(imports).expect("Importordner entfernen");
    }

    #[test]
    fn folders_cannot_be_moved_into_their_own_descendants() {
        let root = test_directory("mutation-descendant");
        fs::create_dir_all(root.join("Projekt").join("Unterordner"))
            .expect("verschachtelte Ordner");
        let roots = vec![root.canonicalize().expect("kanonischer Bibliotheksordner")];

        let error = move_library_entry_at(
            &roots,
            &LibraryEntryRequest {
                root_index: 0,
                relative_path: "Projekt".into(),
            },
            &LibraryFolderRequest {
                root_index: 0,
                relative_path: "Projekt/Unterordner".into(),
            },
        )
        .unwrap_err();

        assert_eq!(error, "mutation_into_descendant");
        fs::remove_dir_all(root).expect("Testordner entfernen");
    }

    #[test]
    fn folder_covers_only_read_supported_images() {
        let directory = test_directory("folder-cover");
        fs::create_dir_all(&directory).expect("Cover-Testordner");
        let image = directory.join("cover.PNG");
        let unsupported = directory.join("cover.svg");
        fs::write(&image, b"png-test").expect("PNG-Testdatei");
        fs::write(&unsupported, b"svg-test").expect("SVG-Testdatei");

        assert_eq!(cover_image_bytes(&image).expect("Cover-Bild"), b"png-test");
        assert!(cover_image_bytes(&unsupported).is_err());

        fs::remove_dir_all(directory).expect("Cover-Testordner entfernen");
    }

    #[test]
    fn slicer_targets_are_strictly_limited() {
        assert_eq!(slicer_kind("orcaSlicer"), Ok(SlicerKind::OrcaSlicer));
        assert_eq!(slicer_kind("bambuStudio"), Ok(SlicerKind::BambuStudio));
        assert_eq!(slicer_kind("prusaSlicer"), Ok(SlicerKind::PrusaSlicer));
        assert_eq!(slicer_kind("custom"), Err("unknown_slicer".into()));
    }

    #[test]
    fn windows_slicer_paths_remove_extended_length_prefixes() {
        assert_eq!(
            windows_external_path(Path::new(r"\\?\C:\Modelle\Teil mit Leerzeichen.3mf")),
            PathBuf::from(r"C:\Modelle\Teil mit Leerzeichen.3mf")
        );
        assert_eq!(
            windows_external_path(Path::new(r"\\?\UNC\server\drucke\teil.stl")),
            PathBuf::from(r"\\server\drucke\teil.stl")
        );
        assert_eq!(
            windows_external_path(Path::new(r"C:\Modelle\teil.stl")),
            PathBuf::from(r"C:\Modelle\teil.stl")
        );
    }

    #[test]
    fn linux_slicer_targets_cover_native_and_flatpak_installations() {
        assert_eq!(
            linux_slicer_targets(SlicerKind::OrcaSlicer),
            (
                &["orca-slicer", "OrcaSlicer"][..],
                "com.orcaslicer.OrcaSlicer"
            )
        );
        assert_eq!(
            linux_slicer_targets(SlicerKind::BambuStudio).1,
            "com.bambulab.BambuStudio"
        );
        assert_eq!(
            linux_slicer_targets(SlicerKind::PrusaSlicer).1,
            "com.prusa3d.PrusaSlicer"
        );
    }

    #[test]
    fn slicer_files_must_be_supported_and_inside_a_library() {
        let root = test_directory("slicer-root");
        fs::create_dir_all(root.join("Project_A")).expect("Projektordner");
        fs::write(
            root.join("Project_A/model.stl"),
            b"solid test\nendsolid test",
        )
        .expect("STL-Testdatei");
        fs::write(root.join("Project_A/model.ply"), b"ply\n").expect("PLY-Testdatei");
        fs::write(root.join("notes.pdf"), b"test").expect("PDF-Testdatei");
        let canonical_root = root.canonicalize().expect("kanonischer Testordner");
        let roots = vec![canonical_root];

        let valid = resolve_slicer_files(
            SlicerKind::PrusaSlicer,
            &roots,
            &[SlicerFileRequest {
                root_index: 0,
                relative_path: "Project_A/model.stl".into(),
            }],
        )
        .expect("gültige Slicer-Datei");
        assert_eq!(valid.len(), 1);

        let unsupported = resolve_slicer_files(
            SlicerKind::PrusaSlicer,
            &roots,
            &[SlicerFileRequest {
                root_index: 0,
                relative_path: "notes.pdf".into(),
            }],
        );
        assert_eq!(unsupported, Err("unsupported_file".into()));

        let blocked = resolve_slicer_files(
            SlicerKind::PrusaSlicer,
            &roots,
            &[SlicerFileRequest {
                root_index: 1,
                relative_path: "Project_A/model.stl".into(),
            }],
        );
        assert_eq!(blocked, Err("path_blocked".into()));

        let orca_ply = resolve_slicer_files(
            SlicerKind::OrcaSlicer,
            &roots,
            &[SlicerFileRequest {
                root_index: 0,
                relative_path: "Project_A/model.ply".into(),
            }],
        );
        assert!(orca_ply.is_ok());

        let prusa_ply = resolve_slicer_files(
            SlicerKind::PrusaSlicer,
            &roots,
            &[SlicerFileRequest {
                root_index: 0,
                relative_path: "Project_A/model.ply".into(),
            }],
        );
        assert_eq!(prusa_ply, Err("unsupported_file".into()));

        fs::remove_dir_all(root).expect("Testordner entfernen");
    }
}
