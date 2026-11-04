import { useState } from "react";
import { X, Sun, Moon, Monitor, FileText, LayoutGrid, HardDrive, SunMedium, MoonStar } from "lucide-react";
import { ThemeMode, useTheme } from "../hooks/useTheme";
import { PaperStyle, BoardMode, isDesktopApp } from "../lib/storage";
import { applyWindowDecorations, WindowDecorationsMode } from "../lib/window";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  paperStyle: PaperStyle;
  onPaperStyleChange: (style: PaperStyle) => void;
  boardMode: BoardMode;
  onBoardModeChange: (mode: BoardMode) => void;
  clampToPages: boolean;
  onClampToPagesChange: (clamp: boolean) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  paperStyle,
  onPaperStyleChange,
  boardMode,
  onBoardModeChange,
  clampToPages,
  onClampToPagesChange,
}: SettingsModalProps) {
  const { mode, setMode } = useTheme();
  const [uiScale, setUiScale] = useState<number>(() => {
    const saved = localStorage.getItem("wb_ui_scale");
    return saved ? Number(saved) : 100;
  });
  const [decorationsMode, setDecorationsMode] = useState<WindowDecorationsMode>(() => {
    return (localStorage.getItem("wb_window_decorations") as WindowDecorationsMode) || "auto";
  });

  function handleScaleChange(scale: number) {
    setUiScale(scale);
    localStorage.setItem("wb_ui_scale", String(scale));
    document.documentElement.style.fontSize = `${(scale / 100) * 16}px`;
  }

  function handleDecorationsChange(newMode: WindowDecorationsMode) {
    setDecorationsMode(newMode);
    localStorage.setItem("wb_window_decorations", newMode);
    applyWindowDecorations(newMode);
  }

  if (!isOpen) return null;

  const isDesktop = isDesktopApp();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Appearance / Theme */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Appearance
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: "system" as ThemeMode, label: "System", icon: <Monitor size={14} /> },
                { id: "light" as ThemeMode, label: "Light", icon: <Sun size={14} /> },
                { id: "warm" as ThemeMode, label: "Warm", icon: <SunMedium size={14} /> },
                { id: "charcoal" as ThemeMode, label: "Charcoal", icon: <MoonStar size={14} /> },
                { id: "dark" as ThemeMode, label: "Dark", icon: <Moon size={14} /> },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMode(t.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded-lg border text-center transition-all ${
                    mode === t.id
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {t.icon}
                  <span className="text-[11px] leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interface Scale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Interface Scale
              </label>
              <span className="text-xs font-mono text-neutral-500">{uiScale}%</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[85, 100, 115, 130].map((s) => (
                <button
                  key={s}
                  onClick={() => handleScaleChange(s)}
                  className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    uiScale === s
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>

          {/* Native Desktop Window Frame (Tauri Only) */}
          {isDesktop && (
            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                    Window Frame
                  </label>
                  <span className="text-[11px] text-neutral-400">
                    Control title bar and window border decorations
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "auto", label: "Auto", sub: "Detect Tiling WM" },
                  { id: "decorations", label: "Framed", sub: "OS Titlebar" },
                  { id: "frameless", label: "Frameless", sub: "Clean Edge" },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleDecorationsChange(d.id as WindowDecorationsMode)}
                    className={`py-2 px-2 rounded-lg border text-center transition-all ${
                      decorationsMode === d.id
                        ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <div className="text-xs font-medium">{d.label}</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">{d.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Canvas Mode Options */}
          <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Default Canvas Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onBoardModeChange("notebook")}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  boardMode === "notebook"
                    ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                <FileText size={18} className="mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Structured Notebook</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    A4 pages, pagination, ruled paper formats
                  </div>
                </div>
              </button>

              <button
                onClick={() => onBoardModeChange("infinite")}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  boardMode === "infinite"
                    ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                <LayoutGrid size={18} className="mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Infinite Whiteboard</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    Unbounded 2D surface for freeform mind mapping
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Notebook Paper Clamping */}
          {boardMode === "notebook" && (
            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Notebook Page Boundary
              </label>
              <div
                onClick={() => onClampToPagesChange(!clampToPages)}
                className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100/50 dark:hover:bg-neutral-900/50 transition-colors"
              >
                <div>
                  <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                    Strict Page Clamping
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Clip strokes and prevent ink from spilling outside sheets
                  </div>
                </div>
                <div
                  className={`w-9 h-5 rounded-full transition-colors flex items-center p-0.5 ${
                    clampToPages
                      ? "bg-neutral-900 dark:bg-neutral-100 justify-end"
                      : "bg-neutral-300 dark:bg-neutral-700 justify-start"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-transform ${
                      clampToPages
                        ? "bg-white dark:bg-neutral-900 shadow-2xs"
                        : "bg-white dark:bg-neutral-400"
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Paper Background Style */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Paper Style
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "dots" as PaperStyle, label: "Dot Grid" },
                { id: "lined" as PaperStyle, label: "Lined" },
                { id: "grid" as PaperStyle, label: "Grid" },
                { id: "blank" as PaperStyle, label: "Blank" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPaperStyleChange(p.id)}
                  className={`py-2 px-2.5 rounded-lg border text-center text-xs font-medium transition-all ${
                    paperStyle === p.id
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Storage & Environment */}
          <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Environment
            </label>
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs">
              <div className="flex items-center gap-2">
                <HardDrive size={15} className="text-neutral-500" />
                <div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">
                    {isDesktop ? "Desktop Local-First" : "Web Local-First"}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    All boards are stored locally on your device with offline autonomy
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px] font-mono">
                {isDesktop ? "Desktop" : "Local-First"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
