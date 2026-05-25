"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/format";

interface ArchiveInfo {
  name: string;
  size: number;
  created_at: number;
}

interface DbInfo {
  current: { path: string; size: number };
  archives: ArchiveInfo[];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function SettingsPage() {
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<
    | null
    | { kind: "fresh" }
    | { kind: "restore"; name: string }
  >(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/db");
    if (!r.ok) return;
    const data = (await r.json()) as DbInfo;
    setInfo(data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function doArchive() {
    setBusy(true);
    try {
      const r = await fetch("/api/db/archive", { method: "POST" });
      if (!r.ok) throw new Error("Archive failed");
      toast.success("Archived current DB");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function doFresh() {
    setBusy(true);
    try {
      const r = await fetch("/api/db/fresh", { method: "POST" });
      if (!r.ok) throw new Error("Fresh start failed");
      toast.success("Fresh database");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function doRestore(name: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/db/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Restore failed");
      }
      toast.success(`Restored ${name}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <div className="flex flex-col flex-1 p-6 gap-6 max-w-3xl w-full mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage the local SQLite database.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current database</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          {info ? (
            <>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Path</span>
                <code className="text-xs">{info.current.path}</code>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Size</span>
                <span>{formatBytes(info.current.size)}</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Loading…</p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="secondary" onClick={doArchive} disabled={busy}>
              Archive current
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirm({ kind: "fresh" })}
              disabled={busy}
            >
              Start fresh database
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Start-fresh auto-archives the current database first.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Archives</CardTitle>
        </CardHeader>
        <CardContent>
          {!info?.archives?.length ? (
            <p className="text-sm text-muted-foreground">No archives yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {info.archives.map((a) => (
                <div
                  key={a.name}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <code className="text-xs truncate block">{a.name}</code>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(a.size)} ·{" "}
                      {formatDistanceToNow(a.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirm({ kind: "restore", name: a.name })}
                    disabled={busy}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <DialogContent>
          {confirm?.kind === "fresh" ? (
            <>
              <DialogHeader>
                <DialogTitle>Start fresh database?</DialogTitle>
                <DialogDescription>
                  The current database will be archived first. The new database
                  starts empty — all conversations, agents, and tokens will be
                  gone (you can restore the archive later).
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={doFresh} disabled={busy}>
                  {busy ? "Working…" : "Archive & start fresh"}
                </Button>
              </DialogFooter>
            </>
          ) : confirm?.kind === "restore" ? (
            <>
              <DialogHeader>
                <DialogTitle>Restore {confirm.name}?</DialogTitle>
                <DialogDescription>
                  The current database will be archived first as a safety
                  backup. Then this archive replaces it.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={() => doRestore(confirm.name)} disabled={busy}>
                  {busy ? "Working…" : "Backup current & restore"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
