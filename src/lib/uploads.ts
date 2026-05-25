import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { dbPath } from "./db";
import type { MessageAttachment } from "./types";

const UPLOADS_DIR = join(dirname(dbPath()), "uploads");

// Best-effort mime→ext map; used as a fallback when the original
// filename has no extension. New entries are cheap to add.
const EXT_FOR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/json": "json",
  "application/zip": "zip",
  "application/x-tar": "tar",
  "application/gzip": "gz",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "text/html": "html",
  "text/css": "css",
  "text/javascript": "js",
  "application/javascript": "js",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_PER_MESSAGE = 4;
const SAFE_NAME = /[^A-Za-z0-9._-]+/g;

export class UploadError extends Error {}

export interface InlineAttachment {
  mime?: string;
  data_base64?: string;
  name?: string;
}

function ensureDir() {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function uploadsDir(): string {
  return UPLOADS_DIR;
}

function extensionFor(mime: string, originalName?: string): string {
  if (originalName) {
    const ext = extname(originalName).replace(/^\./, "").toLowerCase();
    if (ext && /^[a-z0-9]{1,8}$/.test(ext)) return ext;
  }
  return EXT_FOR_MIME[mime.toLowerCase()] ?? "bin";
}

function sanitizeName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  // Strip any path components, keep base name only.
  const base = trimmed.split(/[\\/]/).pop() ?? trimmed;
  const cleaned = base.replace(SAFE_NAME, "_").slice(0, 120);
  return cleaned || undefined;
}

export function persistInlineAttachments(
  inputs: InlineAttachment[]
): MessageAttachment[] {
  if (inputs.length > MAX_PER_MESSAGE) {
    throw new UploadError(`at most ${MAX_PER_MESSAGE} attachments per message`);
  }
  ensureDir();
  const result: MessageAttachment[] = [];
  for (const a of inputs) {
    const mime = (a.mime ?? "").trim() || "application/octet-stream";
    if (!a.data_base64) {
      throw new UploadError("attachment data_base64 is required");
    }
    const clean = a.data_base64.replace(/^data:[^;]+;base64,/, "");
    let buf: Buffer;
    try {
      buf = Buffer.from(clean, "base64");
    } catch {
      throw new UploadError("attachment data_base64 is not valid base64");
    }
    if (buf.byteLength === 0) {
      throw new UploadError("attachment is empty");
    }
    if (buf.byteLength > MAX_BYTES) {
      throw new UploadError(
        `attachment exceeds ${Math.round(MAX_BYTES / 1024 / 1024)}MB`
      );
    }
    const name = sanitizeName(a.name);
    const ext = extensionFor(mime, name);
    const filename = `${randomUUID()}.${ext}`;
    writeFileSync(join(UPLOADS_DIR, filename), buf);
    result.push({
      url: `/api/uploads/${filename}`,
      mime,
      size: buf.byteLength,
      ...(name ? { name } : {}),
    });
  }
  return result;
}
