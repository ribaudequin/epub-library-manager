use tauri::command;

#[command]
fn library_get_root() -> Option<String> {
    None
}

#[command]
fn library_scan(root_path: Option<String>) -> serde_json::Value {
    serde_json::json!({
        "series": [],
        "rootPath": root_path
    })
}

#[command]
fn library_set_status(series_id: String, volume_id: String, status: String) -> bool {
    status == "lido" || status == "nao_lido" || status == "pendente"
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
            app_get_locale
        ])
        .run(tauri::generate_context!())
        .expect("erro ao rodar Tauri");
}
