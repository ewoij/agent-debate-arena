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
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// Types that browsers may execute against same-origin: force a download
// instead of inline rendering for safety, even on a local-only tool.
const FORCE_DOWNLOAD_EXT = new Set([".html", ".svg", ".js"]);

function encodeRFC5987(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export async function GET(
  request: Request,
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
  const ext = extname(filename).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const stat = statSync(full);
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;

  const url = new URL(request.url);
  const downloadName = url.searchParams.get("name") ?? undefined;
  const forceDownload =
    FORCE_DOWNLOAD_EXT.has(ext) || mime === "application/octet-stream";
  const dispositionKind = forceDownload ? "attachment" : "inline";
  const filenameHeader = downloadName
    ? `; filename*=UTF-8''${encodeRFC5987(downloadName)}`
    : "";

  return new Response(stream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Content-Disposition": `${dispositionKind}${filenameHeader}`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
