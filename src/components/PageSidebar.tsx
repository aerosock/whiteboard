import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileText,
  Copy,
  Eraser,
  FilePlus,
  LayoutGrid,
} from "lucide-react";
import { PageLayout } from "../lib/storage";

interface PageSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pageCount: number;
  currentPage: number;
  onSelectPage: (pageIndex: number) => void;
  onAddPage: () => void;
  onInsertPageAfter: (pageIndex: number) => void;
  onInsertPageBefore?: (pageIndex: number) => void;
  onDuplicatePage?: (pageIndex: number) => void;
  onClearPage?: (pageIndex: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onDeletePage: (pageIndex: number) => void;
  pageLayout: PageLayout;
  onPageLayoutChange: (layout: PageLayout) => void;
  pageBackgrounds?: Record<number, string>;
  thumbnails?: Record<number, string>;
}

export default function PageSidebar({
  isOpen,
  onClose,
  pageCount,
  currentPage,
  onSelectPage,
  onAddPage,
  onInsertPageAfter,
  onInsertPageBefore,
  onDuplicatePage,
  onClearPage,
  onMovePage,
  onDeletePage,
  pageLayout,
  onPageLayoutChange,
  pageBackgrounds = {},
  thumbnails = {},
}: PageSidebarProps) {
  // Drag & drop state for PowerPoint-style reordering
  const [draggedPage, setDraggedPage] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    page: number;
    position: "before" | "after";
  } | null>(null);

  // Layout dropdown menu state
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    page: number | null;
    insertIndex?: number;
  } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleGlobalClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setContextMenu(null);
        setShowLayoutMenu(false);
      }
    }
    window.addEventListener("pointerdown", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!isOpen) return null;

  // --- Drag and Drop Handlers ---
  function handleDragStart(e: React.DragEvent, pageNum: number) {
    e.dataTransfer.setData("text/plain", String(pageNum));
    e.dataTransfer.effectAllowed = "move";
    setDraggedPage(pageNum);
  }

  function handleDragOverCard(e: React.DragEvent, pageNum: number) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "before" : "after";

    if (!dropTarget || dropTarget.page !== pageNum || dropTarget.position !== position) {
      setDropTarget({ page: pageNum, position });
    }
  }

  function handleDragEnd() {
    setDraggedPage(null);
    setDropTarget(null);
  }

  function handleDropCard(e: React.DragEvent, targetPageNum: number) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedPage === null) return;

    const from = draggedPage;
    let to = targetPageNum;

    if (dropTarget?.position === "after" && from < targetPageNum) {
      to = targetPageNum;
    } else if (dropTarget?.position === "after" && from > targetPageNum) {
      to = targetPageNum + 1;
    } else if (dropTarget?.position === "before" && from < targetPageNum) {
      to = targetPageNum - 1;
    } else if (dropTarget?.position === "before" && from > targetPageNum) {
      to = targetPageNum;
    }

    to = Math.max(1, Math.min(to, pageCount));

    if (from !== to) {
      onMovePage(from, to);
    }

    setDraggedPage(null);
    setDropTarget(null);
  }

  // --- Context Menu Handlers ---
  function handleCardContextMenu(e: React.MouseEvent, pageNum: number) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 180),
      y: Math.min(e.clientY, window.innerHeight - 240),
      page: pageNum,
    });
  }

  function getInsertionIndexFromY(clientY: number): number {
    if (!listContainerRef.current) return pageCount;
    const cards = listContainerRef.current.querySelectorAll("[data-page-num]");
    if (cards.length === 0) return pageCount;

    for (let i = 0; i < cards.length; i++) {
      const el = cards[i];
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const pageNum = Number(el.getAttribute("data-page-num"));

      if (clientY < rect.top) {
        return Math.max(0, pageNum - 1);
      }
      if (clientY <= midY) {
        return Math.max(0, pageNum - 1);
      }
    }
    return pageCount;
  }

  function handleContainerContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const insertAfter = getInsertionIndexFromY(e.clientY);
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 140),
      page: null,
      insertIndex: insertAfter,
    });
  }

  const LAYOUT_OPTIONS: { id: PageLayout; label: string; sub: string }[] = [
    { id: "single", label: "Single Column", sub: "1 Sheet Wide" },
    { id: "double", label: "Facing Spread", sub: "Book Spine" },
    { id: "horizontal", label: "Horizontal Line", sub: "1 Long Row" },
    { id: "grid-3", label: "3 Columns Grid", sub: "3 Sheets Wide" },
    { id: "grid-4", label: "4 Columns Grid", sub: "4 Sheets Wide" },
    { id: "grid-6", label: "6 Columns Grid", sub: "6 Sheets Wide" },
  ];

  return (
    <aside
      className="w-64 h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col z-30 select-none animate-in slide-in-from-left duration-150 flex-shrink-0"
      onContextMenu={handleContainerContextMenu}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Sidebar Header */}
      <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-neutral-500" />
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            Pages ({pageCount})
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Flexible Sheet Layout Dropdown Button */}
          <div className="relative" ref={layoutMenuRef}>
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Change Sheet Grid & Layout"
            >
              <LayoutGrid size={14} />
            </button>

            {showLayoutMenu && (
              <div className="absolute right-0 top-8 z-50 min-w-[170px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl py-1 text-xs text-neutral-800 dark:text-neutral-200 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-800">
                  Sheet Layout
                </div>
                {LAYOUT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onPageLayoutChange(opt.id);
                      setShowLayoutMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                      pageLayout === opt.id ? "font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20" : ""
                    }`}
                  >
                    <div>
                      <div>{opt.label}</div>
                      <div className="text-[10px] text-neutral-400 font-normal">{opt.sub}</div>
                    </div>
                    {pageLayout === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Close Sidebar"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Pages Thumbnail List */}
      <div
        ref={listContainerRef}
        className="flex-1 p-3 overflow-y-auto space-y-3"
        onDragOver={(e) => e.preventDefault()}
      >
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => {
          const isSelected = pageNum === currentPage;
          const isDraggingThis = draggedPage === pageNum;
          const thumbSrc = thumbnails[pageNum] || pageBackgrounds[pageNum];

          const showIndicatorBefore =
            dropTarget && dropTarget.page === pageNum && dropTarget.position === "before";
          const showIndicatorAfter =
            dropTarget && dropTarget.page === pageNum && dropTarget.position === "after";

          return (
            <div
              key={pageNum}
              data-page-num={pageNum}
              className="relative"
              onDragOver={(e) => handleDragOverCard(e, pageNum)}
              onDrop={(e) => handleDropCard(e, pageNum)}
            >
              {/* Insertion Drop Indicator (Before) */}
              {showIndicatorBefore && (
                <div className="absolute -top-1.5 left-0 right-0 h-1 bg-blue-500 dark:bg-blue-400 rounded-full z-20 shadow-xs pointer-events-none animate-pulse" />
              )}

              <div
                draggable
                onDragStart={(e) => handleDragStart(e, pageNum)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelectPage(pageNum)}
                onContextMenu={(e) => handleCardContextMenu(e, pageNum)}
                className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-2 select-none ${
                  isDraggingThis ? "opacity-35 scale-95 border-dashed border-neutral-400" : ""
                } ${
                  isSelected
                    ? "border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800/80 shadow-xs"
                    : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/40"
                }`}
                style={{ userSelect: "none", WebkitUserSelect: "none" }}
              >
                {/* Thumbnail Container */}
                <div className="w-full aspect-[1/1.414] rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden relative shadow-2xs" style={{ backgroundColor: "var(--paper-bg, #ffffff)" }}>
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt={`Page ${pageNum}`}
                      className="w-full h-full object-contain pointer-events-none select-none"
                    />
                  ) : (
                    <div className="w-full h-full pointer-events-none" />
                  )}

                  {/* Page Number Badge */}
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono leading-none backdrop-blur-xs">
                    {pageNum}
                  </span>
                </div>

                {/* Page Actions Footer */}
                <div className="w-full flex items-center justify-between text-xs pt-0.5">
                  <span className="font-medium text-neutral-600 dark:text-neutral-400 text-[11px]">
                    Page {pageNum}
                  </span>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {pageNum > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMovePage(pageNum, pageNum - 1);
                        }}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        title="Move Page Up"
                      >
                        <ArrowUp size={12} />
                      </button>
                    )}

                    {pageNum < pageCount && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMovePage(pageNum, pageNum + 1);
                        }}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        title="Move Page Down"
                      >
                        <ArrowDown size={12} />
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onInsertPageAfter(pageNum);
                      }}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      title="Insert Page After"
                    >
                      <Plus size={12} />
                    </button>

                    {pageCount > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePage(pageNum);
                        }}
                        className="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        title="Delete Page"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Insertion Drop Indicator (After) */}
              {showIndicatorAfter && (
                <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-blue-500 dark:bg-blue-400 rounded-full z-20 shadow-xs pointer-events-none animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Add Page Footer Button */}
      <div className="p-3 border-t border-neutral-100 dark:border-neutral-800">
        <button
          onClick={onAddPage}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium transition-colors"
        >
          <Plus size={14} />
          <span>Add Page</span>
        </button>
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[170px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl py-1 text-xs text-neutral-800 dark:text-neutral-200 animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          {contextMenu.page !== null ? (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-800">
                Page {contextMenu.page}
              </div>

              <button
                onClick={() => {
                  if (contextMenu.page !== null) {
                    if (onInsertPageBefore) onInsertPageBefore(contextMenu.page);
                    else onInsertPageAfter(Math.max(1, contextMenu.page - 1));
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <FilePlus size={13} className="text-neutral-500" />
                <span>Insert Page Before</span>
              </button>

              <button
                onClick={() => {
                  if (contextMenu.page !== null) onInsertPageAfter(contextMenu.page);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Plus size={13} className="text-neutral-500" />
                <span>Insert Page After</span>
              </button>

              {onDuplicatePage && (
                <button
                  onClick={() => {
                    if (contextMenu.page !== null) onDuplicatePage(contextMenu.page);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Copy size={13} className="text-neutral-500" />
                  <span>Duplicate Page</span>
                </button>
              )}

              {onClearPage && (
                <button
                  onClick={() => {
                    if (contextMenu.page !== null) onClearPage(contextMenu.page);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Eraser size={13} className="text-neutral-500" />
                  <span>Clear Page Content</span>
                </button>
              )}

              <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />

              {contextMenu.page > 1 && (
                <button
                  onClick={() => {
                    if (contextMenu.page !== null) onMovePage(contextMenu.page, contextMenu.page - 1);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <ArrowUp size={13} className="text-neutral-500" />
                  <span>Move Page Up</span>
                </button>
              )}

              {contextMenu.page < pageCount && (
                <button
                  onClick={() => {
                    if (contextMenu.page !== null) onMovePage(contextMenu.page, contextMenu.page + 1);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <ArrowDown size={13} className="text-neutral-500" />
                  <span>Move Page Down</span>
                </button>
              )}

              {pageCount > 1 && (
                <>
                  <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />
                  <button
                    onClick={() => {
                      if (contextMenu.page !== null) onDeletePage(contextMenu.page);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Delete Page</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                const target = contextMenu.insertIndex ?? pageCount;
                if (target === 0) {
                  if (onInsertPageBefore) onInsertPageBefore(1);
                  else onInsertPageAfter(0);
                } else {
                  onInsertPageAfter(target);
                }
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <Plus size={13} className="text-neutral-500" />
              <span>
                {contextMenu.insertIndex !== undefined &&
                contextMenu.insertIndex > 0 &&
                contextMenu.insertIndex < pageCount
                  ? `Insert Page Here (Between ${contextMenu.insertIndex} & ${contextMenu.insertIndex + 1})`
                  : contextMenu.insertIndex === 0
                  ? "Insert Page at Beginning"
                  : "Add Page at End"}
              </span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
