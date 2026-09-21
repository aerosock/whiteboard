use tauri::Manager;

#[tauri::command]
fn is_tiling_wm() -> bool {
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_some()
            || std::env::var_os("SWAYSOCK").is_some()
            || std::env::var_os("I3SOCK").is_some()
        {
            return true;
        }
        if let Ok(desktop) = std::env::var("XDG_CURRENT_DESKTOP") {
            let d = desktop.to_lowercase();
            if d.contains("hyprland")
                || d.contains("sway")
                || d.contains("i3")
                || d.contains("bspwm")
                || d.contains("dwm")
                || d.contains("xmonad")
                || d.contains("qtile")
                || d.contains("awesome")
            {
                return true;
            }
        }
    }
    false
}

#[tauri::command]
fn set_window_decorations(window: tauri::Window, decorations: bool) -> Result<(), String> {
    window.set_decorations(decorations).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![is_tiling_wm, set_window_decorations])
        .setup(|app| {
            if is_tiling_wm() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
