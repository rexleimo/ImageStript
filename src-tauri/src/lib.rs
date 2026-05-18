mod commands;
pub mod engine;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_paths,
            commands::inspect_image,
            commands::process_image,
            commands::process_batch,
            commands::read_image_as_base64,
            commands::read_image_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
