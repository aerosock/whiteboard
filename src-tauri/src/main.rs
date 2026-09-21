// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        let is_wayland = std::env::var("XDG_SESSION_TYPE")
            .map(|s| s.eq_ignore_ascii_case("wayland"))
            .unwrap_or(false)
            || std::env::var_os("WAYLAND_DISPLAY").is_some();

        let is_nvidia = std::path::Path::new("/proc/driver/nvidia").exists()
            || std::fs::read_dir("/sys/class/drm")
                .map(|entries| {
                    entries.filter_map(|e| e.ok()).any(|e| {
                        let path = e.path().join("device/vendor");
                        std::fs::read_to_string(path)
                            .map(|v| v.trim() == "0x10de")
                            .unwrap_or(false)
                    })
                })
                .unwrap_or(false);

        if is_nvidia {
            if is_wayland {
                // On Wayland with NVIDIA (e.g. Hyprland, Sway), explicit sync causes WebKitGTK
                // to crash with Protocol Error 71. Setting __NV_DISABLE_EXPLICIT_SYNC=1 allows
                // the full GPU hardware-accelerated pipeline to run cleanly without forcing
                // the unaccelerated software path (which has 500-700ms input lag and distorted sRGB).
                if std::env::var_os("__NV_DISABLE_EXPLICIT_SYNC").is_none() {
                    std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
                }
            } else {
                // On pure X11 sessions with NVIDIA, DMA-BUF renderer can fail with GBM buffer errors.
                if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
                    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
                }
            }
        }
    }

    whiteboard_lib::run()
}
