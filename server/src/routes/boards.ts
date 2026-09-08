import { Hono } from "hono";
import { getDb } from "../db.js";
import { generateId, generateShareCode, getUserFromHeader } from "../util.js";

const boards = new Hono();

// list boards for the authenticated user
boards.get("/", async (c) => {
  const user = await getUserFromHeader(c);
  if (!user) return c.json({ error: "Not authenticated" }, 401);

  const db = getDb();
  const owned = db
    .prepare(
      `SELECT id, title, share_code, created_at, updated_at
       FROM boards WHERE owner_id = ? ORDER BY updated_at DESC`,
    )
    .all(user.sub);

  const shared = db
    .prepare(
      `SELECT b.id, b.title, b.share_code, b.created_at, b.updated_at, bm.role
       FROM boards b JOIN board_members bm ON b.id = bm.board_id
       WHERE bm.user_id = ? ORDER BY b.updated_at DESC`,
    )
    .all(user.sub);

  return c.json({ owned, shared });
});

// create a new board
boards.post("/", async (c) => {
  const user = await getUserFromHeader(c);
  if (!user) return c.json({ error: "Not authenticated" }, 401);

  const { title } = await c.req.json().catch(() => ({ title: "Untitled" }));
  const id = generateId();
  const shareCode = generateShareCode();

  const db = getDb();
  db.prepare(
    "INSERT INTO boards (id, title, owner_id, share_code) VALUES (?, ?, ?, ?)",
  ).run(id, title || "Untitled", user.sub, shareCode);

  return c.json({ id, title: title || "Untitled", share_code: shareCode }, 201);
});

// get a single board (by id or share code)
boards.get("/:idOrCode", async (c) => {
  const param = c.req.param("idOrCode");
  const db = getDb();

  const board = db
    .prepare("SELECT * FROM boards WHERE id = ? OR share_code = ?")
    .get(param, param) as Record<string, string> | undefined;

  if (!board) return c.json({ error: "Board not found" }, 404);
  return c.json({ board });
});

// update board title
boards.patch("/:id", async (c) => {
  const user = await getUserFromHeader(c);
  if (!user) return c.json({ error: "Not authenticated" }, 401);

  const id = c.req.param("id");
  const { title } = await c.req.json();

  const db = getDb();
  const board = db.prepare("SELECT owner_id FROM boards WHERE id = ?").get(id) as
    | { owner_id: string }
    | undefined;

  if (!board) return c.json({ error: "Board not found" }, 404);
  if (board.owner_id !== user.sub) return c.json({ error: "Forbidden" }, 403);

  db.prepare("UPDATE boards SET title = ?, updated_at = datetime('now') WHERE id = ?").run(
    title,
    id,
  );
  return c.json({ ok: true });
});

// delete a board
boards.delete("/:id", async (c) => {
  const user = await getUserFromHeader(c);
  if (!user) return c.json({ error: "Not authenticated" }, 401);

  const id = c.req.param("id");
  const db = getDb();
  const board = db.prepare("SELECT owner_id FROM boards WHERE id = ?").get(id) as
    | { owner_id: string }
    | undefined;

  if (!board) return c.json({ error: "Board not found" }, 404);
  if (board.owner_id !== user.sub) return c.json({ error: "Forbidden" }, 403);

  db.prepare("DELETE FROM boards WHERE id = ?").run(id);
  return c.json({ ok: true });
});

// regenerate share code (revoke old links)
boards.post("/:id/regenerate-code", async (c) => {
  const user = await getUserFromHeader(c);
  if (!user) return c.json({ error: "Not authenticated" }, 401);

  const id = c.req.param("id");
  const db = getDb();
  const board = db.prepare("SELECT owner_id FROM boards WHERE id = ?").get(id) as
    | { owner_id: string }
    | undefined;

  if (!board) return c.json({ error: "Board not found" }, 404);
  if (board.owner_id !== user.sub) return c.json({ error: "Forbidden" }, 403);

  const newCode = generateShareCode();
  db.prepare("UPDATE boards SET share_code = ? WHERE id = ?").run(newCode, id);
  return c.json({ share_code: newCode });
});

export default boards;
