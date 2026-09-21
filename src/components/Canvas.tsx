import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { getStroke } from "perfect-freehand";
import { setupBoardSync, BoardSync, RemoteCursor } from "../lib/sync";
import { api } from "../lib/api";
import { BoardMode, PaperStyle, PageLayout, getLocalBoard, saveLocalBoard } from "../lib/storage";
import { EffectiveTheme } from "../hooks/useTheme";
import { getNativeClipboardImage } from "../lib/window";

function getDpr(): number {
  return Math.max(window.devicePixelRatio || 1, 2);
}

export interface StrokeData {
  id: string;
  points: number[][]; // [x, y, pressure]
  color: string;
  size: number;
  createdAt?: number;
  page?: number;
}

export interface ImageElement {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt?: number;
  page?: number;
}

// Unified action history for complete undo/redo
type HistoryAction =
  | { type: "add_stroke"; stroke: StrokeData }
  | { type: "delete"; strokes: StrokeData[]; images: ImageElement[] }
  | {
      type: "move";
      items: {
        id: string;
        kind: "stroke" | "image";
        prev: { x: number; y: number } | number[][];
        next: { x: number; y: number } | number[][];
      }[];
    }
  | {
      type: "resize_image";
      id: string;
      prev: { x: number; y: number; width: number; height: number };
      next: { x: number; y: number; width: number; height: number };
    }
  | { type: "add_image"; image: ImageElement }
  | { type: "clear"; strokes: StrokeData[]; images: ImageElement[] };

interface CanvasProps {
  tool: string;
  color: string;
  strokeWidth: number;
  theme: EffectiveTheme;
  mode: BoardMode;
  paperStyle: PaperStyle;
  pageCount: number;
  pageLayout: PageLayout;
  pageBackgrounds?: Record<number, string>;
  boardId?: string;
  roomId?: string;
  userName?: string;
  clampToPages?: boolean;
  onToolChange?: (tool: string) => void;
  onBrushSizeChange?: (newSize: number) => void;
  onCurrentPageChange?: (page: number) => void;
  onCollaboratorsChange?: (collaborators: RemoteCursor[]) => void;
  onThumbnailsUpdate?: (thumbnails: Record<number, string>) => void;
}

export interface CanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  insertImage: (file: File) => void;
  focusPage: (pageIndex: number) => void;
  exportPng: () => string | null;
  getStrokes: () => StrokeData[];
  getImages: () => ImageElement[];
  setElements: (strokes: StrokeData[], images: ImageElement[]) => void;
}

// A4 Page dimensions & spacing in continuous world space
const PAGE_W = 800;
const PAGE_H = 1130;
const PAGE_GAP = 60;

export interface ThemePalette {
  deskBg: string;
  paperBg: string;
  paperBorder: string;
  lineColor: string;
  gridColor: string;
  dotColor: string;
  marginRed: string;
  pageLabel: string;
  shadowAlpha1: string;
  shadowAlpha2: string;
  spineShadow: string;
}

export function getThemeColors(t: EffectiveTheme): ThemePalette {
  if (t === "warm") {
    return {
      deskBg: "#e4debf",
      paperBg: "#fdfcf0",
      paperBorder: "#d4cdad",
      lineColor: "#998f6d",
      gridColor: "#b5ab8b",
      dotColor: "#998f6d",
      marginRed: "#b83232",
      pageLabel: "#746a48",
      shadowAlpha1: "rgba(60, 50, 20, 0.14)",
      shadowAlpha2: "rgba(60, 50, 20, 0.06)",
      spineShadow: "rgba(60, 50, 20, 0.16)",
    };
  }
  if (t === "charcoal") {
    return {
      deskBg: "#141720",
      paperBg: "#232836",
      paperBorder: "#353f54",
      lineColor: "#546382",
      gridColor: "#414e69",
      dotColor: "#627294",
      marginRed: "#f472b6",
      pageLabel: "#94a3b8",
      shadowAlpha1: "rgba(0, 0, 0, 0.50)",
      shadowAlpha2: "rgba(0, 0, 0, 0.25)",
      spineShadow: "rgba(0, 0, 0, 0.55)",
    };
  }
  if (t === "dark") {
    return {
      deskBg: "#050507",
      paperBg: "#16161a",
      paperBorder: "#27272e",
      lineColor: "#444452",
      gridColor: "#33333e",
      dotColor: "#555566",
      marginRed: "#ef4444",
      pageLabel: "#a1a1aa",
      shadowAlpha1: "rgba(0, 0, 0, 0.60)",
      shadowAlpha2: "rgba(0, 0, 0, 0.35)",
      spineShadow: "rgba(0, 0, 0, 0.65)",
    };
  }
  // Default "light"
  return {
    deskBg: "#e8edf2",
    paperBg: "#ffffff",
    paperBorder: "#cbd5e1",
    lineColor: "#94a3b8",
    gridColor: "#cbd5e1",
    dotColor: "#94a3b8",
    marginRed: "#ef4444",
    pageLabel: "#64748b",
    shadowAlpha1: "rgba(0, 0, 0, 0.08)",
    shadowAlpha2: "rgba(0, 0, 0, 0.04)",
    spineShadow: "rgba(0, 0, 0, 0.12)",
  };
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  (
    {
      tool,
      color,
      strokeWidth,
      theme,
      mode,
      paperStyle,
      pageCount,
      pageLayout,
      pageBackgrounds = {},
      boardId,
      roomId,
      userName = "Guest",
      clampToPages = true,
      onToolChange,
      onBrushSizeChange,
      onCurrentPageChange,
      onCollaboratorsChange,
      onThumbnailsUpdate,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const bgRef = useRef<HTMLCanvasElement>(null);
    const mainRef = useRef<HTMLCanvasElement>(null);
    const drawRef = useRef<HTMLCanvasElement>(null);
    const cursorsRef = useRef<HTMLCanvasElement>(null);

    // Canvas state
    const isDrawing = useRef(false);
    const isPanning = useRef(false);
    const currentPoints = useRef<number[][]>([]);
    const strokes = useRef<StrokeData[]>([]);
    const images = useRef<ImageElement[]>([]);
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    // Page background images cache (for PDF pages)
    const pageBgCache = useRef<Map<number, HTMLImageElement>>(new Map());

    // Unified undo / redo stacks
    const undoStack = useRef<HistoryAction[]>([]);
    const redoStack = useRef<HistoryAction[]>([]);

    // Camera
    const cam = useRef({ x: 0, y: 0, zoom: 1 });
    const panStart = useRef({ x: 0, y: 0 });
    const spaceDown = useRef(false);
    const rafId = useRef<number | null>(null);

    // Selection & Manipulation state
    const selection = useRef<Set<string>>(new Set());
    const isDragging = useRef(false);
    const isResizing = useRef(false);
    const isRubberBand = useRef(false);
    const resizeCorner = useRef<string | null>(null);
    const dragLast = useRef({ x: 0, y: 0 });
    const rubberStart = useRef({ x: 0, y: 0 });
    const rubberEnd = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ x: 0, y: 0 });
    const resizeOrig = useRef({ x: 0, y: 0, w: 0, h: 0 });

    const moveSnapshots = useRef<
      {
        id: string;
        kind: "stroke" | "image";
        prev: { x: number; y: number } | number[][];
      }[]
    >([]);

    // Real-time collaboration
    const syncRef = useRef<BoardSync | null>(null);
    const remoteCursors = useRef<RemoteCursor[]>([]);

    // Mirror props into refs
    const toolRef = useRef(tool);
    const colorRef = useRef(color);
    const sizeRef = useRef(strokeWidth);
    const themeRef = useRef(theme);
    const modeRef = useRef(mode);
    const paperRef = useRef(paperStyle);
    const countRef = useRef(pageCount);
    const layoutRef = useRef(pageLayout);
    const bgsRef = useRef(pageBackgrounds);
    const onToolChangeRef = useRef(onToolChange);
    const onBrushSizeChangeRef = useRef(onBrushSizeChange);
    const onCurrentPageChangeRef = useRef(onCurrentPageChange);
    const boardIdRef = useRef(boardId);
    const clampRef = useRef(clampToPages);
    const onThumbnailsUpdateRef = useRef(onThumbnailsUpdate);

    // Performance Caching: Precomputed Path2D and Bounding Boxes
    const strokePathCache = useRef<Map<string, Path2D>>(new Map());
    const strokeBBoxCache = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
    const cachedThumbnails = useRef<Record<number, string>>({});
    const activeStrokePage = useRef<number>(1);
    const boundsCache = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
    const lastReportedPage = useRef<number>(1);

    useEffect(() => { toolRef.current = tool; }, [tool]);
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { sizeRef.current = strokeWidth; }, [strokeWidth]);
    useEffect(() => { onToolChangeRef.current = onToolChange; }, [onToolChange]);
    useEffect(() => { onBrushSizeChangeRef.current = onBrushSizeChange; }, [onBrushSizeChange]);
    useEffect(() => { onCurrentPageChangeRef.current = onCurrentPageChange; }, [onCurrentPageChange]);
    useEffect(() => { boardIdRef.current = boardId; }, [boardId]);
    useEffect(() => { clampRef.current = clampToPages; redrawAll(); }, [clampToPages]);
    useEffect(() => { onThumbnailsUpdateRef.current = onThumbnailsUpdate; }, [onThumbnailsUpdate]);

    useEffect(() => {
      themeRef.current = theme;
      cachedThumbnails.current = {};
      redrawAll();
      scheduleThumbnailUpdate();
    }, [theme]);

    useEffect(() => {
      modeRef.current = mode;
      paperRef.current = paperStyle;
      countRef.current = pageCount;
      layoutRef.current = pageLayout;
      bgsRef.current = pageBackgrounds;
      boundsCache.current = null;
      cachedThumbnails.current = {};

      // Preload background images
      for (const [pageNumStr, dataUrl] of Object.entries(pageBackgrounds)) {
        const num = Number(pageNumStr);
        if (!pageBgCache.current.has(num)) {
          const img = new Image();
          img.src = dataUrl;
          img.onload = () => redrawAll();
          pageBgCache.current.set(num, img);
        }
      }

      redrawAll();
      scheduleThumbnailUpdate();
    }, [mode, paperStyle, pageCount, pageLayout, pageBackgrounds]);

    useEffect(() => {
      if (!drawRef.current || spaceDown.current) return;
      drawRef.current.style.cursor = tool === "select" ? "default" : "crosshair";
    }, [tool]);

    // -------------------------
    //  Page Geometry Calculations & Flexible Layouts
    // -------------------------

    function getPageRect(pageIndex: number): { x: number; y: number; w: number; h: number } {
      const idx = pageIndex - 1;
      const layout = layoutRef.current;

      if (layout === "double") {
        // Facing pages spread with realistic notebook crease
        const spreadGap = 16;
        const row = Math.floor(idx / 2);
        const col = idx % 2;
        const x = col === 0 ? -PAGE_W - spreadGap / 2 : spreadGap / 2;
        const y = row * (PAGE_H + PAGE_GAP);
        return { x, y, w: PAGE_W, h: PAGE_H };
      }

      if (layout === "horizontal") {
        // All sheets side-by-side in 1 horizontal line
        const x = idx * (PAGE_W + PAGE_GAP);
        const y = 0;
        return { x, y, w: PAGE_W, h: PAGE_H };
      }

      if (layout === "grid-3") {
        const cols = 3;
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const totalW = cols * PAGE_W + (cols - 1) * PAGE_GAP;
        const startX = -totalW / 2;
        const x = startX + col * (PAGE_W + PAGE_GAP);
        const y = row * (PAGE_H + PAGE_GAP);
        return { x, y, w: PAGE_W, h: PAGE_H };
      }

      if (layout === "grid-4") {
        const cols = 4;
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const totalW = cols * PAGE_W + (cols - 1) * PAGE_GAP;
        const startX = -totalW / 2;
        const x = startX + col * (PAGE_W + PAGE_GAP);
        const y = row * (PAGE_H + PAGE_GAP);
        return { x, y, w: PAGE_W, h: PAGE_H };
      }

      if (layout === "grid-6") {
        const cols = 6;
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const totalW = cols * PAGE_W + (cols - 1) * PAGE_GAP;
        const startX = -totalW / 2;
        const x = startX + col * (PAGE_W + PAGE_GAP);
        const y = row * (PAGE_H + PAGE_GAP);
        return { x, y, w: PAGE_W, h: PAGE_H };
      }

      // Default: "single" (1 column centered horizontally)
      const x = -PAGE_W / 2;
      const y = idx * (PAGE_H + PAGE_GAP);
      return { x, y, w: PAGE_W, h: PAGE_H };
    }

    function getNotebookBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
      if (boundsCache.current) return boundsCache.current;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 1; i <= countRef.current; i++) {
        const p = getPageRect(i);
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x + p.w > maxX) maxX = p.x + p.w;
        if (p.y + p.h > maxY) maxY = p.y + p.h;
      }
      boundsCache.current = { minX, minY, maxX, maxY };
      return boundsCache.current;
    }

    function clampCamera() {
      if (modeRef.current !== "notebook") return;
      const b = getNotebookBounds();
      if (b.minX === Infinity) return;
      const rect = getRect();
      const zoom = cam.current.zoom;

      // Allow comfortable padding around pages but clamp infinite scrolling
      const padX = Math.max(160, rect.width * 0.4);
      const padY = Math.max(160, rect.height * 0.4);

      const minCamX = rect.width - padX - b.maxX * zoom;
      const maxCamX = padX - b.minX * zoom;
      const minCamY = rect.height - padY - b.maxY * zoom;
      const maxCamY = padY - b.minY * zoom;

      cam.current.x = Math.max(minCamX, Math.min(maxCamX, cam.current.x));
      cam.current.y = Math.max(minCamY, Math.min(maxCamY, cam.current.y));
    }

    function getPageForWorldPoint(wx: number, wy: number): number | null {
      for (let i = 1; i <= countRef.current; i++) {
        const p = getPageRect(i);
        if (wx >= p.x && wx <= p.x + p.w && wy >= p.y && wy <= p.y + p.h) {
          return i;
        }
      }
      return null;
    }

    function checkActivePage() {
      if (modeRef.current !== "notebook") return;
      const rect = getRect();
      const centerWorld = screenToWorld(rect.width / 2, rect.height / 2);

      let closestPage = 1;
      let minDistance = Infinity;

      for (let i = 1; i <= countRef.current; i++) {
        const pRect = getPageRect(i);
        const pageCenterX = pRect.x + pRect.w / 2;
        const pageCenterY = pRect.y + pRect.h / 2;
        const dx = centerWorld.x - pageCenterX;
        const dy = centerWorld.y - pageCenterY;
        const dist = dx * dx + dy * dy;
        if (dist < minDistance) {
          minDistance = dist;
          closestPage = i;
        }
      }

      if (lastReportedPage.current !== closestPage) {
        lastReportedPage.current = closestPage;
        onCurrentPageChangeRef.current?.(closestPage);
      }
    }

    // -------------------------
    //  Real-time Yjs Setup
    // -------------------------

    useEffect(() => {
      if (!roomId) {
        syncRef.current = null;
        remoteCursors.current = [];
        onCollaboratorsChange?.([]);
        return;
      }

      const sync = setupBoardSync(
        roomId,
        userName,
        () => {
          syncFromYjs();
        },
        (cursors) => {
          remoteCursors.current = cursors;
          onCollaboratorsChange?.(cursors);
          drawRemoteCursors();
        },
      );

      syncRef.current = sync;
      syncFromYjs();

      return () => {
        sync.destroy();
        syncRef.current = null;
      };
    }, [roomId, userName]);

    function syncFromYjs() {
      if (!syncRef.current) return;

      const yStrokes = Array.from(syncRef.current.strokesMap.values()) as StrokeData[];
      yStrokes.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      strokes.current = yStrokes;

      const yImages = Array.from(syncRef.current.imagesMap.values()) as ImageElement[];
      yImages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      images.current = yImages;

      for (const img of yImages) {
        if (!imageCache.current.has(img.src)) {
          const domImg = new Image();
          domImg.src = img.src;
          domImg.onload = () => redrawMain();
          imageCache.current.set(img.src, domImg);
        }
      }

      redrawMain();
    }

    // -------------------------
    //  Offline / Local Persistence & Camera State
    // -------------------------

    const persistTimer = useRef<any>(null);
    function persistLocalData(immediate = false) {
      if (syncRef.current || !boardIdRef.current) return;
      const doPersist = () => {
        const id = boardIdRef.current;
        if (!id) return;
        try {
          if (undoStack.current.length > 100) {
            undoStack.current = undoStack.current.slice(-100);
          }
          if (redoStack.current.length > 50) {
            redoStack.current = redoStack.current.slice(-50);
          }
          localStorage.setItem(`wb_strokes_${id}`, JSON.stringify(strokes.current));
          localStorage.setItem(`wb_images_${id}`, JSON.stringify(images.current));
          localStorage.setItem(`wb_undo_${id}`, JSON.stringify(undoStack.current));
          localStorage.setItem(`wb_redo_${id}`, JSON.stringify(redoStack.current));
        } catch (e) {
          console.warn("Failed to persist board state, attempting trimmed fallback:", e);
          try {
            localStorage.setItem(`wb_strokes_${id}`, JSON.stringify(strokes.current));
            localStorage.setItem(`wb_images_${id}`, JSON.stringify(images.current));
            localStorage.setItem(`wb_undo_${id}`, JSON.stringify(undoStack.current.slice(-20)));
            localStorage.setItem(`wb_redo_${id}`, JSON.stringify([]));
          } catch (err2) {
            console.error("Failed to persist local elements:", err2);
          }
        }
      };

      if (immediate) {
        if (persistTimer.current) clearTimeout(persistTimer.current);
        doPersist();
        return;
      }
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(doPersist, 150);
    }

    const camTimer = useRef<any>(null);
    function debouncedSaveCam() {
      if (!boardIdRef.current) return;
      if (camTimer.current) clearTimeout(camTimer.current);
      camTimer.current = setTimeout(() => {
        if (boardIdRef.current) {
          localStorage.setItem(`wb_cam_${boardIdRef.current}`, JSON.stringify(cam.current));
        }
      }, 200);
    }

    const camRafId = useRef<number | null>(null);
    function scheduleCameraRedraw() {
      if (camRafId.current !== null) return;
      camRafId.current = requestAnimationFrame(() => {
        camRafId.current = null;
        clampCamera();
        redrawAll();
        debouncedSaveCam();
      });
    }

    function migrateStrokesAndImages(
      rawStrokes: StrokeData[],
      rawImages: ImageElement[],
      isNotebook: boolean,
    ): { strokes: StrokeData[]; images: ImageElement[]; migrated: boolean } {
      if (!isNotebook) {
        return { strokes: rawStrokes, images: rawImages, migrated: false };
      }

      let migrated = false;
      const newStrokes: StrokeData[] = [];
      const newImages: ImageElement[] = [];

      for (const s of rawStrokes) {
        if ((s as any)._relative && s.page !== undefined) {
          newStrokes.push(s);
          continue;
        }

        const firstPt = s.points[0];
        if (!firstPt) {
          newStrokes.push({ ...s, page: s.page ?? 1, _relative: true } as any);
          continue;
        }

        const avgX = s.points.reduce((acc, p) => acc + p[0], 0) / s.points.length;
        const avgY = s.points.reduce((acc, p) => acc + p[1], 0) / s.points.length;

        let page = s.page;
        let points = s.points;

        if (page === undefined) {
          migrated = true;
          page = Math.max(1, Math.floor(avgY / (PAGE_H + PAGE_GAP)) + 1);
          const oldOriginY = (page - 1) * (PAGE_H + PAGE_GAP);
          points = points.map((p) => [
            p[0],
            p[1] - oldOriginY,
            p[2] !== undefined ? p[2] : 0.5,
          ]);
        } else if (page > 1 && avgY > PAGE_H) {
          migrated = true;
          const oldOriginY = (page - 1) * (PAGE_H + PAGE_GAP);
          points = points.map((p) => [
            p[0],
            p[1] - oldOriginY,
            p[2] !== undefined ? p[2] : 0.5,
          ]);
        }

        const minX = Math.min(...points.map((p) => p[0]));
        if (minX < -20 || (avgX < 200 && minX < 50)) {
          migrated = true;
          points = points.map((p) => [
            p[0] + PAGE_W / 2,
            p[1],
            p[2] !== undefined ? p[2] : 0.5,
          ]);
        }

        newStrokes.push({
          ...s,
          points,
          page: page || 1,
          _relative: true,
        } as any);
      }

      for (const img of rawImages) {
        if ((img as any)._relative && img.page !== undefined) {
          newImages.push(img);
          continue;
        }

        let page = img.page;
        let x = img.x;
        let y = img.y;

        if (page === undefined) {
          migrated = true;
          const centerY = y + img.height / 2;
          page = Math.max(1, Math.floor(centerY / (PAGE_H + PAGE_GAP)) + 1);
          const oldOriginY = (page - 1) * (PAGE_H + PAGE_GAP);
          y -= oldOriginY;
        } else if (page > 1 && y > PAGE_H) {
          migrated = true;
          const oldOriginY = (page - 1) * (PAGE_H + PAGE_GAP);
          y -= oldOriginY;
        }

        if (x < -20) {
          migrated = true;
          x += PAGE_W / 2;
        }

        newImages.push({
          ...img,
          x,
          y,
          page: page || 1,
          _relative: true,
        } as any);
      }

      return { strokes: newStrokes, images: newImages, migrated };
    }

    useEffect(() => {
      if (!roomId && boardId) {
        try {
          const rawStrokes = localStorage.getItem(`wb_strokes_${boardId}`);
          const parsedStrokes: StrokeData[] = rawStrokes ? JSON.parse(rawStrokes) : [];

          const rawImages = localStorage.getItem(`wb_images_${boardId}`);
          const parsedImages: ImageElement[] = rawImages ? JSON.parse(rawImages) : [];

          const rawUndo = localStorage.getItem(`wb_undo_${boardId}`);
          undoStack.current = rawUndo ? JSON.parse(rawUndo) : [];

          const rawRedo = localStorage.getItem(`wb_redo_${boardId}`);
          redoStack.current = rawRedo ? JSON.parse(rawRedo) : [];

          const { strokes: migratedStrokes, images: migratedImages, migrated } =
            migrateStrokesAndImages(parsedStrokes, parsedImages, modeRef.current === "notebook");

          strokes.current = migratedStrokes;
          images.current = migratedImages;

          for (const img of images.current) {
            if (!imageCache.current.has(img.src)) {
              const domImg = new Image();
              domImg.src = img.src;
              domImg.onload = () => redrawMain();
              imageCache.current.set(img.src, domImg);
            }
          }

          if (migrated) {
            persistLocalData(true);
          }

          strokePathCache.current.clear();
          strokeBBoxCache.current.clear();
          redrawMain();
          scheduleThumbnailUpdate();
        } catch (e) {
          console.error("Failed to load local board elements:", e);
        }
      } else {
        undoStack.current = [];
        redoStack.current = [];
      }
    }, [boardId, roomId]);

    // Initial Camera Load / Auto-center on Page 1
    useEffect(() => {
      if (!boardId) return;
      const savedCam = localStorage.getItem(`wb_cam_${boardId}`);
      if (savedCam) {
        try {
          cam.current = JSON.parse(savedCam);
          redrawAll();
          return;
        } catch (e) {}
      }

      // Default camera: auto-center on Page 1 if notebook mode
      const container = containerRef.current;
      const w = container ? container.clientWidth : window.innerWidth;

      if (modeRef.current === "notebook") {
        const fitZoom = Math.min(1.0, Math.max(0.35, (w - 100) / PAGE_W));
        cam.current = {
          x: w / 2,
          y: 36,
          zoom: fitZoom,
        };
      } else {
        cam.current = { x: w / 2, y: 100, zoom: 1 };
      }
      redrawAll();
    }, [boardId]);

    // -------------------------
    //  Live Thumbnail Generation (Debounced to Idle)
    // -------------------------

    const thumbnailTimer = useRef<any>(null);
    function scheduleThumbnailUpdate(targetPage?: number) {
      if (thumbnailTimer.current) clearTimeout(thumbnailTimer.current);
      thumbnailTimer.current = setTimeout(() => {
        generateThumbnails(targetPage);
      }, 1200);
    }

    function generateThumbnails(targetPage?: number) {
      const currentTheme = themeRef.current;
      const colors = getThemeColors(currentTheme);

      if (modeRef.current === "infinite") {
        if (!boardIdRef.current) return;
        if (strokes.current.length === 0 && images.current.length === 0) return;

        const thumbW = 200;
        const thumbH = 130;
        const canvas = document.createElement("canvas");
        canvas.width = thumbW;
        canvas.height = thumbH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of strokes.current) {
          const bb = getStrokeBBoxCached(s);
          minX = Math.min(minX, bb.x);
          minY = Math.min(minY, bb.y);
          maxX = Math.max(maxX, bb.x + bb.w);
          maxY = Math.max(maxY, bb.y + bb.h);
        }
        for (const img of images.current) {
          minX = Math.min(minX, img.x);
          minY = Math.min(minY, img.y);
          maxX = Math.max(maxX, img.x + img.width);
          maxY = Math.max(maxY, img.y + img.height);
        }

        ctx.fillStyle = colors.paperBg;
        ctx.fillRect(0, 0, thumbW, thumbH);

        const style = paperRef.current;
        if (style === "lined") {
          ctx.beginPath();
          ctx.strokeStyle = colors.lineColor;
          ctx.lineWidth = 1;
          for (let y = 0; y <= thumbH; y += 15) {
            ctx.moveTo(0, y - 0.5);
            ctx.lineTo(thumbW, y - 0.5);
          }
          ctx.stroke();
        } else if (style === "grid") {
          ctx.beginPath();
          ctx.strokeStyle = colors.gridColor;
          ctx.lineWidth = 1;
          for (let x = 0; x <= thumbW; x += 15) {
            ctx.moveTo(x - 0.5, 0);
            ctx.lineTo(x - 0.5, thumbH);
          }
          for (let y = 0; y <= thumbH; y += 15) {
            ctx.moveTo(0, y - 0.5);
            ctx.lineTo(thumbW, y - 0.5);
          }
          ctx.stroke();
        } else if (style === "dots") {
          ctx.fillStyle = colors.dotColor;
          for (let x = 8; x <= thumbW; x += 15) {
            for (let y = 8; y <= thumbH; y += 15) {
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }

        if (minX !== Infinity) {
          const contentW = Math.max(100, maxX - minX);
          const contentH = Math.max(80, maxY - minY);
          const pad = 30;
          const fitScale = Math.min((thumbW - pad) / contentW, (thumbH - pad) / contentH);
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          ctx.save();
          ctx.translate(thumbW / 2, thumbH / 2);
          ctx.scale(fitScale, fitScale);
          ctx.translate(-centerX, -centerY);

          for (const img of images.current) {
            const cached = imageCache.current.get(img.src);
            if (cached) ctx.drawImage(cached, img.x, img.y, img.width, img.height);
          }

          for (const stroke of strokes.current) {
            const path = getOrCreateStrokePath(stroke);
            if (path) {
              ctx.fillStyle = stroke.color;
              ctx.fill(path);
            }
          }
          ctx.restore();
        }

        try {
          const thumbUrl = canvas.toDataURL("image/jpeg", 0.7);
          localStorage.setItem(`wb_thumb_${boardIdRef.current}`, thumbUrl);
          const local = getLocalBoard(boardIdRef.current);
          if (local) {
            saveLocalBoard({ ...local, thumbnail: thumbUrl });
          }
        } catch (e) {}
        return;
      }

      if (modeRef.current !== "notebook") return;
      const count = countRef.current;
      const thumbW = 160;
      const thumbH = Math.round(thumbW * (PAGE_H / PAGE_W)); // 226px
      const scale = thumbW / PAGE_W;

      const canvas = document.createElement("canvas");
      canvas.width = thumbW;
      canvas.height = thumbH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const pagesToRender =
        targetPage !== undefined
          ? [targetPage]
          : Array.from({ length: count }, (_, idx) => idx + 1);

      for (const i of pagesToRender) {
        if (i < 1 || i > count) continue;
        ctx.clearRect(0, 0, thumbW, thumbH);

        // 1. Paper surface
        ctx.fillStyle = colors.paperBg;
        ctx.fillRect(0, 0, thumbW, thumbH);

        // 2. Background image or vector pattern
        const bgImg = pageBgCache.current.get(i);
        if (bgImg) {
          ctx.drawImage(bgImg, 0, 0, thumbW, thumbH);
        } else {
          const style = paperRef.current;
          if (style === "lined") {
            ctx.beginPath();
            ctx.strokeStyle = colors.lineColor;
            ctx.lineWidth = 1;
            const topMarginScaled = 40 * scale;
            const rowHeightScaled = 30 * scale;
            for (let r = 0; r <= 35; r++) {
              const ly = Math.round(topMarginScaled + r * rowHeightScaled) - 0.5;
              ctx.moveTo(0, ly);
              ctx.lineTo(thumbW, ly);
            }
            ctx.stroke();

            // Margin line
            ctx.strokeStyle = colors.marginRed;
            ctx.lineWidth = 1;
            ctx.beginPath();
            const marginX = Math.round(72 * scale) - 0.5;
            ctx.moveTo(marginX, 0);
            ctx.lineTo(marginX, thumbH);
            ctx.stroke();
          } else if (style === "grid") {
            const stepScaled = 25 * scale;
            const topMarginScaled = 15 * scale;
            ctx.beginPath();
            ctx.strokeStyle = colors.gridColor;
            ctx.lineWidth = 1;
            for (let r = 0; r <= 44; r++) {
              const ly = Math.round(topMarginScaled + r * stepScaled) - 0.5;
              ctx.moveTo(0, ly);
              ctx.lineTo(thumbW, ly);
            }
            for (let c = 0; c <= 32; c++) {
              const lx = Math.round(c * stepScaled) - 0.5;
              ctx.moveTo(lx, topMarginScaled);
              ctx.lineTo(lx, topMarginScaled + 44 * stepScaled);
            }
            ctx.stroke();
          } else if (style === "dots") {
            const stepScaled = 25 * scale;
            const topMarginScaled = 15 * scale;
            ctx.fillStyle = colors.dotColor;
            for (let r = 0; r <= 44; r++) {
              const ly = Math.round(topMarginScaled + r * stepScaled);
              for (let c = 1; c < 32; c++) {
                const lx = Math.round(c * stepScaled);
                ctx.fillRect(lx, ly, 1, 1);
              }
            }
          }
        }

        // 3. Render strokes & images on this page (page-relative coords)
        ctx.save();
        ctx.scale(scale, scale);

        for (const img of images.current) {
          if (img.page === i) {
            const cached = imageCache.current.get(img.src);
            if (cached) ctx.drawImage(cached, img.x, img.y, img.width, img.height);
          }
        }

        for (const stroke of strokes.current) {
          if (stroke.page === i) {
            const path = getOrCreateStrokePath(stroke);
            if (path) {
              ctx.fillStyle = stroke.color;
              ctx.fill(path);
            }
          }
        }

        ctx.restore();

        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          cachedThumbnails.current[i] = dataUrl;
          if (i === 1 && boardIdRef.current) {
            localStorage.setItem(`wb_thumb_${boardIdRef.current}`, dataUrl);
            const local = getLocalBoard(boardIdRef.current);
            if (local) {
              saveLocalBoard({ ...local, thumbnail: dataUrl });
            }
          }
        } catch (e) {}
      }

      onThumbnailsUpdateRef.current?.({ ...cachedThumbnails.current });
    }

    // -------------------------
    //  Coordinate and Hit Helpers
    // -------------------------

    function screenToWorld(sx: number, sy: number) {
      const c = cam.current;
      return { x: (sx - c.x) / c.zoom, y: (sy - c.y) / c.zoom };
    }

    function getRect() {
      return containerRef.current?.getBoundingClientRect() ?? {
        left: 0, top: 0, width: 0, height: 0,
      };
    }

    function makeId() {
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    function rectsOverlap(
      ax: number, ay: number, aw: number, ah: number,
      bx: number, by: number, bw: number, bh: number,
    ) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    // -------------------------
    //  Stroke Rendering & Path2D Caching
    // -------------------------

    function createStrokePath(points: number[][], size: number): Path2D | null {
      if (points.length === 1) {
        const [x, y] = points[0];
        const p = new Path2D();
        p.arc(x, y, size / 2, 0, Math.PI * 2);
        return p;
      }

      const outline = getStroke(points, {
        size,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: true,
      });
      if (outline.length < 2) return null;

      const path = new Path2D();
      path.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) {
        path.lineTo(outline[i][0], outline[i][1]);
      }
      path.closePath();
      return path;
    }

    function getOrCreateStrokePath(stroke: StrokeData): Path2D | null {
      let cached = strokePathCache.current.get(stroke.id);
      if (!cached) {
        const p = createStrokePath(stroke.points, stroke.size);
        if (p) {
          strokePathCache.current.set(stroke.id, p);
          cached = p;
        }
      }
      return cached || null;
    }

    function renderStroke(
      ctx: CanvasRenderingContext2D,
      points: number[][],
      strokeColor: string,
      size: number,
    ) {
      const path = createStrokePath(points, size);
      if (path) {
        ctx.fillStyle = strokeColor;
        ctx.fill(path);
      }
    }

    // -------------------------
    //  Bounding Box & Hit Testing
    // -------------------------

    function getStrokeBBox(stroke: StrokeData) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of stroke.points) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
      }
      const pad = stroke.size;
      return {
        x: minX - pad, y: minY - pad,
        w: maxX - minX + pad * 2, h: maxY - minY + pad * 2,
      };
    }

    function getStrokeBBoxCached(stroke: StrokeData) {
      let bb = strokeBBoxCache.current.get(stroke.id);
      if (!bb) {
        bb = getStrokeBBox(stroke);
        strokeBBoxCache.current.set(stroke.id, bb);
      }
      return bb;
    }

    function getClosestPage(x: number, y: number): number {
      let closestPage = 1;
      let minDistance = Infinity;
      for (let i = 1; i <= countRef.current; i++) {
        const p = getPageRect(i);
        if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
          return i;
        }
        const cx = Math.max(p.x, Math.min(x, p.x + p.w));
        const cy = Math.max(p.y, Math.min(y, p.y + p.h));
        const dx = x - cx;
        const dy = y - cy;
        const dist = dx * dx + dy * dy;
        if (dist < minDistance) {
          minDistance = dist;
          closestPage = i;
        }
      }
      return closestPage;
    }

    function getSelectionBBox() {
      if (selection.current.size === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (const id of selection.current) {
        const stroke = strokes.current.find((s) => s.id === id);
        if (stroke) {
          const bb = getStrokeBBox(stroke);
          let bx = bb.x;
          let by = bb.y;
          if (modeRef.current === "notebook" && stroke.page) {
            const p = getPageRect(stroke.page);
            bx += p.x;
            by += p.y;
          }
          minX = Math.min(minX, bx);
          minY = Math.min(minY, by);
          maxX = Math.max(maxX, bx + bb.w);
          maxY = Math.max(maxY, by + bb.h);
        }
        const img = images.current.find((i) => i.id === id);
        if (img) {
          let ix = img.x;
          let iy = img.y;
          if (modeRef.current === "notebook" && img.page) {
            const p = getPageRect(img.page);
            ix += p.x;
            iy += p.y;
          }
          minX = Math.min(minX, ix);
          minY = Math.min(minY, iy);
          maxX = Math.max(maxX, ix + img.width);
          maxY = Math.max(maxY, iy + img.height);
        }
      }
      if (minX === Infinity) return null;
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    function hitTestStroke(wx: number, wy: number): string | null {
      const baseThreshold = 8 / cam.current.zoom;

      if (modeRef.current === "notebook") {
        const page = getPageForWorldPoint(wx, wy);
        if (!page) return null;
        const pRect = getPageRect(page);
        const lx = wx - pRect.x;
        const ly = wy - pRect.y;

        for (let i = strokes.current.length - 1; i >= 0; i--) {
          const stroke = strokes.current[i];
          if (stroke.page !== page) continue;
          const threshold = Math.max(baseThreshold, stroke.size / 2);
          const t2 = threshold * threshold;
          for (const p of stroke.points) {
            const dx = p[0] - lx;
            const dy = p[1] - ly;
            if (dx * dx + dy * dy < t2) return stroke.id;
          }
        }
        return null;
      }

      for (let i = strokes.current.length - 1; i >= 0; i--) {
        const stroke = strokes.current[i];
        const threshold = Math.max(baseThreshold, stroke.size / 2);
        const t2 = threshold * threshold;
        for (const p of stroke.points) {
          const dx = p[0] - wx;
          const dy = p[1] - wy;
          if (dx * dx + dy * dy < t2) return stroke.id;
        }
      }
      return null;
    }

    function hitTestImage(wx: number, wy: number): string | null {
      if (modeRef.current === "notebook") {
        const page = getPageForWorldPoint(wx, wy);
        if (!page) return null;
        const pRect = getPageRect(page);
        const lx = wx - pRect.x;
        const ly = wy - pRect.y;

        for (let i = images.current.length - 1; i >= 0; i--) {
          const img = images.current[i];
          if (img.page !== page) continue;
          if (
            lx >= img.x &&
            lx <= img.x + img.width &&
            ly >= img.y &&
            ly <= img.y + img.height
          ) {
            return img.id;
          }
        }
        return null;
      }

      for (let i = images.current.length - 1; i >= 0; i--) {
        const img = images.current[i];
        if (
          wx >= img.x &&
          wx <= img.x + img.width &&
          wy >= img.y &&
          wy <= img.y + img.height
        ) {
          return img.id;
        }
      }
      return null;
    }

    function hitTestElement(wx: number, wy: number): string | null {
      return hitTestImage(wx, wy) ?? hitTestStroke(wx, wy);
    }

    function hitTestHandle(wx: number, wy: number): string | null {
      if (selection.current.size !== 1) return null;
      const id = Array.from(selection.current)[0];
      const img = images.current.find((i) => i.id === id);
      if (!img) return null;

      let imgWorldX = img.x;
      let imgWorldY = img.y;
      if (modeRef.current === "notebook" && img.page) {
        const pRect = getPageRect(img.page);
        imgWorldX += pRect.x;
        imgWorldY += pRect.y;
      }

      const t = 10 / cam.current.zoom;
      const corners = [
        { id: "tl", x: imgWorldX, y: imgWorldY },
        { id: "tr", x: imgWorldX + img.width, y: imgWorldY },
        { id: "bl", x: imgWorldX, y: imgWorldY + img.height },
        { id: "br", x: imgWorldX + img.width, y: imgWorldY + img.height },
      ];
      for (const c of corners) {
        if (Math.abs(wx - c.x) < t && Math.abs(wy - c.y) < t) return c.id;
      }
      return null;
    }

    function elementsInRect(rx: number, ry: number, rw: number, rh: number) {
      const ids: string[] = [];

      if (modeRef.current === "notebook") {
        for (let pIdx = 1; pIdx <= countRef.current; pIdx++) {
          const p = getPageRect(pIdx);
          if (!rectsOverlap(rx, ry, rw, rh, p.x, p.y, p.w, p.h)) continue;

          const localRx = rx - p.x;
          const localRy = ry - p.y;

          for (const stroke of strokes.current) {
            if (stroke.page !== pIdx) continue;
            const bb = getStrokeBBoxCached(stroke);
            if (rectsOverlap(localRx, localRy, rw, rh, bb.x, bb.y, bb.w, bb.h)) {
              ids.push(stroke.id);
            }
          }

          for (const img of images.current) {
            if (img.page !== pIdx) continue;
            if (rectsOverlap(localRx, localRy, rw, rh, img.x, img.y, img.width, img.height)) {
              ids.push(img.id);
            }
          }
        }
        return ids;
      }

      for (const stroke of strokes.current) {
        const bb = getStrokeBBoxCached(stroke);
        if (rectsOverlap(rx, ry, rw, rh, bb.x, bb.y, bb.w, bb.h)) {
          ids.push(stroke.id);
        }
      }
      for (const img of images.current) {
        if (rectsOverlap(rx, ry, rw, rh, img.x, img.y, img.width, img.height)) {
          ids.push(img.id);
        }
      }
      return ids;
    }

    // -------------------------
    //  Background & Multi-Page Render
    // -------------------------

    function drawPaperSheetContent(
      ctx: CanvasRenderingContext2D,
      px: number,
      py: number,
      pw: number,
      ph: number,
      themeKey: EffectiveTheme,
      pageCol?: number,
      isDoubleSpread?: boolean,
    ) {
      const style = paperRef.current;
      const colors = getThemeColors(themeKey);

      if (style === "lined") {
        ctx.save();
        // Page-anchored ruled lines: 35 full-height rows of 30px, with 40px top and 40px bottom margins (40 + 35 * 30 + 40 = 1130).
        // Produces identical, full-height rows at both top and bottom on every page.
        ctx.beginPath();
        ctx.strokeStyle = colors.lineColor;
        ctx.lineWidth = 1;
        const topMargin = 40;
        const rowHeight = 30;
        for (let r = 0; r <= 35; r++) {
          const ly = Math.round(py + topMargin + r * rowHeight) - 0.5;
          ctx.moveTo(px, ly);
          ctx.lineTo(px + pw, ly);
        }
        ctx.stroke();

        // Notebook vertical red margin line
        ctx.beginPath();
        ctx.strokeStyle = colors.marginRed;
        ctx.lineWidth = 1.5;
        let marginX = Math.round(px + 72) - 0.5;
        if (isDoubleSpread && pageCol === 1) {
          marginX = Math.round(px + pw - 72) - 0.5;
        }
        ctx.moveTo(marginX, py);
        ctx.lineTo(marginX, py + ph);
        ctx.stroke();
        ctx.restore();
      } else if (style === "grid") {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = colors.gridColor;
        ctx.lineWidth = 1;
        const step = 25;
        const topMargin = 15;
        for (let r = 0; r <= 44; r++) {
          const ly = Math.round(py + topMargin + r * step) - 0.5;
          ctx.moveTo(px, ly);
          ctx.lineTo(px + pw, ly);
        }
        for (let c = 0; c <= 32; c++) {
          const lx = Math.round(px + c * step) - 0.5;
          ctx.moveTo(lx, py + topMargin - 0.5);
          ctx.lineTo(lx, py + topMargin + 44 * step - 0.5);
        }
        ctx.stroke();
        ctx.restore();
      } else if (style === "dots") {
        ctx.save();
        ctx.fillStyle = colors.dotColor;
        const step = 25;
        const topMargin = 15;
        for (let r = 0; r <= 44; r++) {
          const ly = Math.round(py + topMargin + r * step);
          for (let c = 1; c < 32; c++) {
            const lx = Math.round(px + c * step);
            ctx.fillRect(lx - 0.75, ly - 0.75, 1.5, 1.5);
          }
        }
        ctx.restore();
      }

      if (isDoubleSpread) {
        ctx.save();
        if (pageCol === 0) {
          const spineW = 28;
          const grad = ctx.createLinearGradient(px + pw - spineW, 0, px + pw, 0);
          grad.addColorStop(0, "transparent");
          grad.addColorStop(1, colors.spineShadow);
          ctx.fillStyle = grad;
          ctx.fillRect(px + pw - spineW, py, spineW, ph);
        } else if (pageCol === 1) {
          const spineW = 28;
          const grad = ctx.createLinearGradient(px, 0, px + spineW, 0);
          grad.addColorStop(0, colors.spineShadow);
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.fillRect(px, py, spineW, ph);
        }
        ctx.restore();
      }
    }

    function drawInfiniteCanvasContent(
      ctx: CanvasRenderingContext2D,
      worldLeft: number,
      worldTop: number,
      worldWidth: number,
      worldHeight: number,
      themeKey: EffectiveTheme,
    ) {
      const style = paperRef.current;
      const colors = getThemeColors(themeKey);

      if (style === "lined") {
        const rowHeight = 30;
        const startY = Math.floor(worldTop / rowHeight) * rowHeight;
        const endY = worldTop + worldHeight;
        ctx.strokeStyle = colors.lineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = startY; y <= endY; y += rowHeight) {
          const ly = Math.round(y) - 0.5;
          ctx.moveTo(worldLeft, ly);
          ctx.lineTo(worldLeft + worldWidth, ly);
        }
        ctx.stroke();
      } else if (style === "grid") {
        const step = 25;
        const startX = Math.floor(worldLeft / step) * step;
        const endX = worldLeft + worldWidth;
        const startY = Math.floor(worldTop / step) * step;
        const endY = worldTop + worldHeight;
        ctx.strokeStyle = colors.gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = startY; y <= endY; y += step) {
          const ly = Math.round(y) - 0.5;
          ctx.moveTo(worldLeft, ly);
          ctx.lineTo(worldLeft + worldWidth, ly);
        }
        for (let x = startX; x <= endX; x += step) {
          const lx = Math.round(x) - 0.5;
          ctx.moveTo(lx, worldTop);
          ctx.lineTo(lx, worldTop + worldHeight);
        }
        ctx.stroke();
      } else if (style === "dots") {
        const step = 25;
        const startX = Math.floor(worldLeft / step) * step;
        const endX = worldLeft + worldWidth;
        const startY = Math.floor(worldTop / step) * step;
        const endY = worldTop + worldHeight;
        ctx.fillStyle = colors.dotColor;
        for (let y = startY; y <= endY; y += step) {
          const ly = Math.round(y);
          for (let x = startX; x <= endX; x += step) {
            const lx = Math.round(x);
            ctx.fillRect(lx - 0.75, ly - 0.75, 1.5, 1.5);
          }
        }
      }
    }

    function drawBackground() {
      const canvas = bgRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const currentTheme = themeRef.current;
      const colors = getThemeColors(currentTheme);
      const dpr = getDpr();
      const c = cam.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (modeRef.current === "notebook") {
        ctx.fillStyle = colors.deskBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.setTransform(c.zoom * dpr, 0, 0, c.zoom * dpr, c.x * dpr, c.y * dpr);

        const viewLeft = -c.x / c.zoom;
        const viewTop = -c.y / c.zoom;
        const viewW = canvas.width / dpr / c.zoom;
        const viewH = canvas.height / dpr / c.zoom;

        const isDoubleSpread = layoutRef.current === "double";

        // Pass 1: Render all paper sheets and drop shadows
        for (let i = 1; i <= countRef.current; i++) {
          const p = getPageRect(i);

          if (!rectsOverlap(viewLeft, viewTop, viewW, viewH, p.x, p.y, p.w, p.h)) {
            continue;
          }

          const pageCol = isDoubleSpread ? (i - 1) % 2 : 0;

          // Fast hardware-accelerated drop shadow
          ctx.fillStyle = colors.shadowAlpha2;
          ctx.fillRect(p.x - 3, p.y + 2, p.w + 6, p.h + 8);
          ctx.fillStyle = colors.shadowAlpha1;
          ctx.fillRect(p.x - 1, p.y + 1, p.w + 2, p.h + 4);

          // Paper surface
          ctx.fillStyle = colors.paperBg;
          ctx.fillRect(p.x, p.y, p.w, p.h);

          ctx.strokeStyle = colors.paperBorder;
          ctx.lineWidth = 1 / c.zoom;
          ctx.strokeRect(p.x, p.y, p.w, p.h);

          // Clip to paper interior
          ctx.save();
          ctx.beginPath();
          ctx.rect(p.x, p.y, p.w, p.h);
          ctx.clip();

          // Render PDF background image if present
          const bgImg = pageBgCache.current.get(i);
          if (bgImg) {
            ctx.drawImage(bgImg, p.x, p.y, p.w, p.h);
          } else {
            drawPaperSheetContent(ctx, p.x, p.y, p.w, p.h, currentTheme, pageCol, isDoubleSpread);
          }

          ctx.restore();
        }

        // Pass 2: Render page number labels in desk margin, perfectly centered in gap
        ctx.fillStyle = colors.pageLabel;
        const fontSize = Math.min(16, Math.max(11, 13 / Math.max(c.zoom, 0.7)));
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (let i = 1; i <= countRef.current; i++) {
          const p = getPageRect(i);
          const labelY = p.y + p.h + PAGE_GAP / 2;

          if (!rectsOverlap(viewLeft, viewTop, viewW, viewH, p.x, labelY - 20, p.w, 40)) {
            continue;
          }

          ctx.fillText(`Page ${i}`, p.x + p.w / 2, labelY);
        }

        ctx.restore();
      } else {
        ctx.fillStyle = colors.paperBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const worldLeft = -c.x / c.zoom;
        const worldTop = -c.y / c.zoom;
        const worldWidth = canvas.width / dpr / c.zoom;
        const worldHeight = canvas.height / dpr / c.zoom;

        ctx.save();
        ctx.setTransform(c.zoom * dpr, 0, 0, c.zoom * dpr, c.x * dpr, c.y * dpr);
        drawInfiniteCanvasContent(ctx, worldLeft, worldTop, worldWidth, worldHeight, currentTheme);
        ctx.restore();
      }
    }

    function redrawMain() {
      const canvas = mainRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = getDpr();
      const c = cam.current;
      const rect = getRect();

      const viewL = -c.x / c.zoom;
      const viewT = -c.y / c.zoom;
      const viewR = (rect.width - c.x) / c.zoom;
      const viewB = (rect.height - c.y) / c.zoom;
      const viewW = viewR - viewL;
      const viewH = viewB - viewT;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.setTransform(c.zoom * dpr, 0, 0, c.zoom * dpr, c.x * dpr, c.y * dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (modeRef.current === "notebook") {
        for (let i = 1; i <= countRef.current; i++) {
          const p = getPageRect(i);
          if (!rectsOverlap(viewL, viewT, viewW, viewH, p.x, p.y, p.w, p.h)) {
            continue;
          }

          ctx.save();
          ctx.translate(p.x, p.y);

          if (clampRef.current) {
            ctx.beginPath();
            ctx.rect(0, 0, p.w, p.h);
            ctx.clip();
          }

          // Images on this page (page-relative)
          for (const img of images.current) {
            if (img.page === i) {
              const cached = imageCache.current.get(img.src);
              if (cached) ctx.drawImage(cached, img.x, img.y, img.width, img.height);
            }
          }

          // Strokes on this page (page-relative)
          for (const stroke of strokes.current) {
            if (stroke.page === i) {
              const path = getOrCreateStrokePath(stroke);
              if (path) {
                ctx.fillStyle = stroke.color;
                ctx.fill(path);
              }
            }
          }

          ctx.restore();
        }
      } else {
        for (const img of images.current) {
          if (
            img.x + img.width < viewL ||
            img.x > viewR ||
            img.y + img.height < viewT ||
            img.y > viewB
          ) {
            continue;
          }
          const cached = imageCache.current.get(img.src);
          if (cached) ctx.drawImage(cached, img.x, img.y, img.width, img.height);
        }

        for (const stroke of strokes.current) {
          const bb = getStrokeBBoxCached(stroke);
          if (
            bb.x + bb.w < viewL ||
            bb.x > viewR ||
            bb.y + bb.h < viewT ||
            bb.y > viewB
          ) {
            continue;
          }

          const path = getOrCreateStrokePath(stroke);
          if (path) {
            ctx.fillStyle = stroke.color;
            ctx.fill(path);
          }
        }
      }

      ctx.restore();
    }

    function drawActiveStroke() {
      const canvas = drawRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = getDpr();
      const c = cam.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (currentPoints.current.length === 0) return;

      ctx.save();
      ctx.setTransform(c.zoom * dpr, 0, 0, c.zoom * dpr, c.x * dpr, c.y * dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (modeRef.current === "notebook") {
        const pRect = getPageRect(activeStrokePage.current);
        ctx.translate(pRect.x, pRect.y);

        if (clampRef.current) {
          ctx.beginPath();
          ctx.rect(0, 0, PAGE_W, PAGE_H);
          ctx.clip();
        }
      }

      if (currentPoints.current.length === 1) {
        const [x, y] = currentPoints.current[0];
        ctx.fillStyle = colorRef.current;
        ctx.beginPath();
        ctx.arc(x, y, sizeRef.current / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        renderStroke(ctx, currentPoints.current, colorRef.current, sizeRef.current);
      }

      ctx.restore();
    }

    function scheduleActiveDraw() {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        drawActiveStroke();
      });
    }

    function redrawAll() {
      drawBackground();
      redrawMain();
      drawRemoteCursors();
      if (selection.current.size > 0) drawSelectionOverlay();
      checkActivePage();
    }

    // -------------------------
    //  Collaborator Cursors Overlay
    // -------------------------

    function drawRemoteCursors() {
      const canvas = cursorsRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = getDpr();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (remoteCursors.current.length === 0) return;
      const c = cam.current;

      for (const cursor of remoteCursors.current) {
        const sx = cursor.x * c.zoom + c.x;
        const sy = cursor.y * c.zoom + c.y;

        ctx.save();
        ctx.translate(sx * dpr, sy * dpr);

        ctx.fillStyle = cursor.color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 16);
        ctx.lineTo(5, 12);
        ctx.lineTo(11, 12);
        ctx.closePath();
        ctx.fill();

        ctx.font = `600 ${11 * dpr}px sans-serif`;
        const textPad = 6 * dpr;
        const textWidth = ctx.measureText(cursor.name).width;
        const boxH = 18 * dpr;
        const boxW = textWidth + textPad * 2;

        ctx.fillStyle = cursor.color;
        ctx.beginPath();
        ctx.roundRect(10 * dpr, 10 * dpr, boxW, boxH, 4 * dpr);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.fillText(cursor.name, 10 * dpr + textPad, 10 * dpr + 13 * dpr);

        ctx.restore();
      }
    }

    // -------------------------
    //  Selection Overlay with Individual Stroke Highlight Glow
    // -------------------------

    function drawSelectionOverlay() {
      const canvas = drawRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = getDpr();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (selection.current.size === 0) return;

      const isDark = themeRef.current === "dark";
      const c = cam.current;

      ctx.save();
      ctx.setTransform(c.zoom * dpr, 0, 0, c.zoom * dpr, c.x * dpr, c.y * dpr);

      // 1. INDIVIDUAL STROKE HIGHLIGHT GLOW (User requirement)
      for (const id of selection.current) {
        const stroke = strokes.current.find((s) => s.id === id);
        if (stroke && stroke.points.length > 0) {
          ctx.save();
          let ox = 0;
          let oy = 0;
          if (modeRef.current === "notebook" && stroke.page) {
            const p = getPageRect(stroke.page);
            ox = p.x;
            oy = p.y;
          }

          ctx.strokeStyle = isDark ? "rgba(96, 165, 250, 0.45)" : "rgba(37, 99, 235, 0.35)";
          ctx.lineWidth = stroke.size + 8 / c.zoom;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.beginPath();
          for (let i = 0; i < stroke.points.length; i++) {
            const [px, py] = stroke.points[i];
            if (i === 0) ctx.moveTo(px + ox, py + oy);
            else ctx.lineTo(px + ox, py + oy);
          }
          ctx.stroke();

          // Stroke inner accent highlight line
          ctx.strokeStyle = isDark ? "#60a5fa" : "#2563eb";
          ctx.lineWidth = 1.5 / c.zoom;
          ctx.stroke();

          ctx.restore();
        }
      }

      // 2. Global Bounding Box
      const bbox = getSelectionBBox();
      if (bbox) {
        ctx.strokeStyle = isDark ? "#a3a3a3" : "#525252";
        ctx.lineWidth = 1.2 / c.zoom;
        ctx.setLineDash([4 / c.zoom, 4 / c.zoom]);
        ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
        ctx.setLineDash([]);

        // Resize handles for single image
        if (selection.current.size === 1) {
          const id = Array.from(selection.current)[0];
          const img = images.current.find((i) => i.id === id);
          if (img) {
            let imgWorldX = img.x;
            let imgWorldY = img.y;
            if (modeRef.current === "notebook" && img.page) {
              const p = getPageRect(img.page);
              imgWorldX += p.x;
              imgWorldY += p.y;
            }

            const hs = 7 / c.zoom;
            ctx.fillStyle = isDark ? "#171717" : "#ffffff";
            ctx.strokeStyle = isDark ? "#ffffff" : "#171717";
            ctx.lineWidth = 1.2 / c.zoom;
            for (const corner of [
              { x: imgWorldX, y: imgWorldY },
              { x: imgWorldX + img.width, y: imgWorldY },
              { x: imgWorldX, y: imgWorldY + img.height },
              { x: imgWorldX + img.width, y: imgWorldY + img.height },
            ]) {
              ctx.fillRect(corner.x - hs / 2, corner.y - hs / 2, hs, hs);
              ctx.strokeRect(corner.x - hs / 2, corner.y - hs / 2, hs, hs);
            }
          }
        }
      }

      ctx.restore();
    }

    function drawRubberBand() {
      const canvas = drawRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = getDpr();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const s = rubberStart.current;
      const e = rubberEnd.current;
      const rx = Math.min(s.x, e.x);
      const ry = Math.min(s.y, e.y);
      const rw = Math.abs(e.x - s.x);
      const rh = Math.abs(e.y - s.y);

      const isDark = themeRef.current === "dark";
      const c = cam.current;

      ctx.save();
      ctx.setTransform(c.zoom * dpr, 0, 0, c.zoom * dpr, c.x * dpr, c.y * dpr);

      ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = isDark ? "#737373" : "#a3a3a3";
      ctx.lineWidth = 1 / c.zoom;
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.restore();
    }

    // -------------------------
    //  Image Insertion
    // -------------------------

    async function handleInsertImageFile(file: File) {
      let url = "";
      try {
        const res = await api.uploadImage(file);
        if (res.url) {
          url = api.getImageUrl(res.url);
        }
      } catch (err) {
        console.log("[image] local fallback for upload:", err);
      }

      if (!url) {
        // Read file as base64 data URL so it can be saved offline and exported
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            loadAndInsertImage(reader.result);
          }
        };
        reader.readAsDataURL(file);
        return;
      }

      loadAndInsertImage(url);
    }

    function loadAndInsertImage(url: string) {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const maxDisplayDim = modeRef.current === "notebook" ? Math.min(PAGE_W * 0.85, 680) : 900;
        if (w > maxDisplayDim || h > maxDisplayDim) {
          const scale = maxDisplayDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const rect = getRect();
        const center = screenToWorld(rect.width / 2, rect.height / 2);

        let targetPage: number | undefined = undefined;
        let imgX = center.x - w / 2;
        let imgY = center.y - h / 2;

        if (modeRef.current === "notebook") {
          targetPage = getPageForWorldPoint(center.x, center.y) || 1;
          const p = getPageRect(targetPage);
          imgX = center.x - p.x - w / 2;
          imgY = center.y - p.y - h / 2;
        }

        const element: ImageElement = {
          id: makeId(),
          src: url,
          x: imgX,
          y: imgY,
          width: w,
          height: h,
          createdAt: Date.now(),
          page: targetPage,
          _relative: true,
        } as any;

        images.current.push(element);
        imageCache.current.set(url, img);

        undoStack.current.push({ type: "add_image", image: element });
        redoStack.current = [];

        if (syncRef.current) {
          syncRef.current.imagesMap.set(element.id, element);
        }

        redrawMain();
        persistLocalData();
        scheduleThumbnailUpdate(targetPage);
      };
      img.src = url;
    }

    // -------------------------
    //  Eraser
    // -------------------------

    function eraseAt(clientX: number, clientY: number) {
      const rect = getRect();
      const world = screenToWorld(clientX - rect.left, clientY - rect.top);
      const radius = 12 / cam.current.zoom;
      const radiusSq = radius * radius;
      const erasedStrokes: StrokeData[] = [];

      if (modeRef.current === "notebook") {
        const page = getPageForWorldPoint(world.x, world.y);
        if (!page) return;
        const p = getPageRect(page);
        const lx = world.x - p.x;
        const ly = world.y - p.y;

        strokes.current = strokes.current.filter((s) => {
          if (s.page !== page) return true;
          const bb = getStrokeBBoxCached(s);
          if (
            lx < bb.x - radius ||
            lx > bb.x + bb.w + radius ||
            ly < bb.y - radius ||
            ly > bb.y + bb.h + radius
          ) {
            return true;
          }
          const hit = s.points.some((pt) => {
            const dx = pt[0] - lx;
            const dy = pt[1] - ly;
            return dx * dx + dy * dy < radiusSq;
          });
          if (hit) erasedStrokes.push(s);
          return !hit;
        });
      } else {
        strokes.current = strokes.current.filter((s) => {
          const bb = getStrokeBBoxCached(s);
          if (
            world.x < bb.x - radius ||
            world.x > bb.x + bb.w + radius ||
            world.y < bb.y - radius ||
            world.y > bb.y + bb.h + radius
          ) {
            return true;
          }
          const hit = s.points.some((p) => {
            const dx = p[0] - world.x;
            const dy = p[1] - world.y;
            return dx * dx + dy * dy < radiusSq;
          });
          if (hit) erasedStrokes.push(s);
          return !hit;
        });
      }

      if (erasedStrokes.length > 0) {
        for (const s of erasedStrokes) {
          strokePathCache.current.delete(s.id);
          strokeBBoxCache.current.delete(s.id);
        }

        undoStack.current.push({
          type: "delete",
          strokes: erasedStrokes,
          images: [],
        });
        redoStack.current = [];

        if (syncRef.current) {
          for (const s of erasedStrokes) {
            syncRef.current.strokesMap.delete(s.id);
          }
        }
        redrawMain();
        persistLocalData();
        scheduleThumbnailUpdate(activeStrokePage.current);
      }
    }

    // -------------------------
    //  Move Selection
    // -------------------------

    function moveSelectionBy(dx: number, dy: number) {
      for (const id of selection.current) {
        const stroke = strokes.current.find((s) => s.id === id);
        if (stroke) {
          for (const p of stroke.points) {
            p[0] += dx;
            p[1] += dy;
          }
          strokePathCache.current.delete(stroke.id);
          strokeBBoxCache.current.delete(stroke.id);
        }
        const img = images.current.find((i) => i.id === id);
        if (img) {
          img.x += dx;
          img.y += dy;
        }
      }
    }

    function commitSelectionMove() {
      if (moveSnapshots.current.length === 0) return;

      const items: {
        id: string;
        kind: "stroke" | "image";
        prev: { x: number; y: number } | number[][];
        next: { x: number; y: number } | number[][];
      }[] = [];

      for (const snap of moveSnapshots.current) {
        if (snap.kind === "stroke") {
          const stroke = strokes.current.find((s) => s.id === snap.id);
          if (stroke) {
            if (modeRef.current === "notebook" && stroke.points.length > 0 && stroke.page) {
              const oldPageRect = getPageRect(stroke.page);
              const currentWorldX = stroke.points[0][0] + oldPageRect.x;
              const currentWorldY = stroke.points[0][1] + oldPageRect.y;
              const targetPage = getPageForWorldPoint(currentWorldX, currentWorldY);
              if (targetPage && targetPage !== stroke.page) {
                const targetRect = getPageRect(targetPage);
                stroke.points = stroke.points.map((pt) => [
                  pt[0] + oldPageRect.x - targetRect.x,
                  pt[1] + oldPageRect.y - targetRect.y,
                  pt[2],
                ]);
                stroke.page = targetPage;
              }
            }
            items.push({
              id: stroke.id,
              kind: "stroke",
              prev: snap.prev,
              next: stroke.points.map((p) => [...p]),
            });
            if (syncRef.current) {
              syncRef.current.strokesMap.set(stroke.id, { ...stroke });
            }
          }
        } else {
          const img = images.current.find((i) => i.id === snap.id);
          if (img) {
            if (modeRef.current === "notebook" && img.page) {
              const oldPageRect = getPageRect(img.page);
              const currentWorldX = img.x + oldPageRect.x + img.width / 2;
              const currentWorldY = img.y + oldPageRect.y + img.height / 2;
              const targetPage = getPageForWorldPoint(currentWorldX, currentWorldY);
              if (targetPage && targetPage !== img.page) {
                const targetRect = getPageRect(targetPage);
                img.x = img.x + oldPageRect.x - targetRect.x;
                img.y = img.y + oldPageRect.y - targetRect.y;
                img.page = targetPage;
              }
            }
            items.push({
              id: img.id,
              kind: "image",
              prev: snap.prev,
              next: { x: img.x, y: img.y },
            });
            if (syncRef.current) {
              syncRef.current.imagesMap.set(img.id, { ...img });
            }
          }
        }
      }

      if (items.length > 0) {
        undoStack.current.push({ type: "move", items });
        redoStack.current = [];
        persistLocalData();
        scheduleThumbnailUpdate();
      }
      moveSnapshots.current = [];
    }

    // -------------------------
    //  Pointer Handlers
    // -------------------------

    function handlePointerDown(e: React.PointerEvent) {
      const rect = getRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);

      // Middle click or space+click = Pan
      if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
        isPanning.current = true;
        panStart.current = { x: e.clientX - cam.current.x, y: e.clientY - cam.current.y };
        (e.target as Element).setPointerCapture(e.pointerId);
        if (drawRef.current) drawRef.current.style.cursor = "grabbing";
        return;
      }
      if (e.button !== 0) return;

      // Select tool
      if (toolRef.current === "select") {
        (e.target as Element).setPointerCapture(e.pointerId);

        const handle = hitTestHandle(world.x, world.y);
        if (handle) {
          isResizing.current = true;
          resizeCorner.current = handle;
          resizeStart.current = { x: world.x, y: world.y };
          const id = Array.from(selection.current)[0];
          const img = images.current.find((i) => i.id === id)!;
          resizeOrig.current = { x: img.x, y: img.y, w: img.width, h: img.height };
          return;
        }

        const hitId = hitTestElement(world.x, world.y);
        if (hitId) {
          if (e.shiftKey) {
            if (selection.current.has(hitId)) {
              selection.current.delete(hitId);
            } else {
              selection.current.add(hitId);
            }
            drawSelectionOverlay();
            return;
          }

          if (!selection.current.has(hitId)) {
            selection.current = new Set([hitId]);
            drawSelectionOverlay();
          }

          isDragging.current = true;
          dragLast.current = { x: world.x, y: world.y };
          moveSnapshots.current = Array.from(selection.current).map((id) => {
            const s = strokes.current.find((str) => str.id === id);
            if (s) {
              return { id, kind: "stroke" as const, prev: s.points.map((p) => [...p]) };
            }
            const im = images.current.find((img) => img.id === id)!;
            return { id, kind: "image" as const, prev: { x: im.x, y: im.y } };
          });
          return;
        }

        isRubberBand.current = true;
        rubberStart.current = { x: world.x, y: world.y };
        rubberEnd.current = { x: world.x, y: world.y };
        return;
      }

      // Pen tool (single dot fix + notebook page check)
      if (toolRef.current === "pen") {
        if (modeRef.current === "notebook") {
          const pageNum = getPageForWorldPoint(world.x, world.y);
          if (!pageNum) {
            if (clampRef.current) return;
            activeStrokePage.current = getClosestPage(world.x, world.y);
          } else {
            activeStrokePage.current = pageNum;
          }
          const pRect = getPageRect(activeStrokePage.current);
          isDrawing.current = true;
          (e.target as Element).setPointerCapture(e.pointerId);
          currentPoints.current = [[world.x - pRect.x, world.y - pRect.y, e.pressure || 0.5]];
          scheduleActiveDraw();
          return;
        } else {
          isDrawing.current = true;
          (e.target as Element).setPointerCapture(e.pointerId);
          currentPoints.current = [[world.x, world.y, e.pressure || 0.5]];
          scheduleActiveDraw();
          return;
        }
      }

      // Eraser tool
      if (toolRef.current === "eraser") {
        isDrawing.current = true;
        (e.target as Element).setPointerCapture(e.pointerId);
        eraseAt(e.clientX, e.clientY);
      }
    }

    function handlePointerMove(e: React.PointerEvent) {
      const rect = getRect();
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

      if (syncRef.current) {
        syncRef.current.sendCursor(world.x, world.y);
      }

      if (isPanning.current) {
        cam.current = {
          ...cam.current,
          x: e.clientX - panStart.current.x,
          y: e.clientY - panStart.current.y,
        };
        clampCamera();
        scheduleCameraRedraw();
        return;
      }

      if (isDragging.current) {
        const dx = world.x - dragLast.current.x;
        const dy = world.y - dragLast.current.y;
        dragLast.current = { x: world.x, y: world.y };
        moveSelectionBy(dx, dy);
        redrawMain();
        drawSelectionOverlay();
        return;
      }

      if (isResizing.current) {
        const id = Array.from(selection.current)[0];
        const img = images.current.find((i) => i.id === id);
        if (img) {
          const dx = world.x - resizeStart.current.x;
          const dy = world.y - resizeStart.current.y;
          const o = resizeOrig.current;

          switch (resizeCorner.current) {
            case "br": {
              img.width = Math.max(20, o.w + dx);
              img.height = Math.max(20, o.h + dy);
              break;
            }
            case "bl": {
              const nw = Math.max(20, o.w - dx);
              img.x = o.x + o.w - nw;
              img.width = nw;
              img.height = Math.max(20, o.h + dy);
              break;
            }
            case "tr": {
              const nh = Math.max(20, o.h - dy);
              img.y = o.y + o.h - nh;
              img.width = Math.max(20, o.w + dx);
              img.height = nh;
              break;
            }
            case "tl": {
              const nw = Math.max(20, o.w - dx);
              const nh = Math.max(20, o.h - dy);
              img.x = o.x + o.w - nw;
              img.y = o.y + o.h - nh;
              img.width = nw;
              img.height = nh;
              break;
            }
          }
          redrawMain();
          drawSelectionOverlay();
        }
        return;
      }

      if (isRubberBand.current) {
        rubberEnd.current = { x: world.x, y: world.y };
        drawRubberBand();
        return;
      }

      if (!isDrawing.current) return;

      if (toolRef.current === "pen") {
        const events =
          (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
        let added = false;
        if (modeRef.current === "notebook") {
          const pRect = getPageRect(activeStrokePage.current);
          for (const ev of events) {
            const w = screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
            const px = w.x - pRect.x;
            const py = w.y - pRect.y;
            const pr = ev.pressure || 0.5;
            const last = currentPoints.current[currentPoints.current.length - 1];
            if (last) {
              const dx = px - last[0];
              const dy = py - last[1];
              // Skip sub-pixel redundant events (< 1px distance)
              if (dx * dx + dy * dy < 1.0) continue;
            }
            currentPoints.current.push([px, py, pr]);
            added = true;
          }
        } else {
          for (const ev of events) {
            const w = screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
            const px = w.x;
            const py = w.y;
            const pr = ev.pressure || 0.5;
            const last = currentPoints.current[currentPoints.current.length - 1];
            if (last) {
              const dx = px - last[0];
              const dy = py - last[1];
              if (dx * dx + dy * dy < 1.0) continue;
            }
            currentPoints.current.push([px, py, pr]);
            added = true;
          }
        }
        if (added) scheduleActiveDraw();
        return;
      }

      if (toolRef.current === "eraser") {
        eraseAt(e.clientX, e.clientY);
      }
    }

    function handlePointerUp() {
      if (isPanning.current) {
        isPanning.current = false;
        if (drawRef.current) {
          drawRef.current.style.cursor =
            toolRef.current === "select" ? "default" : "crosshair";
        }
        return;
      }

      if (isRubberBand.current) {
        isRubberBand.current = false;
        const s = rubberStart.current;
        const e = rubberEnd.current;
        const rw = Math.abs(e.x - s.x);
        const rh = Math.abs(e.y - s.y);
        const minSize = 5 / cam.current.zoom;

        if (rw > minSize && rh > minSize) {
          const rx = Math.min(s.x, e.x);
          const ry = Math.min(s.y, e.y);
          const ids = elementsInRect(rx, ry, rw, rh);
          selection.current = new Set(ids);
          drawSelectionOverlay();
        } else {
          selection.current.clear();
          clearOverlay();
        }
        return;
      }

      if (isDragging.current) {
        isDragging.current = false;
        commitSelectionMove();
        return;
      }

      if (isResizing.current) {
        isResizing.current = false;
        resizeCorner.current = null;
        const id = Array.from(selection.current)[0];
        const img = images.current.find((i) => i.id === id);
        if (img) {
          const o = resizeOrig.current;
          undoStack.current.push({
            type: "resize_image",
            id: img.id,
            prev: { x: o.x, y: o.y, width: o.w, height: o.h },
            next: { x: img.x, y: img.y, width: img.width, height: img.height },
          });
          redoStack.current = [];
          if (syncRef.current) {
            syncRef.current.imagesMap.set(img.id, { ...img });
          }
          persistLocalData();
          scheduleThumbnailUpdate(img.page);
        }
        return;
      }

      if (!isDrawing.current) return;
      isDrawing.current = false;

      // Single click dot fix
      if (toolRef.current === "pen" && currentPoints.current.length >= 1) {
        if (currentPoints.current.length === 1) {
          const [px, py, pr] = currentPoints.current[0];
          currentPoints.current.push([px + 0.1, py + 0.1, pr || 0.5]);
        }

        const newStroke: StrokeData = {
          id: makeId(),
          points: [...currentPoints.current],
          color: colorRef.current,
          size: sizeRef.current,
          createdAt: Date.now(),
          page: modeRef.current === "notebook" ? activeStrokePage.current : undefined,
          _relative: true,
        } as any;

        strokes.current.push(newStroke);
        undoStack.current.push({ type: "add_stroke", stroke: newStroke });
        redoStack.current = [];

        if (syncRef.current) {
          syncRef.current.strokesMap.set(newStroke.id, newStroke);
        }

        redrawMain();
        persistLocalData();
        scheduleThumbnailUpdate(activeStrokePage.current);
      }

      currentPoints.current = [];
      clearOverlay();
    }

    function handlePointerCancel() {
      isDrawing.current = false;
      isPanning.current = false;
      isDragging.current = false;
      isResizing.current = false;
      isRubberBand.current = false;
      currentPoints.current = [];
      clearOverlay();
    }

    function clearOverlay() {
      const canvas = drawRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    // -------------------------
    //  Unified Undo / Redo
    // -------------------------

    function performUndo() {
      if (undoStack.current.length === 0) return;
      const action = undoStack.current.pop()!;
      redoStack.current.push(action);

      switch (action.type) {
        case "add_stroke": {
          strokes.current = strokes.current.filter((s) => s.id !== action.stroke.id);
          if (syncRef.current) syncRef.current.strokesMap.delete(action.stroke.id);
          break;
        }
        case "add_image": {
          images.current = images.current.filter((i) => i.id !== action.image.id);
          if (syncRef.current) syncRef.current.imagesMap.delete(action.image.id);
          break;
        }
        case "delete": {
          for (const s of action.strokes) {
            strokes.current.push(s);
            if (syncRef.current) syncRef.current.strokesMap.set(s.id, s);
          }
          for (const img of action.images) {
            images.current.push(img);
            if (syncRef.current) syncRef.current.imagesMap.set(img.id, img);
          }
          break;
        }
        case "move": {
          for (const item of action.items) {
            if (item.kind === "stroke") {
              const s = strokes.current.find((str) => str.id === item.id);
              if (s) {
                s.points = (item.prev as number[][]).map((p) => [...p]);
                if (syncRef.current) syncRef.current.strokesMap.set(s.id, { ...s });
              }
            } else {
              const im = images.current.find((img) => img.id === item.id);
              if (im) {
                const prev = item.prev as { x: number; y: number };
                im.x = prev.x;
                im.y = prev.y;
                if (syncRef.current) syncRef.current.imagesMap.set(im.id, { ...im });
              }
            }
          }
          break;
        }
        case "resize_image": {
          const im = images.current.find((img) => img.id === action.id);
          if (im) {
            im.x = action.prev.x;
            im.y = action.prev.y;
            im.width = action.prev.width;
            im.height = action.prev.height;
            if (syncRef.current) syncRef.current.imagesMap.set(im.id, { ...im });
          }
          break;
        }
        case "clear": {
          strokes.current = [...action.strokes];
          images.current = [...action.images];
          if (syncRef.current) {
            for (const s of action.strokes) syncRef.current.strokesMap.set(s.id, s);
            for (const i of action.images) syncRef.current.imagesMap.delete(i.id);
          }
          break;
        }
      }

      selection.current.clear();
      clearOverlay();
      strokePathCache.current.clear();
      strokeBBoxCache.current.clear();
      redrawMain();
      persistLocalData();
      scheduleThumbnailUpdate();
    }

    function performRedo() {
      if (redoStack.current.length === 0) return;
      const action = redoStack.current.pop()!;
      undoStack.current.push(action);

      switch (action.type) {
        case "add_stroke": {
          strokes.current.push(action.stroke);
          if (syncRef.current) syncRef.current.strokesMap.set(action.stroke.id, action.stroke);
          break;
        }
        case "add_image": {
          images.current.push(action.image);
          if (syncRef.current) syncRef.current.imagesMap.set(action.image.id, action.image);
          break;
        }
        case "delete": {
          const strokeIds = new Set(action.strokes.map((s) => s.id));
          const imageIds = new Set(action.images.map((i) => i.id));
          strokes.current = strokes.current.filter((s) => !strokeIds.has(s.id));
          images.current = images.current.filter((i) => !imageIds.has(i.id));
          if (syncRef.current) {
            for (const id of strokeIds) syncRef.current.strokesMap.delete(id);
            for (const id of imageIds) syncRef.current.imagesMap.delete(id);
          }
          break;
        }
        case "move": {
          for (const item of action.items) {
            if (item.kind === "stroke") {
              const s = strokes.current.find((str) => str.id === item.id);
              if (s) {
                s.points = (item.next as number[][]).map((p) => [...p]);
                if (syncRef.current) syncRef.current.strokesMap.set(s.id, { ...s });
              }
            } else {
              const im = images.current.find((img) => img.id === item.id);
              if (im) {
                const next = item.next as { x: number; y: number };
                im.x = next.x;
                im.y = next.y;
                if (syncRef.current) syncRef.current.imagesMap.set(im.id, { ...im });
              }
            }
          }
          break;
        }
        case "resize_image": {
          const im = images.current.find((img) => img.id === action.id);
          if (im) {
            im.x = action.next.x;
            im.y = action.next.y;
            im.width = action.next.width;
            im.height = action.next.height;
            if (syncRef.current) syncRef.current.imagesMap.set(im.id, { ...im });
          }
          break;
        }
        case "clear": {
          strokes.current = [];
          images.current = [];
          if (syncRef.current) {
            for (const s of action.strokes) syncRef.current.strokesMap.delete(s.id);
            for (const i of action.images) syncRef.current.imagesMap.delete(i.id);
          }
          break;
        }
      }

      selection.current.clear();
      clearOverlay();
      strokePathCache.current.clear();
      strokeBBoxCache.current.clear();
      redrawMain();
      persistLocalData();
      scheduleThumbnailUpdate();
    }

    // -------------------------
    //  Imperative Handle
    // -------------------------

    useImperativeHandle(ref, () => ({
      undo() {
        performUndo();
      },
      redo() {
        performRedo();
      },
      clear() {
        if (strokes.current.length === 0 && images.current.length === 0) return;
        undoStack.current.push({
          type: "clear",
          strokes: [...strokes.current],
          images: [...images.current],
        });
        redoStack.current = [];

        if (syncRef.current) {
          for (const s of strokes.current) syncRef.current.strokesMap.delete(s.id);
          for (const i of images.current) syncRef.current.imagesMap.delete(i.id);
        }

        strokes.current = [];
        images.current = [];
        selection.current.clear();
        clearOverlay();
        cachedThumbnails.current = {};
        strokePathCache.current.clear();
        strokeBBoxCache.current.clear();
        redrawMain();
        persistLocalData();
        scheduleThumbnailUpdate();
      },
      insertImage(file: File) {
        handleInsertImageFile(file);
      },
      focusPage(pageIndex: number) {
        const pRect = getPageRect(pageIndex);
        const rect = getRect();
        cam.current = {
          x: rect.width / 2 - (pRect.x + pRect.w / 2) * cam.current.zoom,
          y: rect.height / 2 - (pRect.y + pRect.h / 2) * cam.current.zoom,
          zoom: cam.current.zoom,
        };
        clampCamera();
        redrawAll();
      },
      exportPng(): string | null {
        const bgCanvas = bgRef.current;
        const mainCanvas = mainRef.current;
        if (!bgCanvas || !mainCanvas) return null;

        const offscreen = document.createElement("canvas");
        offscreen.width = bgCanvas.width;
        offscreen.height = bgCanvas.height;
        const oCtx = offscreen.getContext("2d");
        if (!oCtx) return null;

        oCtx.drawImage(bgCanvas, 0, 0);
        oCtx.drawImage(mainCanvas, 0, 0);
        return offscreen.toDataURL("image/png");
      },
      getStrokes() {
        return [...strokes.current];
      },
      getImages() {
        return [...images.current];
      },
      setElements(newStrokes: StrokeData[], newImages: ImageElement[]) {
        strokes.current = newStrokes;
        images.current = newImages;
        cachedThumbnails.current = {};
        strokePathCache.current.clear();
        strokeBBoxCache.current.clear();
        redrawMain();
        persistLocalData();
        scheduleThumbnailUpdate();
      },
    }));

    // -------------------------
    //  Resize & Window Listeners (HiDPI ResizeObserver)
    // -------------------------

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      function resize() {
        const ctn = containerRef.current;
        if (!ctn) return;
        const rect = ctn.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = getDpr();
        const targetW = Math.round(rect.width * dpr);
        const targetH = Math.round(rect.height * dpr);

        for (const c of [bgRef.current, mainRef.current, drawRef.current, cursorsRef.current]) {
          if (!c) continue;
          if (c.width !== targetW || c.height !== targetH) {
            c.width = targetW;
            c.height = targetH;
          }
          c.style.width = rect.width + "px";
          c.style.height = rect.height + "px";
        }
        redrawAll();
      }

      resize();

      const ro = new ResizeObserver(() => {
        resize();
      });
      ro.observe(container);

      window.addEventListener("resize", resize);
      let mq: MediaQueryList | null = null;
      try {
        mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        mq.addEventListener("change", resize);
      } catch (e) {}

      return () => {
        ro.disconnect();
        window.removeEventListener("resize", resize);
        try {
          if (mq) mq.removeEventListener("change", resize);
        } catch (e) {}
      };
    }, []);

    // -------------------------
    //  Keyboard Shortcuts & Native Paste (Desktop Fix)
    // -------------------------

    useEffect(() => {
      // Native window paste event handler (vital for Tauri on Linux / WebKitGTK!)
      function onPaste(e: ClipboardEvent) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) handleInsertImageFile(file);
            return;
          }
        }
      }

      function onKeyDown(e: KeyboardEvent) {
        if (e.code === "Space" && !e.repeat) {
          e.preventDefault();
          spaceDown.current = true;
          if (drawRef.current) drawRef.current.style.cursor = "grab";
        }

        // Ctrl+Z / Ctrl+Shift+Z
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            performRedo();
          } else {
            performUndo();
          }
        }

        // Bracket keys [ and ] for brush size (Photoshop style)
        if (e.key === "[") {
          e.preventDefault();
          const newSize = Math.max(1, sizeRef.current - 2);
          onBrushSizeChangeRef.current?.(newSize);
        } else if (e.key === "]") {
          e.preventDefault();
          const newSize = Math.min(64, sizeRef.current + 2);
          onBrushSizeChangeRef.current?.(newSize);
        }

        // Native & Web Clipboard paste (Ctrl+V / Cmd+V)
        if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "v" || e.code === "KeyV")) {
          const target = e.target as HTMLElement;
          if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
            return;
          }
          e.preventDefault();

          // 1. Try native desktop clipboard first (wl-paste / xclip via Tauri)
          getNativeClipboardImage()
            .then((dataUrl) => {
              if (dataUrl) {
                loadAndInsertImage(dataUrl);
                return;
              }
              // 2. Fallback to standard web clipboard
              if (navigator.clipboard?.read) {
                navigator.clipboard
                  .read()
                  .then((items) => {
                    for (const item of items) {
                      const imgType = item.types.find((t) => t.startsWith("image/"));
                      if (imgType) {
                        item.getType(imgType).then((blob) => {
                          const file = new File([blob], "pasted.png", { type: imgType });
                          handleInsertImageFile(file);
                        });
                        return;
                      }
                    }
                  })
                  .catch(() => {});
              }
            })
            .catch(() => {});
        }

        // Delete selection
        if (
          (e.key === "Delete" || e.key === "Backspace") &&
          selection.current.size > 0
        ) {
          const delStrokes = strokes.current.filter((s) => selection.current.has(s.id));
          const delImages = images.current.filter((i) => selection.current.has(i.id));

          undoStack.current.push({
            type: "delete",
            strokes: delStrokes,
            images: delImages,
          });
          redoStack.current = [];

          if (syncRef.current) {
            for (const s of delStrokes) syncRef.current.strokesMap.delete(s.id);
            for (const i of delImages) syncRef.current.imagesMap.delete(i.id);
          }

          strokes.current = strokes.current.filter((s) => !selection.current.has(s.id));
          images.current = images.current.filter((i) => !selection.current.has(i.id));
          selection.current.clear();
          clearOverlay();
          redrawMain();
          persistLocalData();
        }

        // Tools shortcuts
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const target = e.target as HTMLElement;
          if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
          if (e.key === "p") onToolChangeRef.current?.("pen");
          if (e.key === "v") onToolChangeRef.current?.("select");
          if (e.key === "e") onToolChangeRef.current?.("eraser");
        }
      }

      function onKeyUp(e: KeyboardEvent) {
        if (e.code === "Space") {
          spaceDown.current = false;
          if (drawRef.current) {
            drawRef.current.style.cursor =
              toolRef.current === "select" ? "default" : "crosshair";
          }
        }
      }

      document.addEventListener("paste", onPaste, true);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      return () => {
        document.removeEventListener("paste", onPaste, true);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      };
    }, []);

    // -------------------------
    //  Photoshop-Style Modifier Keys Navigation Wheel Handler
    // -------------------------

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      function onWheel(e: WheelEvent) {
        e.preventDefault();

        // 1. Alt + Shift + Wheel OR Ctrl + Alt + Wheel: Brush Size
        if ((e.altKey && e.shiftKey) || (e.ctrlKey && e.altKey)) {
          const delta = Math.sign(e.deltaY);
          const newSize = Math.max(1, Math.min(64, sizeRef.current - delta * 2));
          onBrushSizeChangeRef.current?.(newSize);
          return;
        }

        // 2. Ctrl + Wheel OR Alt + Wheel: Focal Zoom
        if (e.ctrlKey || e.metaKey || e.altKey) {
          const rect = el!.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const factor = e.deltaY < 0 ? 1.1 : 0.9;
          const c = cam.current;
          const newZoom = Math.max(0.1, Math.min(c.zoom * factor, 10));

          cam.current = {
            x: mouseX - (mouseX - c.x) * (newZoom / c.zoom),
            y: mouseY - (mouseY - c.y) * (newZoom / c.zoom),
            zoom: newZoom,
          };
          clampCamera();
          scheduleCameraRedraw();
          return;
        }

        // 3. Shift + Wheel: Horizontal Pan (Photoshop style)
        if (e.shiftKey) {
          const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
          cam.current.x -= delta;
          clampCamera();
          scheduleCameraRedraw();
          return;
        }

        // 4. Normal Wheel: Vertical Pan (Page scrolling in Notebook & canvas)
        cam.current.y -= e.deltaY;
        if (e.deltaX !== 0) {
          cam.current.x -= e.deltaX;
        }
        clampCamera();
        scheduleCameraRedraw();
      }

      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, []);

    // -------------------------
    //  Drag and Drop Images & Files
    // -------------------------

    function handleDragOver(e: React.DragEvent) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }

    function handleDrop(e: React.DragEvent) {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        handleInsertImageFile(file);
      }
    }

    return (
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden select-none"
        style={{ contain: "strict" }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <canvas
          ref={bgRef}
          className="absolute inset-0 pointer-events-none"
        />
        <canvas
          ref={mainRef}
          className="absolute inset-0 pointer-events-none"
        />
        <canvas
          ref={cursorsRef}
          className="absolute inset-0 pointer-events-none"
        />
        <canvas
          ref={drawRef}
          className="absolute inset-0"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />
      </div>
    );
  },
);

Canvas.displayName = "Canvas";
export default Canvas;
