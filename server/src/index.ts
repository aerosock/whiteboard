import { Hono } from "hono";
import { cors } from "hono/cors";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import { getDb } from "./db.js";
import { setupWebSocket } from "./ws.js";
import authRoutes from "./routes/auth.js";
import boardRoutes from "./routes/boards.js";
import imageRoutes from "./routes/images.js";

dotenv.config();

const app = new Hono();
const port = parseInt(process.env.PORT || "3001");

app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:1420", "http://localhost:5173", "http://localhost:3001"],
    credentials: true,
  }),
);

app.route("/api/auth", authRoutes);
app.route("/api/boards", boardRoutes);
app.route("/api/images", imageRoutes);

app.get("/api/health", (c) => c.json({ ok: true, time: new Date().toISOString() }));

// serve the built frontend in production
const distPath = path.resolve(import.meta.dirname, "../../dist");
if (fs.existsSync(distPath)) {
  app.get("/*", (c) => {
    const reqPath = c.req.path === "/" ? "/index.html" : c.req.path;
    const filePath = path.join(distPath, reqPath);

    if (!filePath.startsWith(distPath)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const target = fs.existsSync(filePath) ? filePath : path.join(distPath, "index.html");
    const data = fs.readFileSync(target);
    const ext = path.extname(target).toLowerCase();

    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".woff2": "font/woff2",
    };

    return new Response(data, {
      headers: { "Content-Type": types[ext] || "application/octet-stream" },
    });
  });
}

getDb();

// create http server, pipe requests through hono
const server = createServer(async (req, res) => {
  const url = `http://localhost:${port}${req.url || "/"}`;

  // collect the body for non-GET requests
  let body: Buffer | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    body = Buffer.concat(chunks);
  }

  const headers: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (val) headers[key] = Array.isArray(val) ? val.join(", ") : val;
  }

  const request = new Request(url, {
    method: req.method || "GET",
    headers,
    body: body ? new Uint8Array(body) : null,
  });

  try {
    const response = await app.fetch(request);
    const resHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => { resHeaders[key] = val; });
    res.writeHead(response.status, resHeaders);

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(value);
        return pump();
      };
      await pump();
    } else {
      res.end();
    }
  } catch (err: unknown) {
    console.error("Request error:", err);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

setupWebSocket(server);

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
