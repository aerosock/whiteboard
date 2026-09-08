# Whiteboard

A local-first desktop whiteboard and notebook app built with Tauri, React, and TypeScript.

Supports both an infinite canvas and a multi-page notebook view with page-anchored vector drawing, PDF importing, and optional real-time collaboration.

## Features

- **Canvas Modes**:
  - **Notebook**: Fixed-dimension paged sheets (A4 aspect) with single, double-spread, or grid layouts. Page-anchored ruled lines, grid, dot, or blank paper styles.
  - **Infinite Canvas**: Unbounded workspace with smooth panning and zooming.
- **Drawing Tools**:
  - Pressure-sensitive inking using `perfect-freehand`.
  - Pen, eraser, and selection tool (select and move both strokes and images).
  - Custom color palette and brush sizing.
  - Image insertion, movement, and corner resizing.
- **Document & Page Management**:
  - Drag-and-drop page reordering in the sidebar.
  - Insert pages before/after, duplicate, and clear pages.
  - PDF background import (renders PDF pages as fixed sheet backgrounds).
  - Export to PNG.
- **Interface & Theming**:
  - 4 themes: Light, Warm (sepia parchment), Charcoal, and Deep Dark, plus OS system auto-detection.
  - Interface scale adjustments (80% to 125%).
- **Storage & Collaboration**:
  - Fully local-first: all boards, strokes, camera states, and settings persist locally in the client.
  - Optional real-time sync server via WebSocket + SQLite for room-based collaborative drawing.

## Tech Stack

- **Desktop Framework**: [Tauri v2](https://v2.tauri.app/) (Rust)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide icons
- **Rendering**: HTML5 Canvas (multi-layer: background paper, main vector content, interactive overlay)
- **Sync Server**: Node.js, Express, `ws`, SQLite (`better-sqlite3`)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- Tauri system dependencies for your platform (see [Tauri setup guide](https://v2.tauri.app/start/prerequisites/))

### Running the Desktop App

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

To build a release binary:

```bash
npm run tauri build
```

### Running the Sync Server (Optional)

The desktop app works completely standalone without the server. If you want real-time multi-device sync:

Using Docker:

```bash
docker compose up -d
```

Or locally with Node:

```bash
cd server
npm install
npm run dev
```

The server runs on port 3001 by default (`http://localhost:3001` and `ws://localhost:3001`).
