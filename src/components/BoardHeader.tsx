import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  Settings as SettingsIcon,
  PanelLeft,
  Columns,
  Square,
  Edit2,
  LayoutGrid,
} from "lucide-react";
import { BoardMode, PaperStyle, PageLayout } from "../lib/storage";
import AppMenu from "./AppMenu";

interface BoardHeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  boardMode: BoardMode;
  onBoardModeChange: (mode: BoardMode) => void;
  paperStyle: PaperStyle;
  onPaperStyleChange: (style: PaperStyle) => void;
  currentPage: number;
  pageCount: number;
  pageLayout: PageLayout;
  onPageLayoutChange: (layout: PageLayout) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onBackToDashboard: () => void;
  onOpenSettings: () => void;
  onClearCanvas: () => void;
  onExportPng: () => void;
  onExportWnb: () => void;
  onImportPdf: () => void;
}

export default function BoardHeader({
  title,
  onTitleChange,
  boardMode,
  onBoardModeChange,
  paperStyle,
  onPaperStyleChange,
  currentPage,
  pageCount,
  pageLayout,
  onPageLayoutChange,
  isSidebarOpen,
  onToggleSidebar,
  onBackToDashboard,
  onOpenSettings,
  onClearCanvas,
  onExportPng,
  onExportWnb,
  onImportPdf,
}: BoardHeaderProps) {
  // Layout dropdown menu state
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  // Inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleGlobalClick(e: MouseEvent) {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
    }
    window.addEventListener("pointerdown", handleGlobalClick);
    return () => window.removeEventListener("pointerdown", handleGlobalClick);
  }, []);

  useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  function handleCommitTitle() {
    setIsEditingTitle(false);
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed);
    } else {
      setEditedTitle(title);
    }
  }

  return (
    <header data-tauri-drag-region className="px-3 py-1.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 select-none flex-shrink-0 z-20">
      {/* Left Section: App Menu + Sidebar Toggle + Dashboard Button + Title */}
      <div className="flex items-center gap-1.5">
        <AppMenu
          boardMode={boardMode}
          onBoardModeChange={onBoardModeChange}
          paperStyle={paperStyle}
          onPaperStyleChange={onPaperStyleChange}
          onOpenSettings={onOpenSettings}
          onBackToDashboard={onBackToDashboard}
          onClearCanvas={onClearCanvas}
          onExportPng={onExportPng}
          onExportWnb={onExportWnb}
          onImportPdf={onImportPdf}
        />

        {boardMode === "notebook" && (
          <button
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-lg transition-colors ${
              isSidebarOpen
                ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
            title={isSidebarOpen ? "Close Page Manager (Ctrl+\\)" : "Open Page Manager (Ctrl+\\)"}
          >
            <PanelLeft size={15} />
          </button>
        )}

        <button
          onClick={onBackToDashboard}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Back to All Notes"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Editable Board Title */}
        <div className="flex items-center ml-1">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleCommitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCommitTitle();
                if (e.key === "Escape") {
                  setEditedTitle(title);
                  setIsEditingTitle(false);
                }
              }}
              className="px-2 py-0.5 text-xs font-semibold rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none w-48 shadow-2xs"
            />
          ) : (
            <div
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center gap-1.5 px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
              title="Click to rename"
            >
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[220px]">
                {title || (boardMode === "notebook" ? "Untitled Notebook" : "Untitled Whiteboard")}
              </span>
              <Edit2
                size={11}
                className="opacity-0 group-hover:opacity-40 text-neutral-500 transition-opacity"
              />
            </div>
          )}
        </div>
      </div>

      {/* Middle Section: Notebook Mode Controls */}
      {boardMode === "notebook" && (
        <div className="flex items-center gap-2">
          {/* Page Indicator */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 text-xs font-medium">
            <span>Page</span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {currentPage}
            </span>
            <span className="text-neutral-400">/</span>
            <span>{pageCount}</span>
          </div>

          {/* Page Layout Selector Dropdown */}
          <div className="relative" ref={layoutMenuRef}>
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs transition-colors"
              title="Change Page Layout & Grid Structure"
            >
              {pageLayout === "single" && <Square size={13} />}
              {pageLayout === "double" && <Columns size={13} />}
              {pageLayout === "horizontal" && <Columns size={13} className="rotate-90" />}
              {pageLayout.startsWith("grid") && <LayoutGrid size={13} />}
              <span className="capitalize text-[11px] font-medium">{pageLayout}</span>
            </button>

            {showLayoutMenu && (
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 w-44 py-1 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-800 text-xs z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold border-b border-neutral-100 dark:border-neutral-800/60">
                  Page Layout
                </div>
                {[
                  { id: "single", label: "Single Page", sub: "Standard notebook view" },
                  { id: "double", label: "2-Page Spread", sub: "Book side-by-side" },
                  { id: "horizontal", label: "Horizontal Strip", sub: "Wide banner continuous" },
                  { id: "grid-4", label: "2×2 Grid (4-up)", sub: "Slide comparison" },
                  { id: "grid-6", label: "2×3 Grid (6-up)", sub: "Exam summary view" },
                  { id: "grid-3", label: "3-Column Strip", sub: "Multi-subject layout" },
                ].map((opt: any) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onPageLayoutChange(opt.id);
                      setShowLayoutMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                      pageLayout === opt.id
                        ? "font-semibold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800"
                        : ""
                    }`}
                  >
                    <div>
                      <div>{opt.label}</div>
                      <div className="text-[10px] text-neutral-400 font-normal">{opt.sub}</div>
                    </div>
                    {pageLayout === opt.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Section: Settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Settings"
        >
          <SettingsIcon size={15} />
        </button>
      </div>
    </header>
  );
}
