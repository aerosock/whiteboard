import { useState, useEffect, useRef } from "react";
import {
  Trash2,
  Clock,
  LayoutGrid,
  FileText,
  Settings as SettingsIcon,
  FileUp,
  X,
  BookOpen,
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

export default function Dashboard({
  onOpenBoard,
  onOpenSettings,
}: DashboardProps) {
  const [localBoards, setLocalBoards] = useState<LocalBoard[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "notebook" | "infinite">("all");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified Create Board Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBoardMode, setNewBoardMode] = useState<BoardMode>("notebook");
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardPaper, setNewBoardPaper] = useState<PaperStyle>("lined");
  const [newBoardLayout, setNewBoardLayout] = useState<PageLayout>("single");

  useEffect(() => {
    setLocalBoards(getLocalBoards());
  }, []);

  function handleCreateBoard(
    mode: BoardMode,
    title?: string,
    paper?: PaperStyle,
    layout?: PageLayout,
  ) {
    const defaultTitle = mode === "notebook" ? "Untitled Notebook" : "Untitled Whiteboard";
    const finalTitle = title?.trim() || defaultTitle;
    const id = "b_" + Math.random().toString(36).slice(2, 10);

    const newBoard: LocalBoard = {
      id,
      title: finalTitle,
      mode,
      paperStyle: paper || (mode === "notebook" ? "lined" : "dots"),
      pageCount: 1,
      pageLayout: layout || "single",
      clampToPages: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveLocalBoard(newBoard);
    setLocalBoards(getLocalBoards());
    setIsCreateModalOpen(false);

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
    setLoadingMsg("Importing document...");

    try {
      if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
        setLoadingMsg("Rendering PDF pages for markup...");
        const { pageImages, pageCount } = await loadPdfPagesAsImages(
          file,
          (curr, total) => setLoadingMsg(`Rendering page ${curr} of ${total}...`),
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
        // .wnb or .json board package
        const imported = await importBoardPackage(file);
        saveLocalBoard(imported.board);
        // Save elements to localStorage key for this board
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
      setError(err.message || "Failed to import file");
    } finally {
      setLoadingMsg("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDeleteLocal(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this board?")) return;
    deleteLocalBoard(id);
    localStorage.removeItem(`wb_strokes_${id}`);
    localStorage.removeItem(`wb_images_${id}`);
    localStorage.removeItem(`wb_undo_${id}`);
    localStorage.removeItem(`wb_redo_${id}`);
    localStorage.removeItem(`wb_cam_${id}`);
    localStorage.removeItem(`wb_thumb_${id}`);
    setLocalBoards(getLocalBoards());
  }

  const filteredBoards = localBoards.filter((b) => {
    if (activeTab === "all") return true;
    return b.mode === activeTab;
  });

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col">
      {/* Hidden file input for .wnb / .pdf import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".wnb,.json,.pdf,application/pdf"
        onChange={handleFileInput}
        className="sr-only"
      />

      {/* Header */}
      <header data-tauri-drag-region className="px-6 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Whiteboard
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
            Local-First
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Import File Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors"
            title="Import .wnb board file or PDF document"
          >
            <FileUp size={14} />
            <span>Import Document</span>
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-8">
        {loadingMsg && (
          <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-700 dark:text-neutral-300 flex items-center gap-2.5 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-neutral-500 animate-ping" />
            <span>{loadingMsg}</span>
          </div>
        )}

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Create Notebook Card */}
          <div
            onClick={() => {
              setNewBoardTitle("");
              setNewBoardMode("notebook");
              setNewBoardPaper("lined");
              setNewBoardLayout("single");
              setIsCreateModalOpen(true);
            }}
            className="group p-5 rounded-xl bg-neutral-900 dark:bg-neutral-800 border border-neutral-800 dark:border-neutral-700 text-white shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-neutral-800 dark:bg-neutral-700 flex items-center justify-center text-white">
                <BookOpen size={18} />
              </div>
              <h3 className="text-base font-semibold tracking-tight text-white">
                New Notebook
              </h3>
              <p className="text-xs text-neutral-300 dark:text-neutral-300">
                A4 paginated notebook with lined, grid, or dot ruling for school notes and study sheets.
              </p>
            </div>
          </div>

          {/* Create Infinite Whiteboard Card */}
          <div
            onClick={() => handleCreateBoard("infinite")}
            className="group p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between space-y-4"
          >
            <div className="space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center">
                <LayoutGrid size={16} />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Infinite Whiteboard
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Unbounded 2D Euclidean canvas for freeform diagrams, mind maps, and sketches.
              </p>
            </div>
          </div>

          {/* Import Document Card */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between space-y-4"
          >
            <div className="space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center">
                <FileUp size={16} />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Import PDF / File
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Open multi-page PDF documents for handwritten markup or load .wnb notebook backups.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Boards List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-1">
              {[
                { id: "all", label: "All Boards" },
                { id: "notebook", label: "Notebooks" },
                { id: "infinite", label: "Infinite Canvases" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-neutral-400 font-mono">
              {filteredBoards.length} total
            </span>
          </div>

          {filteredBoards.length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 p-6 space-y-2">
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                No boards found
              </p>
              <p className="text-[11px] text-neutral-400">
                Create a Notebook or Infinite Canvas above, or import a PDF study material.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredBoards.map((b) => {
                const thumb = b.thumbnail || localStorage.getItem(`wb_thumb_${b.id}`);
                return (
                  <div
                    key={b.id}
                    onClick={() =>
                      onOpenBoard({
                        id: b.id,
                        title: b.title,
                        mode: b.mode,
                        pageLayout: b.pageLayout,
                      })
                    }
                    className="group relative p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail Preview */}
                      <div className="w-full h-32 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-800 overflow-hidden flex items-center justify-center mb-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={b.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-neutral-400">
                            {b.mode === "notebook" ? (
                              <FileText size={24} className="opacity-40" />
                            ) : (
                              <LayoutGrid size={24} className="opacity-40" />
                            )}
                            <span className="text-[10px] font-mono opacity-50">Empty Canvas</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {b.title}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 uppercase">
                          {b.mode}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-1">
                        <div className="flex items-center gap-1">
                          <Clock size={11} />
                          <span>{new Date(b.updatedAt).toLocaleDateString()}</span>
                        </div>
                        {b.mode === "notebook" && (
                          <span>• {b.pageCount || 1} {b.pageCount === 1 ? "page" : "pages"}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-100 dark:border-neutral-800 text-[11px]">
                      <span className="text-neutral-400 text-[10px] uppercase font-mono">
                        {b.paperStyle || "plain"}
                      </span>

                      <button
                        onClick={(e) => handleDeleteLocal(b.id, e)}
                        className="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        title="Delete Board"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Unified Create Board Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Create New Board
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-sm p-1"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Title
              </label>
              <input
                type="text"
                placeholder={newBoardMode === "notebook" ? "e.g. Physics Notes" : "e.g. Project Brainstorm"}
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                autoFocus
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewBoardMode("notebook")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    newBoardMode === "notebook"
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  <BookOpen size={13} />
                  <span>Notebook (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewBoardMode("infinite")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    newBoardMode === "infinite"
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  <LayoutGrid size={13} />
                  <span>Infinite Canvas</span>
                </button>
              </div>
            </div>

            {newBoardMode === "notebook" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Paper Grid
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["lined", "grid", "dots", "blank"] as PaperStyle[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewBoardPaper(p)}
                      className={`py-1.5 rounded-lg border text-xs capitalize transition-colors ${
                        newBoardPaper === p
                          ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold"
                          : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => handleCreateBoard(newBoardMode, newBoardTitle, newBoardPaper, newBoardLayout)}
              className="w-full py-2 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Create {newBoardMode === "notebook" ? "Notebook" : "Whiteboard"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
