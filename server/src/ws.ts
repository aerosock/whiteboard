import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import type { IncomingMessage, Server as HttpServer } from "http";
import { getDb, getBoardData, saveBoardData } from "./db.js";

// in-memory store for yjs documents (rooms)
interface Room {
  doc: Y.Doc;
  clients: Set<WebSocket>;
  saveTimeout: NodeJS.Timeout | null;
}

const rooms = new Map<string, Room>();

// resolve share_code or board_id to canonical board id
function resolveRoomId(rawId: string): string {
  try {
    const db = getDb();
    const board = db
      .prepare("SELECT id FROM boards WHERE id = ? OR share_code = ?")
      .get(rawId, rawId) as { id: string } | undefined;
    if (board) return board.id;
  } catch (err) {
    console.error("[ws] error resolving room id:", err);
  }
  return rawId;
}

function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    const doc = new Y.Doc();

    // try to load saved state from SQLite
    try {
      const savedData = getBoardData(roomId);
      if (savedData && savedData.length > 0) {
        Y.applyUpdate(doc, new Uint8Array(savedData));
        console.log(`[ws] loaded saved state for board ${roomId} (${savedData.length} bytes)`);
      }
    } catch (err) {
      console.error(`[ws] failed to load saved data for room ${roomId}:`, err);
    }

    const newRoom: Room = {
      doc,
      clients: new Set(),
      saveTimeout: null,
    };

    // debounced persistence on changes
    doc.on("update", () => {
      if (newRoom.saveTimeout) clearTimeout(newRoom.saveTimeout);
      newRoom.saveTimeout = setTimeout(() => {
        try {
          const snapshot = Buffer.from(Y.encodeStateAsUpdate(doc));
          saveBoardData(roomId, snapshot);
          console.log(`[ws] auto-saved board ${roomId} (${snapshot.length} bytes)`);
        } catch (err) {
          console.error(`[ws] auto-save error for room ${roomId}:`, err);
        }
      }, 1000);
    });

    rooms.set(roomId, newRoom);
    return newRoom;
  }
  return room;
}

export function setupWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "/", "http://localhost");
    const rawName = url.pathname.replace(/^\/ws\/?/, "").trim() || "default";
    const roomName = resolveRoomId(rawName);

    const room = getOrCreateRoom(roomName);
    room.clients.add(ws);

    console.log(`[ws] client joined room "${roomName}" (${room.clients.size} connected)`);

    // 1. send full document state to the newly connected client
    const stateUpdate = Y.encodeStateAsUpdate(room.doc);
    ws.send(encodeSyncUpdate(stateUpdate));

    ws.on("message", (data: Buffer) => {
      try {
        const msg = new Uint8Array(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
        if (msg.length === 0) return;

        const msgType = msg[0];

        // type 0 = Yjs CRDT sync update
        if (msgType === 0) {
          const update = msg.slice(1);
          Y.applyUpdate(room.doc, update);

          // broadcast to all OTHER clients in this room
          for (const client of room.clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(data);
            }
          }
        }

        // type 1 = awareness update (remote cursors, user presence, etc.)
        if (msgType === 1) {
          for (const client of room.clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(data);
            }
          }
        }
      } catch (err) {
        console.error("[ws] error processing message:", err);
      }
    });

    ws.on("close", () => {
      room.clients.delete(ws);
      console.log(`[ws] client left room "${roomName}" (${room.clients.size} remaining)`);

      // flush immediate save if everyone leaves
      if (room.clients.size === 0) {
        if (room.saveTimeout) {
          clearTimeout(room.saveTimeout);
          room.saveTimeout = null;
        }
        try {
          const snapshot = Buffer.from(Y.encodeStateAsUpdate(room.doc));
          saveBoardData(roomName, snapshot);
          console.log(`[ws] flushed final board state for ${roomName}`);
        } catch (err) {
          console.error(`[ws] error flushing room ${roomName}:`, err);
        }

        // keep in memory for a short while before evicting
        setTimeout(() => {
          const r = rooms.get(roomName);
          if (r && r.clients.size === 0) {
            rooms.delete(roomName);
            console.log(`[ws] room "${roomName}" unloaded from memory`);
          }
        }, 30000);
      }
    });

    ws.on("error", (err) => {
      console.error("[ws] connection error:", err.message);
      room.clients.delete(ws);
    });
  });

  console.log("WebSocket server ready for real-time collaboration with persistence");
  return wss;
}

function encodeSyncUpdate(update: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + update.length);
  msg[0] = 0; // type 0 = sync
  msg.set(update, 1);
  return msg;
}
