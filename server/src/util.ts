import crypto from "crypto";
import type { Context } from "hono";

// simple JWT-like token using HMAC
const secret = process.env.JWT_SECRET || "dev-secret-change-me";

interface TokenPayload {
  sub: string;
  email: string;
  exp?: number;
}

export async function sign(payload: Omit<TokenPayload, "exp">): Promise<string> {
  const data = { ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }; // 7 days
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export async function verify(token: string): Promise<TokenPayload | null> {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as TokenPayload;
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// password hashing with scrypt (no extra dependency)
export async function hash(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      resolve(`${salt}:${key.toString("hex")}`);
    });
  });
}

export async function compareHash(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(":");
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      resolve(key.toString("hex") === hash);
    });
  });
}

export function generateId(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function generateShareCode(): string {
  // readable 9-char code like "abc-def-ghi"
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // no confusing chars
  let code = "";
  const bytes = crypto.randomBytes(9);
  for (let i = 0; i < 9; i++) {
    if (i === 3 || i === 6) code += "-";
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function getUserFromHeader(c: Context): Promise<TokenPayload | null> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return verify(header.slice(7));
}
