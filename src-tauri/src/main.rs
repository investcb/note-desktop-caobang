// Tránh mở thêm cửa sổ console trên Windows ở bản release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    note_desktop_lib::run();
}
