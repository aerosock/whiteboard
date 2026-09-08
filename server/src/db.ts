import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DATABASE_URL || "./data/whiteboard.db";
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // set up tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT NOT NULL DEFAULT '',
      google_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      owner_id TEXT NOT NULL REFERENCES users(id),
      share_code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS board_members (
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'editor',
      PRIMARY KEY (board_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS board_data (
      board_id TEXT PRIMARY KEY,
      data BLOB NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id);
    CREATE INDEX IF NOT EXISTS idx_boards_share ON boards(share_code);
    CREATE INDEX IF NOT EXISTS idx_members_user ON board_members(user_id);
  `);

  return db;
}

export function getBoardData(boardId: string): Buffer | null {
  const database = getDb();
  const row = database.prepare("SELECT data FROM board_data WHERE board_id = ?").get(boardId) as
    | { data: Buffer }
    | undefined;
  return row ? row.data : null;
}

export function saveBoardData(boardId: string, data: Buffer): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO board_data (board_id, data, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(board_id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
    )
    .run(boardId, data);
}
