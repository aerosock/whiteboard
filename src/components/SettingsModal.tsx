import { useState } from "react";
import { X, Sun, Moon, Monitor, FileText, LayoutGrid, HardDrive, LogOut, SunMedium, MoonStar } from "lucide-react";
import { ThemeMode, useTheme } from "../hooks/useTheme";
import { PaperStyle, BoardMode, isDesktopApp, PageLayout } from "../lib/storage";
import { User } from "../lib/api";
import { applyWindowDecorations, WindowDecorationsMode } from "../lib/window";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onLogout: () => void;
  paperStyle: PaperStyle;
  onPaperStyleChange: (style: PaperStyle) => void;
  boardMode: BoardMode;
  onBoardModeChange: (mode: BoardMode) => void;
  clampToPages: boolean;
  onClampToPagesChange: (clamp: boolean) => void;
  pageLayout?: PageLayout;
  onPageLayoutChange?: (layout: PageLayout) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  user,
  onLogout,
  paperStyle,
  onPaperStyleChange,
  boardMode,
  onBoardModeChange,
  clampToPages,
  onClampToPagesChange,
  pageLayout = "single",
  onPageLayoutChange,
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
              <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                {uiScale}%
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[80, 90, 100, 110, 125].map((scale) => (
                <button
                  key={scale}
                  onClick={() => handleScaleChange(scale)}
                  className={`py-1.5 px-1 rounded-lg border text-center text-xs transition-all ${
                    uiScale === scale
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {scale}%
                </button>
              ))}
            </div>
          </div>

          {/* Window Titlebar (Desktop only) */}
          {isDesktop && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Window Frame / Titlebar
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "auto" as WindowDecorationsMode, label: "Auto (TWM)", desc: "Hide on Hyprland/TWM" },
                  { id: "hide" as WindowDecorationsMode, label: "Hidden", desc: "Clean frameless" },
                  { id: "show" as WindowDecorationsMode, label: "Visible", desc: "Native titlebar" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleDecorationsChange(item.id)}
                    className={`py-2 px-1.5 rounded-lg border text-center transition-all ${
                      decorationsMode === item.id
                        ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <div className="text-xs">{item.label}</div>
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Canvas Mode */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Canvas Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onBoardModeChange("infinite")}
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                  boardMode === "infinite"
                    ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800"
                    : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                <LayoutGrid size={16} className="mt-0.5 text-neutral-600 dark:text-neutral-400" />
                <div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Infinite Canvas
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Boundless zoom and pan
                  </div>
                </div>
              </button>

              <button
                onClick={() => onBoardModeChange("notebook")}
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                  boardMode === "notebook"
                    ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800"
                    : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                <FileText size={16} className="mt-0.5 text-neutral-600 dark:text-neutral-400" />
                <div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Paged Notebook
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Standard A4 page format
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Notebook Document Options */}
          {boardMode === "notebook" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Sheet Grid & Layout
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "single" as PageLayout, label: "Single Column", desc: "1 sheet vertical" },
                    { id: "double" as PageLayout, label: "Facing Spread", desc: "Book spine center" },
                    { id: "horizontal" as PageLayout, label: "Horizontal Line", desc: "1 row left-to-right" },
                    { id: "grid-3" as PageLayout, label: "3 Columns Grid", desc: "3 sheets wide" },
                    { id: "grid-4" as PageLayout, label: "4 Columns Grid", desc: "4 sheets wide" },
                    { id: "grid-6" as PageLayout, label: "6 Columns Grid", desc: "6 sheets wide" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => onPageLayoutChange?.(opt.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        pageLayout === opt.id
                          ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                          : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Notebook Boundaries
                </label>
                <div
                  onClick={() => onClampToPagesChange(!clampToPages)}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Restrict Drawing to Pages
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
                    {isDesktop ? "Desktop Local-First" : "Web SaaS App"}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {isDesktop
                      ? "Boards are stored locally on your device"
                      : "Connected to collaboration server"}
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px] font-mono">
                {isDesktop ? "Desktop" : "Online"}
              </span>
            </div>
          </div>

          {/* Account */}
          {user && (
            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Account
              </label>
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs">
                <div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">
                    {user.name || "User"}
                  </div>
                  <div className="text-[11px] text-neutral-500">{user.email}</div>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
