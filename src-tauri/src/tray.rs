use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

/// Tạo icon khay hệ thống + menu chuột phải.
pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_main = MenuItem::with_id(app, "show_main", "Mở ứng dụng", true, None::<&str>)?;
    let toggle_widget =
        MenuItem::with_id(app, "toggle_widget", "Bật / Tắt Widget Desktop", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Thoát hẳn", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_main, &toggle_widget, &sep, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("Ghi Chú Chuẩn - Lịch & Công việc")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show_main" => show_window(app, "main"),
            "toggle_widget" => toggle_widget_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_window(tray.app_handle(), "main");
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

/// Đưa cửa sổ ra trước, khôi phục từ khay nếu đang ẩn.
pub fn show_window(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Bật/tắt cửa sổ widget nổi.
pub fn toggle_widget_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("widget") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
