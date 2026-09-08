import { Hono } from "hono";
import { getDb } from "../db.js";
import { sign, verify, hash, compareHash, generateId } from "../util.js";

const auth = new Hono();

// sign up with email + password
auth.post("/signup", async (c) => {
  const { email, password, name } = await c.req.json();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return c.json({ error: "Please enter a valid email address (e.g. name@example.com)" }, 400);
  }
  if (!password || password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const id = generateId();
  const passwordHash = await hash(password);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
  ).run(id, email, passwordHash, name || email.split("@")[0]);

  const token = await sign({ sub: id, email });
  return c.json({ token, user: { id, email, name: name || email.split("@")[0] } });
});

// log in with email + password
auth.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?")
    .get(email) as { id: string; email: string; name: string; password_hash: string } | undefined;

  if (!user || !user.password_hash) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await compareHash(password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await sign({ sub: user.id, email: user.email });
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// get current user from token
auth.get("/me", async (c) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const payload = await verify(header.slice(7));
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const db = getDb();
  const user = db
    .prepare("SELECT id, email, name FROM users WHERE id = ?")
    .get(payload.sub) as { id: string; email: string; name: string } | undefined;

  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json({ user });
});

export default auth;
