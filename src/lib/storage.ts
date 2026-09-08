// Local storage and desktop environment helper

export type BoardMode = "infinite" | "notebook";
export type PaperStyle = "blank" | "lined" | "grid" | "dots";
export type PageLayout = "single" | "double" | "horizontal" | "grid-3" | "grid-4" | "grid-6";

export interface LocalBoard {
  id: string;
  title: string;
  mode: BoardMode;
  paperStyle: PaperStyle;
  pageCount: number;
  pageLayout?: PageLayout;
  pageBackgrounds?: Record<number, string>; // pageIndex -> dataUrl (from PDF or imported document)
  clampToPages?: boolean;
  thumbnail?: string;
  shareCode?: string;
  synced: boolean;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "wb_local_boards";

// Detect if running inside Tauri desktop app
export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    window.location.protocol === "tauri:"
  );
}

export function getLocalBoards(): LocalBoard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalBoard(board: LocalBoard): void {
  try {
    const boards = getLocalBoards();
    const index = boards.findIndex((b) => b.id === board.id);
    board.updatedAt = Date.now();
    if (index >= 0) {
      boards[index] = board;
    } else {
      boards.unshift(board);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  } catch (err) {
    console.error("Failed to save local board:", err);
  }
}

export function deleteLocalBoard(id: string): void {
  try {
    const boards = getLocalBoards().filter((b) => b.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  } catch (err) {
    console.error("Failed to delete local board:", err);
  }
}

export function getLocalBoard(id: string): LocalBoard | null {
  const boards = getLocalBoards();
  return boards.find((b) => b.id === id) || null;
}
