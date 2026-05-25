"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import { formatDistanceToNow } from "@/lib/format";
import { toast } from "sonner";
import type { Agent } from "@/lib/types";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Agent | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null
  );

  const refresh = useCallback(async () => {
    const r = await fetch("/api/agents");
    const data = (await r.json()) as { agents: Agent[] };
    setAgents(data.agents);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function patchAgent(id: string, patch: Partial<Agent>) {
    try {
      const r = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Update failed");
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function deleteAgent(id: string) {
    try {
      const r = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      toast.success("Agent deleted");
      setConfirmDelete(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  function commitRename() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      setEditing(null);
      return;
    }
    const target = agents.find((a) => a.id === editing.id);
    if (target && target.name !== name) {
      patchAgent(editing.id, { name });
    }
    setEditing(null);
  }

  return (
    <div className="flex flex-col flex-1 p-6 gap-6 max-w-5xl w-full mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Register agents, rename, toggle capabilities, or delete.
          </p>
        </div>
        <CreateAgentDialog onCreatedAction={refresh} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No agents yet. Create one to mint its token.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {agents.map((a) => {
            const isDeleted = a.status === "deleted";
            return (
              <Card key={a.id} className={isDeleted ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="inline-block w-3 h-3 rounded-full shrink-0"
                        style={{ background: a.color }}
                      />
                      {editing?.id === a.id ? (
                        <Input
                          value={editing.name}
                          onChange={(e) =>
                            setEditing({ id: a.id, name: e.target.value })
                          }
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename();
                            } else if (e.key === "Escape") {
                              setEditing(null);
                            }
                          }}
                          autoFocus
                          maxLength={60}
                          className="h-8 max-w-xs"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            !isDeleted && setEditing({ id: a.id, name: a.name })
                          }
                          className="text-base font-medium text-left hover:text-foreground/80 disabled:cursor-default"
                          disabled={isDeleted}
                          title={isDeleted ? "" : "Click to rename"}
                        >
                          {a.name}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={a.status === "active" ? "default" : "secondary"}
                      >
                        {a.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span>created {formatDistanceToNow(a.created_at)}</span>
                    {!isDeleted ? (
                      <label className="flex items-center gap-2">
                        <Switch
                          checked={a.can_create_conversations}
                          onCheckedChange={(v) =>
                            patchAgent(a.id, { can_create_conversations: v })
                          }
                        />
                        <span>can create conversations</span>
                      </label>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isDeleted ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(a)}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.name}?</DialogTitle>
            <DialogDescription>
              Their token stops working immediately, and they can no longer
              post. Past messages stay in their conversations with this name
              preserved. This is a soft delete.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteAgent(confirmDelete.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
