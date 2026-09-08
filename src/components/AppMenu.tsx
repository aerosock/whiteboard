import { useState, useRef, useEffect } from "react";
import {
  Menu,
  LayoutGrid,
  FileText,
  Settings,
  Download,
  Trash2,
  ChevronRight,
  FolderOpen,
  Check,
  FileUp,
  Package,
} from "lucide-react";
import { BoardMode, PaperStyle } from "../lib/storage";

interface AppMenuProps {
  boardMode: BoardMode;
  onBoardModeChange: (mode: BoardMode) => void;
  paperStyle: PaperStyle;
  onPaperStyleChange: (style: PaperStyle) => void;
  onOpenSettings: () => void;
  onBackToDashboard: () => void;
  onClearCanvas: () => void;
  onExportPng: () => void;
  onExportWnb: () => void;
  onImportPdf: () => void;
}

export default function AppMenu({
  boardMode,
  onBoardModeChange,
  paperStyle,
  onPaperStyleChange,
  onOpenSettings,
  onBackToDashboard,
  onClearCanvas,
  onExportPng,
  onExportWnb,
  onImportPdf,
}: AppMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPaperSubmenu, setShowPaperSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowPaperSubmenu(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        title="Application Menu"
      >
        <Menu size={16} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl py-1.5 text-xs text-neutral-700 dark:text-neutral-300 z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Dashboard */}
          <button
            onClick={() => {
              setIsOpen(false);
              onBackToDashboard();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
          >
            <FolderOpen size={14} className="text-neutral-400" />
            <span>All Whiteboards</span>
          </button>

          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

          {/* Switch Mode */}
          <button
            onClick={() => {
              onBoardModeChange(boardMode === "infinite" ? "notebook" : "infinite");
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              {boardMode === "infinite" ? (
                <FileText size={14} className="text-neutral-400" />
              ) : (
                <LayoutGrid size={14} className="text-neutral-400" />
              )}
              <span>Switch to {boardMode === "infinite" ? "Notebook" : "Infinite"}</span>
            </div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase">
              {boardMode}
            </span>
          </button>

          {/* Paper Style */}
          <div className="relative">
            <button
              onClick={() => setShowPaperSubmenu(!showPaperSubmenu)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded border border-neutral-400 flex items-center justify-center text-[9px] font-mono">
                  #
                </div>
                <span>Paper Style</span>
              </div>
              <ChevronRight size={13} className="text-neutral-400" />
            </button>

            {showPaperSubmenu && (
              <div className="pl-8 pr-2 py-1 space-y-0.5 bg-neutral-50 dark:bg-neutral-950/60 border-y border-neutral-100 dark:border-neutral-800">
                {(["dots", "lined", "grid", "blank"] as PaperStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => {
                      onPaperStyleChange(style);
                      setShowPaperSubmenu(false);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left capitalize ${
                      paperStyle === style
                        ? "font-medium text-neutral-900 dark:text-neutral-100 bg-neutral-200/60 dark:bg-neutral-800/60"
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span>{style === "dots" ? "Dot Grid" : style}</span>
                    {paperStyle === style && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

          {/* Import PDF Document */}
          <button
            onClick={() => {
              setIsOpen(false);
              onImportPdf();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
          >
            <FileUp size={14} className="text-neutral-400" />
            <span>Open & Mark up PDF</span>
          </button>

          {/* Export as .wnb Portable File */}
          <button
            onClick={() => {
              setIsOpen(false);
              onExportWnb();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
          >
            <Package size={14} className="text-neutral-400" />
            <span>Export File (.wnb)</span>
          </button>

          {/* Export PNG */}
          <button
            onClick={() => {
              setIsOpen(false);
              onExportPng();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
          >
            <Download size={14} className="text-neutral-400" />
            <span>Export as PNG</span>
          </button>

          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

          {/* Clear Canvas */}
          <button
            onClick={() => {
              setIsOpen(false);
              onClearCanvas();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-red-600 dark:text-red-400 transition-colors text-left"
          >
            <Trash2 size={14} />
            <span>Clear Canvas</span>
          </button>

          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

          {/* Settings */}
          <button
            onClick={() => {
              setIsOpen(false);
              onOpenSettings();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
          >
            <Settings size={14} className="text-neutral-400" />
            <span>Settings</span>
          </button>
        </div>
      )}
    </div>
  );
}
