import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { closeDb, dbPath, getDb } from "./db";

const ARCHIVES_DIR = join(dirname(dbPath()), "archives");

export interface ArchiveInfo {
  name: string;
  size: number;
  created_at: number;
}

function archiveTargetPath(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
  return join(ARCHIVES_DIR, `arena-${ts}.db`);
}

function ensureArchivesDir() {
  mkdirSync(ARCHIVES_DIR, { recursive: true });
}

function deleteSidecars() {
  const p = dbPath();
  for (const ext of ["-wal", "-shm"]) {
    const f = p + ext;
    if (existsSync(f)) {
      try {
        unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  }
}

export function archiveCurrent(): ArchiveInfo {
  ensureArchivesDir();
  closeDb();
  const target = archiveTargetPath();
  if (existsSync(dbPath())) {
    copyFileSync(dbPath(), target);
  }
  // Reopen so subsequent requests work.
  getDb();
  const stat = statSync(target);
  return { name: basename(target), size: stat.size, created_at: stat.mtimeMs };
}

export function startFresh(): { archived: ArchiveInfo | null } {
  let archived: ArchiveInfo | null = null;
  if (existsSync(dbPath())) {
    archived = archiveCurrent();
  }
  closeDb();
  if (existsSync(dbPath())) {
    try {
      unlinkSync(dbPath());
    } catch {
      /* ignore */
    }
  }
  deleteSidecars();
  // Reopen creates the schema fresh.
  getDb();
  return { archived };
}

export function restoreArchive(name: string): {
  safetyBackup: ArchiveInfo;
} {
  if (!name || name.includes("/") || name.includes("..")) {
    throw new Error("invalid archive name");
  }
  const source = join(ARCHIVES_DIR, name);
  if (!existsSync(source)) {
    throw new Error("archive not found");
  }
  const safetyBackup = archiveCurrent();
  closeDb();
  deleteSidecars();
  copyFileSync(source, dbPath());
  getDb();
  return { safetyBackup };
}

export function listArchives(): ArchiveInfo[] {
  if (!existsSync(ARCHIVES_DIR)) return [];
  return readdirSync(ARCHIVES_DIR)
    .filter((f) => f.endsWith(".db"))
    .map((name) => {
      const full = join(ARCHIVES_DIR, name);
      const stat = statSync(full);
      return { name, size: stat.size, created_at: stat.mtimeMs };
    })
    .sort((a, b) => b.created_at - a.created_at);
}

export function currentDbInfo(): { path: string; size: number } {
  const p = dbPath();
  if (!existsSync(p)) return { path: p, size: 0 };
  return { path: p, size: statSync(p).size };
}
