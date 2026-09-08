import { useState, useRef, useEffect } from "react";
import Canvas, { CanvasHandle } from "./components/Canvas";
import Toolbar from "./components/Toolbar";
import BoardHeader from "./components/BoardHeader";
import PageSidebar from "./components/PageSidebar";
import Dashboard from "./components/Dashboard";
import AuthModal from "./components/AuthModal";
import SettingsModal from "./components/SettingsModal";
import { useTheme } from "./hooks/useTheme";
import { api, User } from "./lib/api";
import { RemoteCursor } from "./lib/sync";
import {
  BoardMode,
  PaperStyle,
  PageLayout,
  LocalBoard,
  saveLocalBoard,
  getLocalBoard,
} from "./lib/storage";
import { exportBoardPackage, loadPdfPagesAsImages } from "./lib/document";

interface ActiveBoard {
  id: string;
  title: string;
  mode: BoardMode;
  paperStyle: PaperStyle;
  pageCount: number;
  pageLayout?: PageLayout;
  pageBackgrounds?: Record<number, string>;
  clampToPages?: boolean;
  shareCode?: string;
  synced: boolean;
}

function App() {
  const { effectiveTheme } = useTheme();

  // Navigation & User State
  const [view, setView] = useState<"dashboard" | "board">("dashboard");
  const [activeBoard, setActiveBoard] = useState<ActiveBoard | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<RemoteCursor[]>([]);

  // Board Mode & Page State
  const [boardMode, setBoardMode] = useState<BoardMode>("infinite");
  const [paperStyle, setPaperStyle] = useState<PaperStyle>("dots");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [pageLayout, setPageLayout] = useState<PageLayout>("single");
  const [pageBackgrounds, setPageBackgrounds] = useState<Record<number, string>>({});
  const [clampToPages, setClampToPages] = useState(true);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Drawing Tools State
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#171717");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const canvasRef = useRef<CanvasHandle>(null);

  // Check auth on startup
  useEffect(() => {
    api.me().then((currentUser) => {
      setUser(currentUser);
    });
  }, []);

  // Check URL join code (e.g. ?join=code)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    if (joinCode) {
      handleOpenBoard({
        id: joinCode,
        title: `Board ${joinCode}`,
        mode: "infinite",
        shareCode: joinCode,
        synced: true,
      });
    }
  }, []);

  function handleOpenBoard(board: {
    id: string;
    title: string;
    mode: BoardMode;
    pageLayout?: PageLayout;
    shareCode?: string;
    synced: boolean;
  }) {
    // Check if we have local stored metadata
    const local = getLocalBoard(board.id);
    const mode = local ? local.mode : board.mode || "infinite";
    const paper = local ? local.paperStyle : mode === "notebook" ? "lined" : "dots";
    const pages = local ? local.pageCount : 1;
    const layout = local?.pageLayout || board.pageLayout || "single";
    const bgs = local?.pageBackgrounds || {};
    const clamp = local?.clampToPages !== undefined ? local.clampToPages : true;

    setBoardMode(mode);
    setPaperStyle(paper);
    setPageCount(pages);
    setCurrentPage(1);
    setPageLayout(layout);
    setPageBackgrounds(bgs);
    setClampToPages(clamp);

    setActiveBoard({
      id: board.id,
      title: board.title,
      mode,
      paperStyle: paper,
      pageCount: pages,
      pageLayout: layout,
      pageBackgrounds: bgs,
      clampToPages: clamp,
      shareCode: board.shareCode,
      synced: board.synced,
    });
    setView("board");
  }

  function handleBackToDashboard() {
    setView("dashboard");
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  function saveBoardMeta(updates: Partial<LocalBoard>) {
    if (!activeBoard) return;
    const updatedActive = { ...activeBoard, ...updates };
    setActiveBoard(updatedActive);

    const local = getLocalBoard(activeBoard.id);
    const updatedLocal: LocalBoard = {
      id: activeBoard.id,
      title: updates.title !== undefined ? updates.title : activeBoard.title,
      mode: updates.mode !== undefined ? updates.mode : boardMode,
      paperStyle: updates.paperStyle !== undefined ? updates.paperStyle : paperStyle,
      pageCount: updates.pageCount !== undefined ? updates.pageCount : pageCount,
      pageLayout: updates.pageLayout !== undefined ? updates.pageLayout : pageLayout,
      pageBackgrounds: updates.pageBackgrounds !== undefined ? updates.pageBackgrounds : pageBackgrounds,
      clampToPages: updates.clampToPages !== undefined ? updates.clampToPages : clampToPages,
      shareCode: activeBoard.shareCode,
      synced: activeBoard.synced,
      createdAt: local ? local.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    saveLocalBoard(updatedLocal);
  }

  function handleTitleChange(newTitle: string) {
    const trimmed = newTitle.trim() || "Untitled";
    saveBoardMeta({ title: trimmed });
  }

  function handleBoardModeChange(newMode: BoardMode) {
    setBoardMode(newMode);
    saveBoardMeta({ mode: newMode });
  }

  function handlePaperStyleChange(newStyle: PaperStyle) {
    setPaperStyle(newStyle);
    saveBoardMeta({ paperStyle: newStyle });
  }

  function handlePageLayoutChange(newLayout: PageLayout) {
    setPageLayout(newLayout);
    saveBoardMeta({ pageLayout: newLayout });
  }

  function handleAddPage() {
    const newCount = pageCount + 1;
    setPageCount(newCount);
    setCurrentPage(newCount);
    saveBoardMeta({ pageCount: newCount });
    setTimeout(() => canvasRef.current?.focusPage(newCount), 50);
  }

  function handleInsertPageAfter(pageIndex: number) {
    const newCount = pageCount + 1;
    const newBgs: Record<number, string> = {};
    for (const [pStr, url] of Object.entries(pageBackgrounds)) {
      const p = Number(pStr);
      if (p <= pageIndex) {
        newBgs[p] = url;
      } else {
        newBgs[p + 1] = url;
      }
    }
    setPageBackgrounds(newBgs);
    setPageCount(newCount);
    setCurrentPage(pageIndex + 1);

    setThumbnails((prev) => {
      const next: Record<number, string> = {};
      for (const [pStr, url] of Object.entries(prev)) {
        const p = Number(pStr);
        if (p <= pageIndex) next[p] = url;
        else next[p + 1] = url;
      }
      return next;
    });

    if (boardMode === "notebook") {
      const strokes = canvasRef.current?.getStrokes() || [];
      const images = canvasRef.current?.getImages() || [];

      const updatedStrokes = strokes.map((s) => {
        const p = s.page ?? 1;
        if (p > pageIndex) {
          return { ...s, page: p + 1 };
        }
        return s;
      });

      const updatedImages = images.map((img) => {
        const p = img.page ?? 1;
        if (p > pageIndex) {
          return { ...img, page: p + 1 };
        }
        return img;
      });

      canvasRef.current?.setElements(updatedStrokes, updatedImages);
    }

    saveBoardMeta({ pageCount: newCount, pageBackgrounds: newBgs });
    setTimeout(() => canvasRef.current?.focusPage(pageIndex + 1), 50);
  }

  function handleClampToPagesChange(clamp: boolean) {
    setClampToPages(clamp);
    saveBoardMeta({ clampToPages: clamp });
  }

  function handleInsertPageBefore(pageIndex: number) {
    if (pageIndex > 1) {
      handleInsertPageAfter(pageIndex - 1);
      return;
    }
    const newCount = pageCount + 1;
    const newBgs: Record<number, string> = {};
    for (const [pStr, url] of Object.entries(pageBackgrounds)) {
      newBgs[Number(pStr) + 1] = url;
    }
    setPageBackgrounds(newBgs);
    setPageCount(newCount);
    setCurrentPage(1);

    setThumbnails((prev) => {
      const next: Record<number, string> = {};
      for (const [pStr, url] of Object.entries(prev)) {
        next[Number(pStr) + 1] = url;
      }
      return next;
    });

    if (boardMode === "notebook") {
      const strokes = canvasRef.current?.getStrokes() || [];
      const images = canvasRef.current?.getImages() || [];

      const updatedStrokes = strokes.map((s) => ({
        ...s,
        page: (s.page ?? 1) + 1,
      }));

      const updatedImages = images.map((img) => ({
        ...img,
        page: (img.page ?? 1) + 1,
      }));

      canvasRef.current?.setElements(updatedStrokes, updatedImages);
    }

    saveBoardMeta({ pageCount: newCount, pageBackgrounds: newBgs });
    setTimeout(() => canvasRef.current?.focusPage(1), 50);
  }

  function handleDuplicatePage(pageIndex: number) {
    const newCount = pageCount + 1;
    const newBgs: Record<number, string> = {};
    for (const [pStr, url] of Object.entries(pageBackgrounds)) {
      const p = Number(pStr);
      if (p <= pageIndex) {
        newBgs[p] = url;
      } else {
        newBgs[p + 1] = url;
      }
    }
    if (pageBackgrounds[pageIndex]) {
      newBgs[pageIndex + 1] = pageBackgrounds[pageIndex];
    }

    setPageBackgrounds(newBgs);
    setPageCount(newCount);
    setCurrentPage(pageIndex + 1);

    setThumbnails((prev) => {
      const next: Record<number, string> = {};
      for (const [pStr, url] of Object.entries(prev)) {
        const p = Number(pStr);
        if (p <= pageIndex) next[p] = url;
        else next[p + 1] = url;
      }
      if (prev[pageIndex]) next[pageIndex + 1] = prev[pageIndex];
      return next;
    });

    if (boardMode === "notebook") {
      const strokes = canvasRef.current?.getStrokes() || [];
      const images = canvasRef.current?.getImages() || [];

      const clonedStrokes: typeof strokes = [];
      const updatedStrokes = strokes.map((s) => {
        const p = s.page ?? 1;
        if (p === pageIndex) {
          clonedStrokes.push({
            ...s,
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            page: pageIndex + 1,
          });
          return s;
        } else if (p > pageIndex) {
          return { ...s, page: p + 1 };
        }
        return s;
      });

      const clonedImages: typeof images = [];
      const updatedImages = images.map((img) => {
        const p = img.page ?? 1;
        if (p === pageIndex) {
          clonedImages.push({
            ...img,
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            page: pageIndex + 1,
          });
          return img;
        } else if (p > pageIndex) {
          return { ...img, page: p + 1 };
        }
        return img;
      });

      canvasRef.current?.setElements(
        [...updatedStrokes, ...clonedStrokes],
        [...updatedImages, ...clonedImages]
      );
    }

    saveBoardMeta({ pageCount: newCount, pageBackgrounds: newBgs });
    setTimeout(() => canvasRef.current?.focusPage(pageIndex + 1), 50);
  }

  function handleClearPage(pageIndex: number) {
    setThumbnails((prev) => {
      const next = { ...prev };
      delete next[pageIndex];
      return next;
    });

    if (boardMode === "notebook") {
      const strokes = canvasRef.current?.getStrokes() || [];
      const images = canvasRef.current?.getImages() || [];

      const updatedStrokes = strokes.filter((s) => (s.page ?? 1) !== pageIndex);
      const updatedImages = images.filter((img) => (img.page ?? 1) !== pageIndex);

      canvasRef.current?.setElements(updatedStrokes, updatedImages);
    }
  }

  function handleMovePage(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 1 || toIndex < 1 || fromIndex > pageCount || toIndex > pageCount) {
      return;
    }

    const newBgs: Record<number, string> = {};
    const bgList: (string | undefined)[] = [];
    for (let i = 1; i <= pageCount; i++) {
      bgList.push(pageBackgrounds[i]);
    }
    const [movedBg] = bgList.splice(fromIndex - 1, 1);
    bgList.splice(toIndex - 1, 0, movedBg);
    bgList.forEach((bg, idx) => {
      if (bg) newBgs[idx + 1] = bg;
    });

    setThumbnails((prev) => {
      const thumbList: (string | undefined)[] = [];
      for (let i = 1; i <= pageCount; i++) {
        thumbList.push(prev[i]);
      }
      const [movedThumb] = thumbList.splice(fromIndex - 1, 1);
      thumbList.splice(toIndex - 1, 0, movedThumb);
      const next: Record<number, string> = {};
      thumbList.forEach((t, idx) => {
        if (t) next[idx + 1] = t;
      });
      return next;
    });

    setPageBackgrounds(newBgs);
    setCurrentPage(toIndex);

    if (boardMode === "notebook") {
      const strokes = canvasRef.current?.getStrokes() || [];
      const images = canvasRef.current?.getImages() || [];

      function remapPage(p: number): number {
        if (p === fromIndex) return toIndex;
        if (fromIndex < toIndex) {
          if (p > fromIndex && p <= toIndex) return p - 1;
        } else {
          if (p >= toIndex && p < fromIndex) return p + 1;
        }
        return p;
      }

      const updatedStrokes = strokes.map((s) => ({
        ...s,
        page: remapPage(s.page ?? 1),
      }));

      const updatedImages = images.map((img) => ({
        ...img,
        page: remapPage(img.page ?? 1),
      }));

      canvasRef.current?.setElements(updatedStrokes, updatedImages);
    }

    saveBoardMeta({ pageBackgrounds: newBgs });
    setTimeout(() => canvasRef.current?.focusPage(toIndex), 50);
  }

  function handleDeletePage(pageIndex: number) {
    if (pageCount <= 1) return;
    const newCount = pageCount - 1;
    const newBgs: Record<number, string> = {};
    for (const [pStr, url] of Object.entries(pageBackgrounds)) {
      const p = Number(pStr);
      if (p < pageIndex) {
        newBgs[p] = url;
      } else if (p > pageIndex) {
        newBgs[p - 1] = url;
      }
    }

    setThumbnails((prev) => {
      const next: Record<number, string> = {};
      for (const [pStr, url] of Object.entries(prev)) {
        const p = Number(pStr);
        if (p < pageIndex) next[p] = url;
        else if (p > pageIndex) next[p - 1] = url;
      }
      return next;
    });

    setPageBackgrounds(newBgs);
    setPageCount(newCount);
    const nextCurrent = Math.min(currentPage, newCount);
    setCurrentPage(nextCurrent);

    if (boardMode === "notebook") {
      const strokes = canvasRef.current?.getStrokes() || [];
      const images = canvasRef.current?.getImages() || [];

      const updatedStrokes = strokes
        .filter((s) => (s.page ?? 1) !== pageIndex)
        .map((s) => {
          const p = s.page ?? 1;
          if (p > pageIndex) {
            return { ...s, page: p - 1 };
          }
          return s;
        });

      const updatedImages = images
        .filter((img) => (img.page ?? 1) !== pageIndex)
        .map((img) => {
          const p = img.page ?? 1;
          if (p > pageIndex) {
            return { ...img, page: p - 1 };
          }
          return img;
        });

      canvasRef.current?.setElements(updatedStrokes, updatedImages);
    }

    saveBoardMeta({ pageCount: newCount, pageBackgrounds: newBgs });
    setTimeout(() => canvasRef.current?.focusPage(nextCurrent), 50);
  }

  function handleInsertImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) canvasRef.current?.insertImage(file);
    };
    input.click();
  }

  function handleExportPng() {
    const dataUrl = canvasRef.current?.exportPng();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${activeBoard?.title || "whiteboard"}.png`;
    a.click();
  }

  function handleExportWnb() {
    if (!activeBoard) return;
    const strokes = canvasRef.current?.getStrokes() || [];
    const images = canvasRef.current?.getImages() || [];
    const local = getLocalBoard(activeBoard.id) || {
      id: activeBoard.id,
      title: activeBoard.title,
      mode: boardMode,
      paperStyle,
      pageCount,
      pageLayout,
      pageBackgrounds,
      shareCode: activeBoard.shareCode,
      synced: activeBoard.synced,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    exportBoardPackage(local, strokes, images, pageBackgrounds);
  }

  function handleImportPdf() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const { pageImages, pageCount: pdfPages } = await loadPdfPagesAsImages(file);
        const newBgs: Record<number, string> = {};
        pageImages.forEach((img, idx) => {
          newBgs[idx + 1] = img;
        });
        setBoardMode("notebook");
        setPageCount(pdfPages);
        setPageBackgrounds(newBgs);
        setCurrentPage(1);

        saveBoardMeta({
          mode: "notebook",
          pageCount: pdfPages,
          pageBackgrounds: newBgs,
          paperStyle: "blank",
        });

        setTimeout(() => canvasRef.current?.focusPage(1), 50);
      } catch (err: any) {
        alert("Failed to load PDF: " + (err.message || err));
      }
    };
    input.click();
  }

  function handleLogout() {
    api.logout();
    setUser(null);
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans">
      {view === "dashboard" ? (
        <Dashboard
          user={user}
          onOpenBoard={handleOpenBoard}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={handleLogout}
        />
      ) : (
        <div className="h-full w-full flex flex-col overflow-hidden">
          <BoardHeader
            title={activeBoard?.title || "Whiteboard"}
            onTitleChange={handleTitleChange}
            shareCode={activeBoard?.shareCode}
            collaborators={collaborators}
            user={user}
            boardMode={boardMode}
            onBoardModeChange={handleBoardModeChange}
            paperStyle={paperStyle}
            onPaperStyleChange={handlePaperStyleChange}
            currentPage={currentPage}
            pageCount={pageCount}
            pageLayout={pageLayout}
            onPageLayoutChange={handlePageLayoutChange}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onBackToDashboard={handleBackToDashboard}
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onClearCanvas={() => canvasRef.current?.clear()}
            onExportPng={handleExportPng}
            onExportWnb={handleExportWnb}
            onImportPdf={handleImportPdf}
          />
          <Toolbar
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            onUndo={() => canvasRef.current?.undo()}
            onRedo={() => canvasRef.current?.redo()}
            onClear={() => canvasRef.current?.clear()}
            onInsertImage={handleInsertImage}
          />
          <div className="flex-1 flex overflow-hidden relative">
            {boardMode === "notebook" && (
              <PageSidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                pageCount={pageCount}
                currentPage={currentPage}
                onSelectPage={(pageNum) => {
                  setCurrentPage(pageNum);
                  canvasRef.current?.focusPage(pageNum);
                }}
                onAddPage={handleAddPage}
                onInsertPageAfter={handleInsertPageAfter}
                onInsertPageBefore={handleInsertPageBefore}
                onDuplicatePage={handleDuplicatePage}
                onClearPage={handleClearPage}
                onMovePage={handleMovePage}
                onDeletePage={handleDeletePage}
                pageLayout={pageLayout}
                onPageLayoutChange={handlePageLayoutChange}
                pageBackgrounds={pageBackgrounds}
                thumbnails={thumbnails}
              />
            )}
            <Canvas
              ref={canvasRef}
              tool={tool}
              color={color}
              strokeWidth={strokeWidth}
              theme={effectiveTheme}
              mode={boardMode}
              paperStyle={paperStyle}
              pageCount={pageCount}
              pageLayout={pageLayout}
              pageBackgrounds={pageBackgrounds}
              boardId={activeBoard?.id}
              roomId={activeBoard?.synced ? activeBoard.id : undefined}
              userName={user?.name || "Guest"}
              clampToPages={clampToPages}
              onToolChange={setTool}
              onBrushSizeChange={setStrokeWidth}
              onCurrentPageChange={setCurrentPage}
              onCollaboratorsChange={setCollaborators}
              onThumbnailsUpdate={setThumbnails}
            />
          </div>
        </div>
      )}

      {/* Centralized Settings Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onLogout={handleLogout}
        paperStyle={paperStyle}
        onPaperStyleChange={handlePaperStyleChange}
        boardMode={boardMode}
        onBoardModeChange={handleBoardModeChange}
        clampToPages={clampToPages}
        onClampToPagesChange={handleClampToPagesChange}
        pageLayout={pageLayout}
        onPageLayoutChange={handlePageLayoutChange}
      />

      {/* Authentication Dialog */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(loggedUser) => {
          setUser(loggedUser);
        }}
      />
    </div>
  );
}

export default App;
