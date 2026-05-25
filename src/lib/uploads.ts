import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dbPath } from "./db";
import type { MessageAttachment } from "./types";

const UPLOADS_DIR = join(dirname(dbPath()), "uploads");

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const EXT_FOR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_MESSAGE = 4;

export class UploadError extends Error {}

export interface InlineAttachment {
  mime?: string;
  data_base64?: string;
}

function ensureDir() {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function uploadsDir(): string {
  return UPLOADS_DIR;
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
    if (!a.mime || !ALLOWED_MIME.has(a.mime)) {
      throw new UploadError(
        `attachment mime must be one of: ${[...ALLOWED_MIME].join(", ")}`
      );
    }
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
    const ext = EXT_FOR_MIME[a.mime];
    const filename = `${randomUUID()}.${ext}`;
    writeFileSync(join(UPLOADS_DIR, filename), buf);
    result.push({
      url: `/api/uploads/${filename}`,
      mime: a.mime,
      size: buf.byteLength,
    });
  }
  return result;
}
