#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::command;

#[command]
fn library_get_root() -> Option<String> {
    std::env::var("LIBRARY_ROOT").ok()
}

#[command]
fn library_set_status(series_id: String, volume_id: String, status: String) -> bool {
    ["lido", "nao_lido", "pendente"].contains(&status.as_str())
}

#[command]
fn library_set_series_state(series_id: String, series_state: String) -> bool {
    ["ongoing", "completed", "cancelled", "hiatus"].contains(&series_state.as_str())
}

#[command]
fn library_mtime(root_path: Option<String>) -> serde_json::Value {
    let mut max_time = 0u64;
    let root_str = root_path.clone().unwrap_or_default();
    if let Some(root) = root_path {
        if let Ok(entries) = fs::read_dir(root) {
            for entry in entries.filter_map(|e| e.ok()) {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                            let ms = duration.as_millis() as u64;
                            let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
                            if ms > max_time && ms <= now {
                                max_time = ms;
                            }
                        }
                    }
                }
            }
        }
    }
    serde_json::json!({"rootMtime": max_time, "cacheKey": ("library_".to_string() + &root_str)})
}

#[command]
fn library_watch(_root_path: Option<String>) -> bool {
    true
}

#[command]
fn library_unwatch() -> bool {
    true
}

#[command]
fn cover_read(path: String) -> Option<Vec<u8>> {
    fs::read(path).ok()
}

#[command]
fn shell_open_external(url: String) -> bool {
    if url.starts_with("http") {
        let _ = std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn();
        true
    } else {
        false
    }
}

use std::fs;
use std::path::Path;

#[command]
fn library_scan(root_path: Option<String>) -> serde_json::Value {
    let mut series_list = Vec::new();
    if let Some(ref root) = root_path {
        let root_path = Path::new(&root);
        if let Ok(entries) = fs::read_dir(root_path) {
            let mut dirs: Vec<String> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().map(|f| f.is_dir()).unwrap_or(false))
                .map(|e| e.file_name().into_string().unwrap_or_default())
                .filter(|n| !n.is_empty())
                .collect();
            dirs.sort();
            for dir_name in dirs {
                let dir_path = root_path.join(&dir_name);
                if let Ok(files) = fs::read_dir(&dir_path) {
                    let mut epub_files: Vec<String> = files
                        .filter_map(|f| f.ok())
                        .filter(|f| f.file_type().map(|t| t.is_file()).unwrap_or(false))
                        .map(|f| f.file_name().into_string().unwrap_or_default())
                        .filter(|n| n.to_lowercase().ends_with(".epub"))
                        .collect();
                    epub_files.sort();
                    if !epub_files.is_empty() {
                        series_list.push(serde_json::json!({
                            "id": dir_name.clone(),
                            "name": dir_name,
                            "path": dir_path.to_string_lossy(),
                            "volumeCount": epub_files.len(),
                            "author": null,
                            "lastModified": 0,
                            "cover": null,
                            "volumes": epub_files.iter().map(|f| serde_json::json!({
                                "id": f,
                                "filePath": dir_path.join(f).to_string_lossy(),
                                "name": f.strip_suffix(".epub").unwrap_or(f).to_string(),
                                "title": f.strip_suffix(".epub").unwrap_or(f).to_string(),
                                "author": null,
                                "mtime": 0,
                                "coverSrc": null,
                            })).collect::<Vec<_>>()
                        }));
                    }
                }
            }
        }
    }
    let root_path_str = root_path.clone();
    serde_json::json!({
        "series": series_list,
        "rootPath": root_path_str
    })
}

#[command]
fn app_get_locale() -> serde_json::Value {
    serde_json::json!({"locale":"pt-PT","isPt":true})
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            library_get_root,
            library_scan,
            library_set_status,
            library_set_series_state,
            library_mtime,
            library_watch,
            library_unwatch,
            cover_read,
            shell_open_external,
            app_get_locale
        ])
        .run(tauri::generate_context!())
        .expect("erro ao rodar Tauri");
}
