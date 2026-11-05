import { useState } from "react";
import {
  X,
  Sun,
  Moon,
  Monitor,
  FileText,
  LayoutGrid,
  SunMedium,
  MoonStar,
} from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Theme */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Theme
            </label>
            <div className="grid grid-cols-5 gap-1">
              {[
                { id: "system" as ThemeMode, label: "System", icon: <Monitor size={14} /> },
                { id: "light" as ThemeMode, label: "Light", icon: <Sun size={14} /> },
                { id: "warm" as ThemeMode, label: "Warm", icon: <SunMedium size={14} /> },
                { id: "charcoal" as ThemeMode, label: "Slate", icon: <MoonStar size={14} /> },
                { id: "dark" as ThemeMode, label: "Dark", icon: <Moon size={14} /> },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMode(t.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border text-center transition-all ${
                    mode === t.id
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {t.icon}
                  <span className="text-[10px] leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interface Scale */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                UI Scale
              </label>
              <span className="text-[11px] font-mono text-neutral-500">{uiScale}%</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[85, 100, 115, 130].map((s) => (
                <button
                  key={s}
                  onClick={() => handleScaleChange(s)}
                  className={`h-8 rounded-lg border text-xs font-mono transition-all ${
                    uiScale === s
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>

          {/* Native Desktop Window Frame */}
          {isDesktop && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                Window Frame
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "auto", label: "Auto" },
                  { id: "decorations", label: "Framed" },
                  { id: "frameless", label: "Frameless" },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleDecorationsChange(d.id as WindowDecorationsMode)}
                    className={`h-8 rounded-lg border text-xs font-medium transition-all ${
                      decorationsMode === d.id
                        ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Board Mode */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Board Mode
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onBoardModeChange("notebook")}
                className={`h-9 flex items-center justify-center gap-2 rounded-lg border text-xs font-medium transition-all ${
                  boardMode === "notebook"
                    ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                <FileText size={14} />
                <span>Notebook (A4)</span>
              </button>

              <button
                onClick={() => onBoardModeChange("infinite")}
                className={`h-9 flex items-center justify-center gap-2 rounded-lg border text-xs font-medium transition-all ${
                  boardMode === "infinite"
                    ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                <LayoutGrid size={14} />
                <span>Infinite Canvas</span>
              </button>
            </div>
          </div>

          {/* Paper Ruling */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Paper Ruling
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "lined" as PaperStyle, label: "Lined" },
                { id: "grid" as PaperStyle, label: "Grid" },
                { id: "dots" as PaperStyle, label: "Dots" },
                { id: "blank" as PaperStyle, label: "Blank" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPaperStyleChange(p.id)}
                  className={`h-8 rounded-lg border text-xs font-medium transition-all ${
                    paperStyle === p.id
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Page Boundary Clamping */}
          {boardMode === "notebook" && (
            <div
              onClick={() => onClampToPagesChange(!clampToPages)}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-neutral-900/60 transition-colors"
            >
              <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                Clip strokes to page edges
              </span>
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
                      ? "bg-white dark:bg-neutral-900"
                      : "bg-white dark:bg-neutral-400"
                  }`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
