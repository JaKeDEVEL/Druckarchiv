use serde::{Deserialize, Serialize};
#[cfg(target_os = "windows")]
use std::env;
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
const MAX_SLICER_FILES: usize = 100;
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

fn scan_root_paths(root_paths: &[PathBuf]) -> Result<ArchiveData, String> {
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
fn scan_archives(
    roots: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<ArchiveData, String> {
    let root_paths = canonical_roots(roots)?;
    let archive = scan_root_paths(&root_paths)?;
    *state.roots.lock().map_err(|_| "library_unavailable")? = root_paths;
    Ok(archive)
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
        SlicerKind::BambuStudio => (vec![&["Bambu Studio"]], "bambu-studio.exe"),
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
    let output = Command::new("where.exe").arg(executable).output().ok()?;
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
    Command::new(executable)
        .args(files)
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
        .invoke_handler(tauri::generate_handler![
            scan_archives,
            read_model,
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
    fn slicer_targets_are_strictly_limited() {
        assert_eq!(slicer_kind("orcaSlicer"), Ok(SlicerKind::OrcaSlicer));
        assert_eq!(slicer_kind("bambuStudio"), Ok(SlicerKind::BambuStudio));
        assert_eq!(slicer_kind("prusaSlicer"), Ok(SlicerKind::PrusaSlicer));
        assert_eq!(slicer_kind("custom"), Err("unknown_slicer".into()));
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
