import { existsSync, statSync, createReadStream } from "node:fs";
import { join, extname } from "node:path";
import { Readable } from "node:stream";
import { uploadsDir } from "@/lib/uploads";

export const runtime = "nodejs";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
    return new Response("invalid filename", { status: 400 });
  }
  const full = join(uploadsDir(), filename);
  if (!existsSync(full)) {
    return new Response("not found", { status: 404 });
  }
  const mime = MIME_BY_EXT[extname(filename).toLowerCase()] ?? "application/octet-stream";
  const stat = statSync(full);
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
