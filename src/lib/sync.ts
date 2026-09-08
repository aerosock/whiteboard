import * as Y from "yjs";

export interface RemoteCursor {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  lastActive: number;
}

export interface BoardSync {
  doc: Y.Doc;
  strokesMap: Y.Map<any>;
  imagesMap: Y.Map<any>;
  sendCursor: (x: number, y: number) => void;
  destroy: () => void;
}

const WS_BASE =
  import.meta.env.VITE_WS_URL ||
  (typeof window !== "undefined" && window.location.port === "3001"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`
    : "ws://localhost:3001");

// random color for collaborator cursor
const USER_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];
const myColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
const myId = Math.random().toString(36).slice(2, 9);

export function setupBoardSync(
  roomId: string,
  userName: string,
  onRemoteChange: () => void,
  onCursorsChange: (cursors: RemoteCursor[]) => void,
): BoardSync {
  const doc = new Y.Doc();
  const strokesMap = doc.getMap("strokes");
  const imagesMap = doc.getMap("images");

  let ws: WebSocket | null = null;
  let isDestroyed = false;
  let reconnectTimer: any = null;
  const remoteCursors = new Map<string, RemoteCursor>();
  let lastCursorSent = 0;

  // periodically clean up inactive cursors (after 5 seconds)
  const cursorCleanupInterval = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [id, cursor] of remoteCursors.entries()) {
      if (now - cursor.lastActive > 5000) {
        remoteCursors.delete(id);
        changed = true;
      }
    }
    if (changed) {
      onCursorsChange(Array.from(remoteCursors.values()));
    }
  }, 2000);

  function connect() {
    if (isDestroyed) return;

    try {
      ws = new WebSocket(`${WS_BASE}/ws/${roomId}`);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log(`[collab] connected to room "${roomId}"`);
      };

      ws.onmessage = (event) => {
        try {
          const buffer = new Uint8Array(event.data as ArrayBuffer);
          if (buffer.length === 0) return;

          const type = buffer[0];

          // 0 = Yjs CRDT binary update
          if (type === 0) {
            const update = buffer.slice(1);
            Y.applyUpdate(doc, update, "remote");
            onRemoteChange();
          }

          // 1 = cursor awareness update (JSON payload)
          if (type === 1) {
            const text = new TextDecoder().decode(buffer.slice(1));
            const data = JSON.parse(text);
            if (data.id && data.id !== myId) {
              remoteCursors.set(data.id, {
                id: data.id,
                name: data.name || "Collaborator",
                color: data.color || "#3b82f6",
                x: data.x,
                y: data.y,
                lastActive: Date.now(),
              });
              onCursorsChange(Array.from(remoteCursors.values()));
            }
          }
        } catch (err) {
          console.error("[collab] message parsing error:", err);
        }
      };

      ws.onclose = () => {
        if (isDestroyed) return;
        console.log(`[collab] disconnected, reconnecting in 2s...`);
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch (err) {
      console.error("[collab] ws connection error:", err);
      reconnectTimer = setTimeout(connect, 3000);
    }
  }

  // send local document updates to server
  const onDocUpdate = (update: Uint8Array, origin: any) => {
    if (origin !== "remote" && ws && ws.readyState === WebSocket.OPEN) {
      const msg = new Uint8Array(1 + update.length);
      msg[0] = 0; // sync update
      msg.set(update, 1);
      ws.send(msg);
    }
  };

  doc.on("update", onDocUpdate);
  connect();

  function sendCursor(x: number, y: number) {
    const now = Date.now();
    // throttle cursor updates to ~30fps (33ms)
    if (now - lastCursorSent < 33 || !ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    lastCursorSent = now;

    try {
      const payload = JSON.stringify({
        id: myId,
        name: userName,
        color: myColor,
        x: Math.round(x),
        y: Math.round(y),
      });
      const encoded = new TextEncoder().encode(payload);
      const msg = new Uint8Array(1 + encoded.length);
      msg[0] = 1; // awareness type
      msg.set(encoded, 1);
      ws.send(msg);
    } catch {
      // ignore cursor transmission errors
    }
  }

  function destroy() {
    isDestroyed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    clearInterval(cursorCleanupInterval);
    doc.off("update", onDocUpdate);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    doc.destroy();
  }

  return {
    doc,
    strokesMap,
    imagesMap,
    sendCursor,
    destroy,
  };
}
