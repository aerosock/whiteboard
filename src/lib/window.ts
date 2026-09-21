import { invoke } from "@tauri-apps/api/core";
import { isDesktopApp } from "./storage";

export type WindowDecorationsMode = "auto" | "show" | "hide";

export async function applyWindowDecorations(mode?: WindowDecorationsMode): Promise<void> {
  if (!isDesktopApp()) return;
  const currentMode =
    mode || (localStorage.getItem("wb_window_decorations") as WindowDecorationsMode) || "auto";

  try {
    let show = true;
    if (currentMode === "hide") {
      show = false;
    } else if (currentMode === "auto") {
      const isTwm = await invoke<boolean>("is_tiling_wm");
      show = !isTwm;
    }
    await invoke("set_window_decorations", { decorations: show });
  } catch (err) {
    console.warn("Failed to set window decorations:", err);
  }
}

export async function getNativeClipboardImage(): Promise<string | null> {
  if (!isDesktopApp()) return null;
  try {
    const result = await invoke<string | null>("read_clipboard_image");
    return result || null;
  } catch (err) {
    console.warn("Failed to read native clipboard image:", err);
    return null;
  }
}
