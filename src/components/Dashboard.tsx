import { useState, useEffect, useRef } from "react";
import {
  Trash2,
  LayoutGrid,
  Settings as SettingsIcon,
  FileUp,
  X,
  Plus,
  Search,
  Check,
  ChevronDown,
  Edit2,
} from "lucide-react";
import {
  BoardMode,
  LocalBoard,
  getLocalBoards,
  saveLocalBoard,
  deleteLocalBoard,
  PageLayout,
  PaperStyle,
} from "../lib/storage";
import { importBoardPackage, loadPdfPagesAsImages } from "../lib/document";

interface DashboardProps {
  onOpenBoard: (board: {
    id: string;
    title: string;
    mode: BoardMode;
    pageLayout?: PageLayout;
  }) => void;
  onOpenSettings: () => void;
}

const PAPER_SWATCHES: { id: PaperStyle; label: string }[] = [
  { id: "lined", label: "Lined" },
  { id: "grid", label: "Grid" },
  { id: "dots", label: "Dots" },
  { id: "blank", label: "Blank" },
];

const LAYOUT_PRESETS: { id: PageLayout; label: string }[] = [
  { id: "single", label: "Single Page" },
  { id: "double", label: "2-Page Spread" },
  { id: "horizontal", label: "Horizontal Strip" },
  { id: "grid-4", label: "2×2 Grid" },
];

export const MIN_PAGES_FOR_LAYOUT: Record<PageLayout, number> = {
  single: 1,
  double: 2,
  horizontal: 2,
  "grid-3": 3,
  "grid-4": 4,
  "grid-6": 6,
};

function MacroPaperGraphic({ style }: { style: PaperStyle }) {
  if (style === "lined") {
    return (
      <svg viewBox="0 0 20 20" className="w-5 h-5 pointer-events-none select-none">
        {/* Red margin line on left */}
        <line x1="5.5" y1="2" x2="5.5" y2="18" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        {/* Close-up ruled lines */}
        <line x1="2" y1="5.5" x2="18" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
        <line x1="2" y1="10.5" x2="18" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
        <line x1="2" y1="15.5" x2="18" y2="15.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
      </svg>
    );
  }
  if (style === "grid") {
    return (
      <svg viewBox="0 0 20 20" className="w-5 h-5 pointer-events-none select-none">
        {/* 2x2 close-up graph grid cells */}
        <line x1="6.5" y1="2" x2="6.5" y2="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
        <line x1="13.5" y1="2" x2="13.5" y2="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
        <line x1="2" y1="6.5" x2="18" y2="6.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
        <line x1="2" y1="13.5" x2="18" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
      </svg>
    );
  }
  if (style === "dots") {
    return (
      <svg viewBox="0 0 20 20" className="w-5 h-5 pointer-events-none select-none">
        {/* 3x3 close-up bullet journal dots */}
        <circle cx="4.5" cy="4.5" r="1.5" fill="currentColor" fillOpacity="0.65" />
        <circle cx="10" cy="4.5" r="1.5" fill="currentColor" fillOpacity="0.65" />
        <circle cx="15.5" cy="4.5" r="1.5" fill="currentColor" fillOpacity="0.65" />
        <circle cx="4.5" cy="10" r="1.5" fill="currentColor" fillOpacity="0.65" />
        <circle cx="10" cy="10" r="1.5" fill="currentColor" fillOpacity="0.65" />
        <circle cx="15.5" cy="10" r="1.5" fill="currentColor" fillOpacity="0.65" />
        <circle cx="4.5" cy="15.5" r="1.5" fill="currentColor" fillOpacity="0.65" />
        <circle cx="10" cy="15.5" r="1.5" fill="currentColor" fillOpacity="0.65" />
        <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" fillOpacity="0.65" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="w-5 h-5 pointer-events-none select-none">
      <rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
    </svg>
  );
}

export default function Dashboard({
  onOpenBoard,
  onOpenSettings,
}: DashboardProps) {
  const [localBoards, setLocalBoards] = useState<LocalBoard[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "notebook" | "infinite">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Quick-create dock state
  const [selectedPaper, setSelectedPaper] = useState<PaperStyle>("lined");
  const [selectedLayout, setSelectedLayout] = useState<PageLayout>("single");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Card inline actions state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalBoards(getLocalBoards());
  }, []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsPopoverOpen(false);
      }
    }
    window.addEventListener("pointerdown", handleOutsideClick);
    return () => window.removeEventListener("pointerdown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  function handleCreateBoard(
    mode: BoardMode,
    title?: string,
    paper?: PaperStyle,
    layout?: PageLayout,
  ) {
    const defaultTitle = mode === "notebook" ? "Untitled Notebook" : "Untitled Canvas";
    const finalTitle = title?.trim() || defaultTitle;
    const finalLayout = layout || selectedLayout;
    const minPages = mode === "notebook" ? (MIN_PAGES_FOR_LAYOUT[finalLayout] || 1) : 1;
    const id = "b_" + Math.random().toString(36).slice(2, 10);

    const newBoard: LocalBoard = {
      id,
      title: finalTitle,
      mode,
      paperStyle: paper || (mode === "notebook" ? selectedPaper : "dots"),
      pageCount: minPages,
      pageLayout: finalLayout,
      clampToPages: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveLocalBoard(newBoard);
    setLocalBoards(getLocalBoards());
    setIsPopoverOpen(false);
    setCustomTitle("");

    onOpenBoard({
      id: newBoard.id,
      title: newBoard.title,
      mode: newBoard.mode,
      pageLayout: newBoard.pageLayout,
    });
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setLoadingMsg("Importing...");

    try {
      if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
        const { pageImages, pageCount } = await loadPdfPagesAsImages(
          file,
          (curr, total) => setLoadingMsg(`Page ${curr}/${total}`),
        );

        const pageBackgrounds: Record<number, string> = {};
        pageImages.forEach((img, idx) => {
          pageBackgrounds[idx + 1] = img;
        });

        const id = "b_" + Math.random().toString(36).slice(2, 10);
        const title = file.name.replace(/\.pdf$/i, "");

        const newBoard: LocalBoard = {
          id,
          title,
          mode: "notebook",
          paperStyle: "blank",
          pageCount,
          pageLayout: "single",
          pageBackgrounds,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        saveLocalBoard(newBoard);
        setLocalBoards(getLocalBoards());
        onOpenBoard({
          id: newBoard.id,
          title: newBoard.title,
          mode: newBoard.mode,
          pageLayout: newBoard.pageLayout,
        });
      } else {
        const imported = await importBoardPackage(file);
        saveLocalBoard(imported.board);
        localStorage.setItem(`wb_strokes_${imported.board.id}`, JSON.stringify(imported.strokes));
        localStorage.setItem(`wb_images_${imported.board.id}`, JSON.stringify(imported.images));
        setLocalBoards(getLocalBoards());
        onOpenBoard({
          id: imported.board.id,
          title: imported.board.title,
          mode: imported.board.mode,
          pageLayout: imported.board.pageLayout,
        });
      }
    } catch (err: any) {
      setError(err.message || "Import failed");
    } finally {
      setLoadingMsg("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function purgeBoardStorage(id: string) {
    deleteLocalBoard(id);
    localStorage.removeItem(`wb_strokes_${id}`);
    localStorage.removeItem(`wb_images_${id}`);
    localStorage.removeItem(`wb_undo_${id}`);
    localStorage.removeItem(`wb_redo_${id}`);
    localStorage.removeItem(`wb_cam_${id}`);
    localStorage.removeItem(`wb_thumb_${id}`);
  }

  function handleDeleteBoard(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    purgeBoardStorage(id);
    setConfirmDeleteId(null);
    setLocalBoards(getLocalBoards());
  }

  function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    selectedIds.forEach((id) => purgeBoardStorage(id));
    setSelectedIds(new Set());
    setIsSelectMode(false);
    setLocalBoards(getLocalBoards());
  }

  function toggleSelectBoard(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCommitRename(board: LocalBoard) {
    const trimmed = editingTitle.trim();
    if (trimmed && trimmed !== board.title) {
      saveLocalBoard({ ...board, title: trimmed, updatedAt: Date.now() });
      setLocalBoards(getLocalBoards());
    }
    setEditingBoardId(null);
  }

  const notebookCount = localBoards.filter((b) => b.mode === "notebook").length;
  const infiniteCount = localBoards.filter((b) => b.mode === "infinite").length;

  const filteredBoards = localBoards.filter((b) => {
    if (activeTab !== "all" && b.mode !== activeTab) return false;
    if (searchQuery.trim()) {
      return b.title.toLowerCase().includes(searchQuery.trim().toLowerCase());
    }
    return true;
  });

  return (
    <div
      className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col select-none"
      onClick={() => {
        if (confirmDeleteId) setConfirmDeleteId(null);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".wnb,.json,.pdf,application/pdf"
        onChange={handleFileInput}
        className="sr-only"
      />

      {/* Unified Top Command & Creation Bar */}
      <header
        data-tauri-drag-region
        className="sticky top-0 z-30 px-4 md:px-6 py-2.5 bg-white dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
      >
        {/* Left: Segmented Filter Tabs */}
        <div className="flex items-center p-0.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
          {[
            { id: "all", label: "All", count: localBoards.length },
            { id: "notebook", label: "Notebooks", count: notebookCount },
            { id: "infinite", label: "Canvas", count: infiniteCount },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  active
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono tabular-nums ${
                    active ? "text-neutral-600 dark:text-neutral-400 font-bold" : "text-neutral-400"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Center: Interactive Creation Studio Dock */}
        <div
          ref={popoverRef}
          className="relative flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 gap-1.5"
        >
          {/* Notebook Split-Capsule: Theme-Governed Create + Closeup Macro Paper Swatches */}
          <div className="flex items-center bg-white dark:bg-neutral-900 rounded-lg border border-neutral-300 dark:border-neutral-700 p-0.5 shadow-2xs">
            <button
              onClick={() => handleCreateBoard("notebook", undefined, selectedPaper, selectedLayout)}
              className="h-7.5 px-3 rounded-md bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border border-[var(--btn-primary-border)] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all shadow-2xs"
              title={`Create ${selectedPaper} notebook`}
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Notebook</span>
            </button>

            {/* Close-Up Macro Paper Ruling Swatches */}
            <div className="flex items-center gap-1 px-1.5 border-l border-neutral-300 dark:border-neutral-700 ml-1.5">
              {PAPER_SWATCHES.map((s) => {
                const isSelected = selectedPaper === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedPaper(s.id)}
                    title={`${s.label} paper`}
                    className={`w-7 h-7.5 rounded-md flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-neutral-200/90 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 ring-2 ring-neutral-900 dark:ring-neutral-100 shadow-xs"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <MacroPaperGraphic style={s.id} />
                  </button>
                );
              })}
            </div>

            {/* Expandable Custom Notebook Setup Trigger */}
            <button
              type="button"
              onClick={() => setIsPopoverOpen(!isPopoverOpen)}
              className={`w-6 h-7.5 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                isPopoverOpen ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" : ""
              }`}
              title="Notebook layout & title options"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* 1-Tap Infinite Canvas */}
          <button
            onClick={() => handleCreateBoard("infinite")}
            className="h-8 px-3 rounded-lg hover:bg-white dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-[0.98]"
            title="New Infinite Canvas"
          >
            <Plus size={13} className="text-neutral-500" />
            <span>Canvas</span>
          </button>

          <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700" />

          {/* 1-Tap PDF / .wnb Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-3 rounded-lg hover:bg-white dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-[0.98]"
            title="Import PDF or .wnb file"
          >
            <FileUp size={13} className="text-neutral-500" />
            <span>Import</span>
          </button>

          {/* Anchored Popover for Title & Page Layout */}
          {isPopoverOpen && (
            <div className="absolute top-full mt-2 left-0 w-72 p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 shadow-xl z-50 space-y-3 animate-in fade-in zoom-in-95 duration-100">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                  Notebook Title
                </label>
                <input
                  type="text"
                  placeholder="Untitled Notebook"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateBoard("notebook", customTitle, selectedPaper, selectedLayout);
                    }
                  }}
                  autoFocus
                  className="w-full h-8 px-2.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                  Paper Ruling
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {PAPER_SWATCHES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPaper(p.id)}
                      className={`h-8 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        selectedPaper === p.id
                          ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold"
                          : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <MacroPaperGraphic style={p.id} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                  Page Layout (Pre-creates pages)
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {LAYOUT_PRESETS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedLayout(l.id)}
                      className={`h-7 px-2 rounded-lg border text-[11px] font-medium transition-colors ${
                        selectedLayout === l.id
                          ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold"
                          : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCreateBoard("notebook", customTitle, selectedPaper, selectedLayout)}
                className="w-full h-8 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border border-[var(--btn-primary-border)] text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Create Notebook
              </button>
            </div>
          )}
        </div>

        {/* Right: Search, Batch Select, Settings */}
        <div className="flex items-center gap-1.5">
          {isSearchOpen ? (
            <div className="flex items-center h-9 px-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 gap-1.5">
              <Search size={13} className="text-neutral-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }
                }}
                className="w-28 sm:w-36 bg-transparent text-xs outline-none text-neutral-900 dark:text-neutral-100"
              />
              <button
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Search"
            >
              <Search size={15} />
            </button>
          )}

          {localBoards.length > 0 && (
            <>
              {isSelectMode && selectedIds.size > 0 && (
                <button
                  onClick={handleBatchDelete}
                  className="h-9 px-3 rounded-xl bg-red-600 text-white text-xs font-medium flex items-center gap-1.5 hover:bg-red-700 transition-colors"
                >
                  <Trash2 size={13} />
                  <span>Delete ({selectedIds.size})</span>
                </button>
              )}
              <button
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  setSelectedIds(new Set());
                }}
                className={`h-9 px-2.5 rounded-xl text-xs font-medium transition-colors ${
                  isSelectMode
                    ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
                title="Select multiple boards"
              >
                {isSelectMode ? "Done" : "Select"}
              </button>
            </>
          )}

          <button
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-5 md:p-6 space-y-4">
        {loadingMsg && (
          <div className="px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs font-mono text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neutral-500 animate-ping" />
            <span>{loadingMsg}</span>
          </div>
        )}

        {error && (
          <div className="px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")}>
              <X size={14} />
            </button>
          </div>
        )}

        {filteredBoards.length === 0 ? (
          <div className="py-20 text-center rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 p-6">
            <p className="text-xs font-mono text-neutral-500">
              {searchQuery ? "No matching boards" : "Empty workspace"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredBoards.map((b) => {
              const thumb = b.thumbnail || localStorage.getItem(`wb_thumb_${b.id}`);
              const isSelected = selectedIds.has(b.id);
              const isConfirmingDelete = confirmDeleteId === b.id;
              const isEditingThis = editingBoardId === b.id;

              return (
                <div
                  key={b.id}
                  onClick={() => {
                    if (isEditingThis) return;
                    if (isSelectMode) {
                      toggleSelectBoard(b.id);
                      return;
                    }
                    onOpenBoard({
                      id: b.id,
                      title: b.title,
                      mode: b.mode,
                      pageLayout: b.pageLayout,
                    });
                  }}
                  className={`group relative p-2.5 rounded-xl bg-white dark:bg-neutral-900 border shadow-xs transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-neutral-900 dark:border-neutral-100 ring-2 ring-neutral-900 dark:ring-neutral-100"
                      : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-500 dark:hover:border-neutral-500 hover:shadow-sm"
                  }`}
                >
                  {/* Multi-select Checkbox Overlay */}
                  {isSelectMode && (
                    <div
                      className={`absolute top-4 right-4 z-20 w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-neutral-900 dark:bg-neutral-100 border-neutral-900 dark:border-neutral-100 text-white dark:text-neutral-900"
                          : "bg-white/90 dark:bg-neutral-900/90 border-neutral-400 dark:border-neutral-500"
                      }`}
                    >
                      {isSelected && <Check size={13} strokeWidth={2.5} />}
                    </div>
                  )}

                  {/* Document / Canvas Preview with Crisp Outer Border */}
                  <div className="w-full h-44 rounded-lg bg-neutral-100/90 dark:bg-neutral-800/60 border border-neutral-300/80 dark:border-neutral-700/90 p-2.5 flex items-center justify-center mb-2.5 relative overflow-hidden">
                    {b.mode === "notebook" ? (
                      <div className="relative h-full aspect-[800/1130] flex items-center justify-center">
                        {b.pageCount && b.pageCount > 1 ? (
                          <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-[2px] bg-neutral-200/90 dark:bg-neutral-700/60 border border-neutral-400/60 dark:border-neutral-600/60 -z-10 shadow-2xs" />
                        ) : null}
                        {b.pageCount && b.pageCount > 2 ? (
                          <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[2px] bg-neutral-300/60 dark:bg-neutral-700/30 border border-neutral-400/40 dark:border-neutral-600/30 -z-20" />
                        ) : null}

                        <div
                          className="w-full h-full rounded-[2px] border border-neutral-300 dark:border-neutral-700 shadow-xs overflow-hidden flex items-center justify-center relative"
                          style={{ backgroundColor: "var(--paper-bg, #ffffff)" }}
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={b.title}
                              className="w-full h-full object-contain pointer-events-none select-none"
                            />
                          ) : (
                            <div className="w-full h-full relative overflow-hidden">
                              {b.paperStyle === "lined" && (
                                <div className="w-full h-full relative pointer-events-none">
                                  <div className="absolute top-0 bottom-0 left-[14%] w-px bg-red-400/50" />
                                  <div
                                    className="w-full h-full"
                                    style={{
                                      backgroundImage:
                                        "linear-gradient(to bottom, transparent 90%, rgba(148, 163, 184, 0.35) 90%)",
                                      backgroundSize: "100% 9px",
                                    }}
                                  />
                                </div>
                              )}
                              {b.paperStyle === "grid" && (
                                <div
                                  className="w-full h-full pointer-events-none"
                                  style={{
                                    backgroundImage:
                                      "linear-gradient(to right, rgba(148, 163, 184, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.3) 1px, transparent 1px)",
                                    backgroundSize: "9px 9px",
                                  }}
                                />
                              )}
                              {b.paperStyle === "dots" && (
                                <div
                                  className="w-full h-full pointer-events-none"
                                  style={{
                                    backgroundImage:
                                      "radial-gradient(rgba(148, 163, 184, 0.5) 1px, transparent 1px)",
                                    backgroundSize: "8px 8px",
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="w-full h-full rounded-md border border-neutral-300 dark:border-neutral-700 shadow-xs overflow-hidden flex items-center justify-center relative"
                        style={{ backgroundColor: "var(--paper-bg, #ffffff)" }}
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={b.title}
                            className="w-full h-full object-contain p-1 pointer-events-none select-none"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-600"
                            style={{
                              backgroundImage:
                                "radial-gradient(rgba(148, 163, 184, 0.4) 1px, transparent 1px)",
                              backgroundSize: "10px 10px",
                            }}
                          >
                            <LayoutGrid size={18} className="opacity-60" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Compact High-Density Card Footer */}
                  <div className="px-0.5 space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      {isEditingThis ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => handleCommitRename(b)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCommitRename(b);
                            if (e.key === "Escape") setEditingBoardId(null);
                          }}
                          autoFocus
                          className="w-full px-1.5 py-0.5 text-xs font-semibold rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-400 dark:border-neutral-600 outline-none"
                        />
                      ) : (
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {b.title}
                          </h4>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBoardId(b.id);
                              setEditingTitle(b.title);
                            }}
                            className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Rename"
                          >
                            <Edit2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                      <div className="flex items-center gap-1.5 truncate">
                        <span>
                          {new Date(b.updatedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span>·</span>
                        {b.mode === "notebook" ? (
                          <span>
                            {b.pageCount || 1}p · {b.paperStyle || "lined"}
                          </span>
                        ) : (
                          <span>canvas</span>
                        )}
                      </div>

                      {!isSelectMode && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteBoard(b.id, e)}
                          className={`h-6 px-1.5 rounded flex items-center gap-1 text-[10px] font-sans font-medium transition-colors ${
                            isConfirmingDelete
                              ? "bg-red-600 text-white"
                              : "text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          }`}
                          title={isConfirmingDelete ? "Tap again to delete" : "Delete"}
                        >
                          <Trash2 size={12} />
                          {isConfirmingDelete && <span>Delete?</span>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
