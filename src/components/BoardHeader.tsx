import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Settings as SettingsIcon,
  PanelLeft,
  Columns,
  Square,
  Edit2,
  LayoutGrid,
  Plus,
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
  onSelectPage?: (page: number) => void;
  onAddPage?: () => void;
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

const PAGE_LAYOUT_ITEMS: { id: PageLayout; label: string }[] = [
  { id: "single", label: "Single Page" },
  { id: "double", label: "2-Page Spread" },
  { id: "horizontal", label: "Horizontal Strip" },
  { id: "grid-3", label: "3-Column Grid" },
  { id: "grid-4", label: "4-Column Grid" },
  { id: "grid-6", label: "6-Column Grid" },
];

export default function BoardHeader({
  title,
  onTitleChange,
  boardMode,
  onBoardModeChange,
  paperStyle,
  onPaperStyleChange,
  currentPage,
  pageCount,
  onSelectPage,
  onAddPage,
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
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

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
    <header
      data-tauri-drag-region
      className="px-3 py-1.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 select-none flex-shrink-0 z-20"
    >
      {/* Left: Back, Sidebar, Menu, Title */}
      <div className="flex items-center gap-1">
        <button
          onClick={onBackToDashboard}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="All Boards"
        >
          <ChevronLeft size={17} />
        </button>

        {boardMode === "notebook" && (
          <button
            onClick={onToggleSidebar}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isSidebarOpen
                ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
            title={isSidebarOpen ? "Hide Pages (Ctrl+\\)" : "Show Pages (Ctrl+\\)"}
          >
            <PanelLeft size={15} />
          </button>
        )}

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
              className="h-7 px-2 text-xs font-semibold rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none w-44"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="group h-8 flex items-center gap-1.5 px-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Rename"
            >
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[200px]">
                {title || (boardMode === "notebook" ? "Untitled Notebook" : "Untitled Canvas")}
              </span>
              <Edit2
                size={11}
                className="opacity-0 group-hover:opacity-50 text-neutral-500 transition-opacity"
              />
            </button>
          )}
        </div>
      </div>

      {/* Center: Touch-Friendly Notebook Page Controls */}
      {boardMode === "notebook" && (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center h-8 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-700/60">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onSelectPage?.(Math.max(1, currentPage - 1))}
              className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <div className="px-2 text-xs font-mono tabular-nums text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {currentPage}
              </span>
              <span className="text-neutral-400">/</span>
              <span>{pageCount}</span>
            </div>

            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => onSelectPage?.(Math.min(pageCount, currentPage + 1))}
              className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>

            {onAddPage && (
              <>
                <div className="w-px h-4 bg-neutral-300/70 dark:bg-neutral-700 mx-0.5" />
                <button
                  type="button"
                  onClick={onAddPage}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-900 transition-colors"
                  title="New Page"
                >
                  <Plus size={14} />
                </button>
              </>
            )}
          </div>

          {/* Page Layout Dropdown */}
          <div className="relative" ref={layoutMenuRef}>
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs transition-colors border border-neutral-200/70 dark:border-neutral-700/60"
              title="Page Layout"
            >
              {pageLayout === "single" && <Square size={13} />}
              {pageLayout === "double" && <Columns size={13} />}
              {pageLayout === "horizontal" && <Columns size={13} className="rotate-90" />}
              {pageLayout.startsWith("grid") && <LayoutGrid size={13} />}
              <span className="capitalize text-[11px] font-medium">{pageLayout}</span>
            </button>

            {showLayoutMenu && (
              <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 w-40 py-1 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 text-xs z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                {PAGE_LAYOUT_ITEMS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onPageLayoutChange(opt.id);
                      setShowLayoutMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                      pageLayout === opt.id
                        ? "font-semibold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800"
                        : "text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <span>{opt.label}</span>
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

      {/* Right: Settings */}
      <div className="flex items-center">
        <button
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Settings"
        >
          <SettingsIcon size={15} />
        </button>
      </div>
    </header>
  );
}
