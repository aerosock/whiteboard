import { Hono } from "hono";
import fs from "fs";
import path from "path";
import { generateId } from "../util.js";

const images = new Hono();

const uploadDir = process.env.UPLOAD_DIR || "./data/uploads";

// make sure upload dir exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// upload an image
images.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || typeof file === "string") {
    return c.json({ error: "No file provided" }, 400);
  }

  // check it's an image
  if (!file.type.startsWith("image/")) {
    return c.json({ error: "File must be an image" }, 400);
  }

  const ext = file.name?.split(".").pop() || "png";
  const id = generateId();
  const filename = `${id}.${ext}`;
  const filepath = path.join(uploadDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  const url = `/api/images/${filename}`;
  return c.json({ url, filename }, 201);
});

// serve an uploaded image
images.get("/:filename", (c) => {
  const filename = c.req.param("filename");
  // basic path traversal protection
  if (filename.includes("..") || filename.includes("/")) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  const filepath = path.join(uploadDir, filename);
  if (!fs.existsSync(filepath)) {
    return c.json({ error: "Not found" }, 404);
  }

  const data = fs.readFileSync(filepath);
  const ext = filename.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "png" ? "image/png" :
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
    ext === "gif" ? "image/gif" :
    ext === "webp" ? "image/webp" :
    "application/octet-stream";

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

export default images;
