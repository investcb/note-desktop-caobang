use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Cấu hình cục bộ, lưu JSON trong thư mục app-config của HĐH.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default = "default_model")]
    pub openrouter_model: String,
    #[serde(default)]
    pub openrouter_api_key: String,
}

fn default_model() -> String {
    option_env!("SEED_OPENROUTER_MODEL")
        .unwrap_or("google/gemini-3-flash-preview")
        .to_string()
}

fn seed_key() -> String {
    option_env!("SEED_OPENROUTER_API_KEY").unwrap_or("").to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            openrouter_model: default_model(),
            openrouter_api_key: seed_key(),
        }
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

/// Đọc cấu hình; nếu key rỗng thì tự dùng key nhúng lúc build (seed).
pub fn load_settings(app: &AppHandle) -> Settings {
    if let Ok(path) = config_path(app) {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(mut s) = serde_json::from_str::<Settings>(&content) {
                if s.openrouter_api_key.trim().is_empty() {
                    s.openrouter_api_key = seed_key();
                }
                if s.openrouter_model.trim().is_empty() {
                    s.openrouter_model = default_model();
                }
                return s;
            }
        }
    }
    Settings::default()
}

fn write_settings(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = config_path(app)?;
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Settings {
    load_settings(&app)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    write_settings(&app, &settings)
}
