fn main() {
    // Nhúng khóa OpenRouter lúc COMPILE để bản .exe chạy được ngay.
    // Ưu tiên 1: biến môi trường (GitHub Actions dùng repo Secret).
    // Ưu tiên 2: ../.env.local trên máy local.
    let mut api_key = std::env::var("OPENROUTER_API_KEY")
        .ok()
        .filter(|v| !v.trim().is_empty());
    let mut model = std::env::var("OPENROUTER_MODEL")
        .ok()
        .filter(|v| !v.trim().is_empty());

    if api_key.is_none() || model.is_none() {
        if let Ok(contents) = std::fs::read_to_string("../.env.local") {
            for line in contents.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') || !line.contains('=') {
                    continue;
                }
                if let Some((key, value)) = line.split_once('=') {
                    let key = key.trim();
                    let value = value.trim().trim_matches('"').trim_matches('\'').to_string();
                    match key {
                        "OPENROUTER_API_KEY" if api_key.is_none() => api_key = Some(value),
                        "OPENROUTER_MODEL" if model.is_none() => model = Some(value),
                        _ => {}
                    }
                }
            }
        }
    }

    if let Some(k) = api_key {
        println!("cargo:rustc-env=SEED_OPENROUTER_API_KEY={}", k);
    }
    if let Some(m) = model {
        println!("cargo:rustc-env=SEED_OPENROUTER_MODEL={}", m);
    }

    println!("cargo:rerun-if-changed=../.env.local");
    println!("cargo:rerun-if-env-changed=OPENROUTER_API_KEY");
    println!("cargo:rerun-if-env-changed=OPENROUTER_MODEL");

    tauri_build::build();
}
