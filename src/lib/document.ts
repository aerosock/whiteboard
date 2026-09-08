import * as pdfjsLib from "pdfjs-dist";
import { LocalBoard } from "./storage";
import { StrokeData, ImageElement } from "../components/Canvas";

// Configure PDF.js worker with standard worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface BoardExportPackage {
  format: "whiteboard_wnb";
  version: 1;
  board: LocalBoard;
  strokes: StrokeData[];
  images: ImageElement[];
  pageBackgrounds?: Record<number, string>; // pageIndex -> dataUrl (from PDF or imported document)
}

// -------------------------
//  Portable File Export / Import (.wnb)
// -------------------------

export function exportBoardPackage(
  board: LocalBoard,
  strokes: StrokeData[],
  images: ImageElement[],
  pageBackgrounds: Record<number, string> = {},
): void {
  const pkg: BoardExportPackage = {
    format: "whiteboard_wnb",
    version: 1,
    board,
    strokes,
    images,
    pageBackgrounds,
  };

  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `${board.title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.wnb`;
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBoardPackage(
  file: File,
): Promise<{
  board: LocalBoard;
  strokes: StrokeData[];
  images: ImageElement[];
  pageBackgrounds: Record<number, string>;
}> {
  const text = await file.text();
  const data = JSON.parse(text) as BoardExportPackage;

  if (data.format !== "whiteboard_wnb" && !data.board) {
    throw new Error("Invalid whiteboard file format");
  }

  // Generate a new fresh ID so importing doesn't accidentally overwrite an existing board with same ID
  const newId = "b_" + Math.random().toString(36).slice(2, 10);
  const board: LocalBoard = {
    ...data.board,
    id: newId,
    title: data.board.title || file.name.replace(/\.[^/.]+$/, ""),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    synced: false,
  };

  return {
    board,
    strokes: data.strokes || [],
    images: data.images || [],
    pageBackgrounds: data.pageBackgrounds || {},
  };
}

// -------------------------
//  PDF Document Import to Notebook
// -------------------------

export async function loadPdfPagesAsImages(
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<{ pageImages: string[]; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pageImages: string[] = [];

  // Render each PDF page to image
  for (let i = 1; i <= numPages; i++) {
    onProgress?.(i, numPages);
    const page = await pdf.getPage(i);

    // Render at 2x scale for high DPI sharpness on screen
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    await (page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }) as any).promise;

    const dataUrl = canvas.toDataURL("image/png");
    pageImages.push(dataUrl);
  }

  return {
    pageImages,
    pageCount: numPages,
  };
}
