import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  Share2,
  Copy,
  Check,
  Users,
  LogIn,
  Settings as SettingsIcon,
  PanelLeft,
  Columns,
  Square,
  Edit2,
  LayoutGrid,
} from "lucide-react";
import { User } from "../lib/api";
import { RemoteCursor } from "../lib/sync";
import { BoardMode, PaperStyle, PageLayout } from "../lib/storage";
import AppMenu from "./AppMenu";

interface BoardHeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  shareCode?: string;
  collaborators: RemoteCursor[];
  user: User | null;
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
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onClearCanvas: () => void;
  onExportPng: () => void;
  onExportWnb: () => void;
  onImportPdf: () => void;
}

export default function BoardHeader({
  title,
  onTitleChange,
  shareCode,
  collaborators,
  user,
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
  onOpenAuth,
  onOpenSettings,
  onClearCanvas,
  onExportPng,
  onExportWnb,
  onImportPdf,
}: BoardHeaderProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  const shareUrl =
    typeof window !== "undefined" && shareCode
      ? `${window.location.origin}${window.location.pathname}?join=${shareCode}`
      : "";

  function copyToClipboard(text: string, isLink: boolean) {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
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
            title="Toggle Page Sidebar"
          >
            <PanelLeft size={15} />
          </button>
        )}

        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-1 px-1.5 py-1 rounded text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Back to Whiteboards"
        >
          <ChevronLeft size={14} />
          <span>Boards</span>
        </button>

        <span className="text-neutral-300 dark:text-neutral-700">/</span>

        {/* Inline Editable Title */}
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
            className="px-1.5 py-0.5 text-xs font-semibold rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-400 max-w-xs"
          />
        ) : (
          <div
            onClick={() => setIsEditingTitle(true)}
            className="group flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors max-w-xs"
            title="Click to rename whiteboard"
          >
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
              {title || "Untitled"}
            </span>
            <Edit2
              size={11}
              className="text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            />
          </div>
        )}

        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
          {boardMode}
        </span>
      </div>

      {/* Center Section: Continuous Page & Layout Status (Notebook Mode) */}
      {boardMode === "notebook" && (
        <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-800/90 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-2xs">
          <span className="text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300 px-1">
            Page {currentPage} of {pageCount}
          </span>

          <div className="w-px h-3.5 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />

          {/* View mode toggle & layout menu */}
          <div className="relative" ref={layoutMenuRef}>
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="p-1 rounded text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-1"
              title="Change Sheet Grid & Layout"
            >
              {pageLayout === "single" ? (
                <Square size={13} />
              ) : pageLayout === "double" ? (
                <Columns size={13} />
              ) : (
                <LayoutGrid size={13} />
              )}
            </button>

            {showLayoutMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 top-8 z-50 min-w-[170px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl py-1 text-xs text-neutral-800 dark:text-neutral-200 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-800">
                  Sheet Layout
                </div>
                {[
                  { id: "single" as PageLayout, label: "Single Column", sub: "1 Sheet Wide" },
                  { id: "double" as PageLayout, label: "Facing Spread", sub: "Book Spine" },
                  { id: "horizontal" as PageLayout, label: "Horizontal Line", sub: "1 Long Row" },
                  { id: "grid-3" as PageLayout, label: "3 Columns Grid", sub: "3 Sheets Wide" },
                  { id: "grid-4" as PageLayout, label: "4 Columns Grid", sub: "4 Sheets Wide" },
                  { id: "grid-6" as PageLayout, label: "6 Columns Grid", sub: "6 Sheets Wide" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onPageLayoutChange(opt.id);
                      setShowLayoutMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                      pageLayout === opt.id
                        ? "font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                        : ""
                    }`}
                  >
                    <div>
                      <div>{opt.label}</div>
                      <div className="text-[10px] text-neutral-400 font-normal">{opt.sub}</div>
                    </div>
                    {pageLayout === opt.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Section: Collaborators, Share, Settings & Profile */}
      <div className="flex items-center gap-2">
        {collaborators.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs">
            <Users size={12} />
            <span>{collaborators.length + 1}</span>
            <div className="flex -space-x-1 ml-0.5">
              {collaborators.slice(0, 3).map((c) => (
                <span
                  key={c.id}
                  className="w-2 h-2 rounded-full border border-white dark:border-neutral-900"
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        )}

        {shareCode && (
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 text-xs font-medium transition-colors shadow-2xs"
          >
            <Share2 size={12} />
            <span>Share</span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Settings"
        >
          <SettingsIcon size={15} />
        </button>

        {user ? (
          <div
            className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center text-[10px] font-bold"
            title={user.name || user.email}
          >
            {(user.name || user.email).charAt(0).toUpperCase()}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Sign In"
          >
            <LogIn size={15} />
          </button>
        )}
      </div>

      {/* Share Modal Dialog */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Share Whiteboard
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Anyone with this share code or link can join and draw in real time without signing in.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                Share Code
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareCode}
                  className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 select-all"
                />
                <button
                  onClick={() => copyToClipboard(shareCode || "", false)}
                  className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors"
                  title="Copy Code"
                >
                  {copiedCode ? (
                    <Check size={14} className="text-neutral-900 dark:text-neutral-100" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>

            {shareUrl && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                  Direct Join Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 truncate select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(shareUrl, true)}
                    className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors"
                    title="Copy Link"
                  >
                    {copiedLink ? (
                      <Check size={14} className="text-neutral-900 dark:text-neutral-100" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full py-2 bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 text-xs font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
