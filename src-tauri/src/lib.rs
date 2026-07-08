mod ai;
mod config;
mod tray;

use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ai::ai_parse_document,
            ai::ai_chat,
            ai::ai_ocr_text,
            config::get_settings,
            config::save_settings,
        ])
        .setup(|app| {
            tray::build_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label().to_string();
                if label == "main" {
                    // Thu nhỏ vào khay thay vì thoát hẳn (giữ app chạy, mở lại từ tray).
                    api.prevent_close();
                    let _ = window.hide();
                } else if label == "widget" {
                    // Widget chỉ ẩn đi, bật lại từ tray.
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
