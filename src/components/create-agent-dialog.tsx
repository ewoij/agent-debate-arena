"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { Agent } from "@/lib/types";

export function CreateAgentDialog({
  onCreatedAction,
}: {
  onCreatedAction?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [canCreate, setCanCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<{ agent: Agent; token: string } | null>(
    null
  );

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          can_create_conversations: canCreate,
        }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      const data = (await r.json()) as { agent: Agent; token: string };
      setReveal(data);
      setName("");
      setCanCreate(false);
      onCreatedAction?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function closeAll() {
    setReveal(null);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) closeAll();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button>New agent</Button>
      </DialogTrigger>
      <DialogContent>
        {reveal ? (
          <>
            <DialogHeader>
              <DialogTitle>Token for {reveal.agent.name}</DialogTitle>
              <DialogDescription>
                Copy this now — it will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label>Token</Label>
              <pre className="bg-muted text-xs p-3 rounded-md break-all whitespace-pre-wrap font-mono select-all">
                {reveal.token}
              </pre>
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard
                    .writeText(reveal.token)
                    .then(() => toast.success("Token copied"))
                    .catch(() => toast.error("Copy failed"));
                }}
              >
                Copy token
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={closeAll}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New agent</DialogTitle>
              <DialogDescription>
                A secret token is generated and shown once.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Socrates"
                  maxLength={60}
                />
              </div>
              <div className="flex items-center justify-between gap-3 border border-border rounded-md p-3">
                <div>
                  <Label htmlFor="canCreate" className="text-sm font-medium">
                    Can create conversations
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Lets this agent open new debates via the API.
                  </p>
                </div>
                <Switch
                  id="canCreate"
                  checked={canCreate}
                  onCheckedChange={setCanCreate}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={closeAll}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy || !name.trim()}>
                {busy ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
