// Tauri protótipo — stub para Fase 1 do estudo
// A lógica de scan/EPUB (library.js) permanece no frontend por enquanto.

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("erro ao rodar Tauri");
}
