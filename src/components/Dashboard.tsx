import { useState, useEffect, useRef } from "react";
import {
  Trash2,
  Share2,
  LogIn,
  LogOut,
  Clock,
  LayoutGrid,
  FileText,
  Settings as SettingsIcon,
  HardDrive,
  Cloud,
  FileUp,
  Plus,
  X,
} from "lucide-react";
import { api, Board, User } from "../lib/api";
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
  user: User | null;
  onOpenBoard: (board: {
    id: string;
    title: string;
    mode: BoardMode;
    pageLayout?: PageLayout;
    shareCode?: string;
    synced: boolean;
  }) => void;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export default function Dashboard({
  user,
  onOpenBoard,
  onOpenAuth,
  onOpenSettings,
  onLogout,
}: DashboardProps) {
  const [localBoards, setLocalBoards] = useState<LocalBoard[]>([]);
  const [cloudBoards, setCloudBoards] = useState<Board[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "infinite" | "notebook">("all");
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
    if (user) {
      loadCloudBoards();
    } else {
      setCloudBoards([]);
    }
  }, [user]);

  async function loadCloudBoards() {
    try {
      const data = await api.getBoards();
      setCloudBoards(data.owned || []);
    } catch (err: any) {
      console.log("Could not load cloud boards:", err.message);
    }
  }

  function handleCreateBoard(
    mode: BoardMode,
    title?: string,
    paper?: PaperStyle,
    layout?: PageLayout,
  ) {
    const defaultTitle = mode === "notebook" ? "Untitled Notebook" : "Untitled Whiteboard";
    const finalTitle = title?.trim() || defaultTitle;
    const id = "b_" + Math.random().toString(36).slice(2, 10);
    const code = Math.random().toString(36).slice(2, 8);

    const newBoard: LocalBoard = {
      id,
      title: finalTitle,
      mode,
      paperStyle: paper || (mode === "notebook" ? "lined" : "dots"),
      pageCount: 1,
      pageLayout: layout || "single",
      clampToPages: true,
      shareCode: code,
      synced: false,
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
      shareCode: newBoard.shareCode,
      synced: false,
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
        const code = Math.random().toString(36).slice(2, 8);
        const title = file.name.replace(/\.pdf$/i, "");

        const newBoard: LocalBoard = {
          id,
          title,
          mode: "notebook",
          paperStyle: "blank",
          pageCount,
          pageLayout: "single",
          pageBackgrounds,
          shareCode: code,
          synced: false,
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
          shareCode: newBoard.shareCode,
          synced: false,
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
          shareCode: imported.board.shareCode,
          synced: false,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to import file");
    } finally {
      setLoadingMsg("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleJoinCode(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) return;

    setError("");
    try {
      const res = await api.getBoard(code);
      if (res.board) {
        onOpenBoard({
          id: res.board.id,
          title: res.board.title,
          mode: "infinite",
          shareCode: res.board.share_code,
          synced: true,
        });
        return;
      }
    } catch {
      onOpenBoard({
        id: code,
        title: `Board ${code}`,
        mode: "infinite",
        shareCode: code,
        synced: true,
      });
    }
  }

  function handleDeleteLocal(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this board?")) return;
    deleteLocalBoard(id);
    localStorage.removeItem(`wb_strokes_${id}`);
    localStorage.removeItem(`wb_images_${id}`);
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
        <div />

        <div className="flex items-center gap-2">
          {/* Import File Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors"
            title="Import .wnb board file or PDF document"
          >
            <FileUp size={14} />
            <span>Import Document / File</span>
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-200 dark:border-neutral-800">
              <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                {user.name || user.email}
              </span>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title="Sign Out"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-medium transition-colors"
            >
              <LogIn size={13} />
              <span>Sign In</span>
            </button>
          )}
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
          {/* Unified Create Board Hero Card */}
          <div
            onClick={() => {
              setNewBoardTitle("");
              setNewBoardMode("notebook");
              setNewBoardPaper("lined");
              setNewBoardLayout("single");
              setIsCreateModalOpen(true);
            }}
            className="group p-5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-neutral-800 dark:bg-neutral-200 flex items-center justify-center text-white dark:text-neutral-900">
                <Plus size={18} />
              </div>
              <h3 className="text-base font-semibold tracking-tight">
                New Board
              </h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-600">
                Create an infinite whiteboard or paginated notebook with custom paper grids.
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
                Import File or PDF
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Open multi-page PDF documents for handwritten markup or load .wnb backups.
              </p>
            </div>
          </div>

          {/* Join with Code Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center">
                <Share2 size={16} />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Join with Code
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Enter a share code to join a collaborative board as a guest.
              </p>
            </div>

            <form onSubmit={handleJoinCode} className="flex gap-1.5">
              <input
                type="text"
                placeholder="e.g. abc-def"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                Join
              </button>
            </form>
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
                { id: "infinite", label: "Infinite Canvases" },
                { id: "notebook", label: "Notebooks" },
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
                Create an Infinite Canvas or Paged Notebook above, or import a PDF document.
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
                        shareCode: b.shareCode,
                        synced: b.synced,
                      })
                    }
                    className="group relative p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail Preview Container */}
                      <div className="w-full h-32 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-800 overflow-hidden flex items-center justify-center mb-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={b.title}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-neutral-400">
                            {b.mode === "notebook" ? (
                              <FileText size={22} className="opacity-40" />
                            ) : (
                              <LayoutGrid size={22} className="opacity-40" />
                            )}
                            <span className="text-[10px] font-mono opacity-50">Empty Board</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {b.title}
                        </h4>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 shrink-0">
                          {b.mode}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-1">
                        <Clock size={11} />
                        <span>{new Date(b.updatedAt).toLocaleDateString()}</span>
                        {b.mode === "notebook" && (
                          <span>• {b.pageCount || 1} {b.pageCount === 1 ? "page" : "pages"}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-100 dark:border-neutral-800 text-[11px]">
                      <span className="flex items-center gap-1 text-neutral-400 font-mono text-[10px]">
                        <HardDrive size={11} />
                        <span>Local</span>
                      </span>

                      <button
                        onClick={(e) => handleDeleteLocal(b.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-neutral-400 hover:text-red-500 transition-opacity"
                        title="Delete board"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cloud Boards Section */}
          {cloudBoards.length > 0 && (
            <div className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  <Cloud size={13} />
                  <span>Cloud / Shared Boards</span>
                </div>
                <span className="text-xs text-neutral-400 font-mono">{cloudBoards.length}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {cloudBoards.map((cb) => (
                  <div
                    key={cb.id}
                    onClick={() =>
                      onOpenBoard({
                        id: cb.id,
                        title: cb.title,
                        mode: "infinite",
                        shareCode: cb.share_code,
                        synced: true,
                      })
                    }
                    className="group relative p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Cloud board icon preview */}
                      <div className="w-full h-32 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-800 overflow-hidden flex items-center justify-center mb-3">
                        <div className="flex flex-col items-center gap-1.5 text-neutral-400">
                          <Cloud size={24} className="opacity-40" />
                          <span className="text-[10px] font-mono opacity-50">Shared Workspace</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {cb.title}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                          {cb.share_code}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-1">
                        <Clock size={11} />
                        <span>{new Date(cb.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-100 dark:border-neutral-800 text-[11px]">
                      <span className="flex items-center gap-1 text-neutral-400 font-mono text-[10px]">
                        <Cloud size={11} />
                        <span>Cloud</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Unified Board Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Create New Board
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Choose between an infinite whiteboard or a paginated notebook.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Board Type Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Board Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => {
                      setNewBoardMode("notebook");
                      if (newBoardPaper === "dots") setNewBoardPaper("lined");
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      newBoardMode === "notebook"
                        ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 shadow-2xs"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/30"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-900 dark:text-neutral-100">
                      <FileText size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        Paginated Notebook
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                        A4 pages, margins, thumbnail list, slide sorting, and PDF markup.
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setNewBoardMode("infinite");
                      if (newBoardPaper === "lined") setNewBoardPaper("dots");
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      newBoardMode === "infinite"
                        ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 shadow-2xs"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/30"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-900 dark:text-neutral-100">
                      <LayoutGrid size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        Infinite Whiteboard
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                        Freeform boundless space with smooth zoom, pan, and diagrams.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  placeholder={newBoardMode === "notebook" ? "Untitled Notebook" : "Untitled Whiteboard"}
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>

              {/* Paper Style */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Paper Pattern
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "lined" as PaperStyle, label: "Lined" },
                    { id: "grid" as PaperStyle, label: "Grid" },
                    { id: "dots" as PaperStyle, label: "Dots" },
                    { id: "blank" as PaperStyle, label: "Blank" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNewBoardPaper(p.id)}
                      className={`py-2 px-3 text-xs rounded-lg border font-medium transition-all ${
                        newBoardPaper === p.id
                          ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                          : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notebook Layout option if notebook mode */}
              {newBoardMode === "notebook" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Sheet Layout
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "single" as PageLayout, label: "Single Col" },
                      { id: "double" as PageLayout, label: "Facing Spread" },
                      { id: "horizontal" as PageLayout, label: "Horizontal" },
                      { id: "grid-3" as PageLayout, label: "3-Col Grid" },
                      { id: "grid-4" as PageLayout, label: "4-Col Grid" },
                      { id: "grid-6" as PageLayout, label: "6-Col Grid" },
                    ].map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setNewBoardLayout(l.id)}
                        className={`py-1.5 px-2 text-[11px] rounded-lg border font-medium transition-all ${
                          newBoardLayout === l.id
                            ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                            : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCreateBoard(newBoardMode, newBoardTitle, newBoardPaper, newBoardLayout)
                }
                className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold rounded-lg hover:opacity-90 shadow-2xs transition-all"
              >
                Create Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
