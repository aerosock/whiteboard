// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Fix for WebKitGTK 15-20 FPS lag & 500ms input latency bug on Linux X11 with NVIDIA GPUs
        // By default WebKitGTK 2.40+ tries DMA-BUF texture sharing which fails/stalls on NVIDIA X11 drivers.
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    whiteboard_lib::run()
}
