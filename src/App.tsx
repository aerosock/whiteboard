import { useState, useRef } from "react";
import Canvas, { CanvasHandle } from "./components/Canvas";
import Toolbar from "./components/Toolbar";
import BoardHeader from "./components/BoardHeader";
import PageSidebar from "./components/PageSidebar";
import Dashboard from "./components/Dashboard";
import SettingsModal from "./components/SettingsModal";
import { useTheme } from "./hooks/useTheme";
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
}

function App() {
  const { effectiveTheme } = useTheme();

  // Navigation State
  const [view, setView] = useState<"dashboard" | "board">("dashboard");
  const [activeBoard, setActiveBoard] = useState<ActiveBoard | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  function handleOpenBoard(board: {
    id: string;
    title: string;
    mode: BoardMode;
    pageLayout?: PageLayout;
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
    });
    setView("board");
  }

  function handleBackToDashboard() {
    setView("dashboard");
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
    const oldStrokes = canvasRef.current?.getStrokes() || [];
    const oldImages = canvasRef.current?.getImages() || [];

    const shiftedStrokes = oldStrokes.map((s) => {
      if (s.page && s.page > pageIndex) {
        return { ...s, page: s.page + 1 };
      }
      return s;
    });
    const shiftedImages = oldImages.map((i) => {
      if (i.page && i.page > pageIndex) {
        return { ...i, page: i.page + 1 };
      }
      return i;
    });

    const newBgs: Record<number, string> = {};
    for (const [k, v] of Object.entries(pageBackgrounds)) {
      const pNum = Number(k);
      if (pNum > pageIndex) {
        newBgs[pNum + 1] = v;
      } else {
        newBgs[pNum] = v;
      }
    }

    setPageCount(newCount);
    setCurrentPage(pageIndex + 1);
    setPageBackgrounds(newBgs);
    setThumbnails((prev) => {
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        const pNum = Number(k);
        if (pNum > pageIndex) next[pNum + 1] = v;
        else next[pNum] = v;
      }
      return next;
    });

    canvasRef.current?.setElements(shiftedStrokes, shiftedImages);
    saveBoardMeta({ pageCount: newCount, pageBackgrounds: newBgs });
    setTimeout(() => canvasRef.current?.focusPage(pageIndex + 1), 50);
  }

  function handleInsertPageBefore(pageIndex: number) {
    const newCount = pageCount + 1;
    const oldStrokes = canvasRef.current?.getStrokes() || [];
    const oldImages = canvasRef.current?.getImages() || [];

    const shiftedStrokes = oldStrokes.map((s) => {
      if (s.page && s.page >= pageIndex) {
        return { ...s, page: s.page + 1 };
      }
      return s;
    });
    const shiftedImages = oldImages.map((i) => {
      if (i.page && i.page >= pageIndex) {
        return { ...i, page: i.page + 1 };
      }
      return i;
    });

    const newBgs: Record<number, string> = {};
    for (const [k, v] of Object.entries(pageBackgrounds)) {
      const pNum = Number(k);
      if (pNum >= pageIndex) {
        newBgs[pNum + 1] = v;
      } else {
        newBgs[pNum] = v;
      }
    }

    setPageCount(newCount);
    setCurrentPage(pageIndex);
    setPageBackgrounds(newBgs);
    setThumbnails((prev) => {
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        const pNum = Number(k);
        if (pNum >= pageIndex) next[pNum + 1] = v;
        else next[pNum] = v;
      }
      return next;
    });

    canvasRef.current?.setElements(shiftedStrokes, shiftedImages);
    saveBoardMeta({ pageCount: newCount, pageBackgrounds: newBgs });
    setTimeout(() => canvasRef.current?.focusPage(pageIndex), 50);
  }

  function handleDuplicatePage(pageIndex: number) {
    const newCount = pageCount + 1;
    const targetPage = pageIndex + 1;
    const oldStrokes = canvasRef.current?.getStrokes() || [];
    const oldImages = canvasRef.current?.getImages() || [];

    const shiftedStrokes = oldStrokes.map((s) => {
      if (s.page && s.page > pageIndex) {
        return { ...s, page: s.page + 1 };
      }
      return s;
    });
    const shiftedImages = oldImages.map((i) => {
      if (i.page && i.page > pageIndex) {
        return { ...i, page: i.page + 1 };
      }
      return i;
    });

    // Copy strokes and images from pageIndex
    const clonedStrokes = oldStrokes
      .filter((s) => s.page === pageIndex)
      .map((s) => ({
        ...s,
        id: "s_" + Math.random().toString(36).slice(2, 10),
        page: targetPage,
      }));
    const clonedImages = oldImages
      .filter((i) => i.page === pageIndex)
      .map((i) => ({
        ...i,
        id: "img_" + Math.random().toString(36).slice(2, 10),
        page: targetPage,
      }));

    const newBgs: Record<number, string> = {};
    for (const [k, v] of Object.entries(pageBackgrounds)) {
      const pNum = Number(k);
      if (pNum > pageIndex) {
        newBgs[pNum + 1] = v;
      } else {
        newBgs[pNum] = v;
      }
    }
    if (pageBackgrounds[pageIndex]) {
      newBgs[targetPage] = pageBackgrounds[pageIndex];
    }

    setPageCount(newCount);
    setCurrentPage(targetPage);
    setPageBackgrounds(newBgs);
    setThumbnails((prev) => {
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        const pNum = Number(k);
        if (pNum > pageIndex) next[pNum + 1] = v;
        else next[pNum] = v;
      }
      if (prev[pageIndex]) next[targetPage] = prev[pageIndex];
      return next;
    });

    canvasRef.current?.setElements([...shiftedStrokes, ...clonedStrokes], [...shiftedImages, ...clonedImages]);
    saveBoardMeta({ pageCount: newCount, pageBackgrounds: newBgs });
    setTimeout(() => canvasRef.current?.focusPage(targetPage), 50);
  }

  function handleClearPage(pageIndex: number) {
    if (!confirm(`Clear all drawings on page ${pageIndex}?`)) return;
    const oldStrokes = canvasRef.current?.getStrokes() || [];
    const oldImages = canvasRef.current?.getImages() || [];

    const keptStrokes = oldStrokes.filter((s) => s.page !== pageIndex);
    const keptImages = oldImages.filter((i) => i.page !== pageIndex);

    canvasRef.current?.setElements(keptStrokes, keptImages);
    setThumbnails((prev) => {
      const next = { ...prev };
      delete next[pageIndex];
      return next;
    });
  }

  function handleMovePage(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 1 || toIndex > pageCount) return;
    const oldStrokes = canvasRef.current?.getStrokes() || [];
    const oldImages = canvasRef.current?.getImages() || [];

    const mapIndex = (p: number) => {
      if (p === fromIndex) return toIndex;
      if (fromIndex < toIndex && p > fromIndex && p <= toIndex) return p - 1;
      if (fromIndex > toIndex && p >= toIndex && p < fromIndex) return p + 1;
      return p;
    };

    const remappedStrokes = oldStrokes.map((s) => ({
      ...s,
      page: s.page ? mapIndex(s.page) : undefined,
    }));
    const remappedImages = oldImages.map((i) => ({
      ...i,
      page: i.page ? mapIndex(i.page) : undefined,
    }));

    const newBgs: Record<number, string> = {};
    for (const [k, v] of Object.entries(pageBackgrounds)) {
      newBgs[mapIndex(Number(k))] = v;
    }

    setPageBackgrounds(newBgs);
    setThumbnails((prev) => {
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[mapIndex(Number(k))] = v;
      }
      return next;
    });

    setCurrentPage(toIndex);
    canvasRef.current?.setElements(remappedStrokes, remappedImages);
    saveBoardMeta({ pageBackgrounds: newBgs });
    setTimeout(() => canvasRef.current?.focusPage(toIndex), 50);
  }

  function handleDeletePage(pageIndex: number) {
    if (pageCount <= 1) return;
    if (!confirm(`Delete page ${pageIndex}? All contents on this page will be deleted.`)) return;

    const newCount = pageCount - 1;
    const oldStrokes = canvasRef.current?.getStrokes() || [];
    const oldImages = canvasRef.current?.getImages() || [];

    const keptStrokes = oldStrokes
      .filter((s) => s.page !== pageIndex)
      .map((s) => {
        if (s.page && s.page > pageIndex) {
          return { ...s, page: s.page - 1 };
        }
        return s;
      });

    const keptImages = oldImages
      .filter((i) => i.page !== pageIndex)
      .map((i) => {
        if (i.page && i.page > pageIndex) {
          return { ...i, page: i.page - 1 };
        }
        return i;
      });

    const newBgs: Record<number, string> = {};
    for (const [k, v] of Object.entries(pageBackgrounds)) {
      const pNum = Number(k);
      if (pNum === pageIndex) continue;
      if (pNum > pageIndex) {
        newBgs[pNum - 1] = v;
      } else {
        newBgs[pNum] = v;
      }
    }

    const nextCurrent = currentPage > newCount ? newCount : currentPage;
    setPageCount(newCount);
    setCurrentPage(nextCurrent);
    setPageBackgrounds(newBgs);
    setThumbnails((prev) => {
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        const pNum = Number(k);
        if (pNum === pageIndex) continue;
        if (pNum > pageIndex) next[pNum - 1] = v;
        else next[pNum] = v;
      }
      return next;
    });

    canvasRef.current?.setElements(keptStrokes, keptImages);
    saveBoardMeta({ pageCount: newCount, pageBackgrounds: newBgs });
    setTimeout(() => canvasRef.current?.focusPage(nextCurrent), 50);
  }

  function handleClampToPagesChange(clamp: boolean) {
    setClampToPages(clamp);
    saveBoardMeta({ clampToPages: clamp });
  }

  function handleInsertImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        canvasRef.current?.insertImage(file);
      }
    };
    input.click();
  }

  function handleExportPng() {
    const dataUrl = canvasRef.current?.exportPng();
    if (!dataUrl) return;
    const a = document.createElement("a");
    const name = activeBoard?.title || "whiteboard";
    a.href = dataUrl;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.png`;
    a.click();
  }

  function handleExportWnb() {
    if (!activeBoard) return;
    const strokes = canvasRef.current?.getStrokes() || [];
    const images = canvasRef.current?.getImages() || [];
    const local = getLocalBoard(activeBoard.id);
    if (!local) return;

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
        setPaperStyle("blank");

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

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans">
      {view === "dashboard" ? (
        <Dashboard
          onOpenBoard={handleOpenBoard}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      ) : (
        <div className="h-full w-full flex flex-col overflow-hidden">
          <BoardHeader
            title={activeBoard?.title || "Whiteboard"}
            onTitleChange={handleTitleChange}
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
              clampToPages={clampToPages}
              onToolChange={setTool}
              onBrushSizeChange={setStrokeWidth}
              onCurrentPageChange={setCurrentPage}
              onThumbnailsUpdate={setThumbnails}
            />
          </div>
        </div>
      )}

      {/* Centralized Settings Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        paperStyle={paperStyle}
        onPaperStyleChange={handlePaperStyleChange}
        boardMode={boardMode}
        onBoardModeChange={handleBoardModeChange}
        clampToPages={clampToPages}
        onClampToPagesChange={handleClampToPagesChange}
      />
    </div>
  );
}

export default App;
