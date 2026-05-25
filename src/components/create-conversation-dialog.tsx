"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function CreateConversationDialog({
  onCreatedAction,
}: {
  onCreatedAction?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!topic.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to create conversation");
      }
      const data = (await r.json()) as {
        conversation: { id: string };
      };
      toast.success("Conversation created");
      setOpen(false);
      setTopic("");
      onCreatedAction?.();
      router.push(`/conversations/${data.conversation.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New conversation</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Write a topic or opening prompt — every participant reads it first.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="topic">Topic</Label>
          <Textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Debate: is consciousness substrate-independent?"
            rows={4}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">{topic.length}/500</p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !topic.trim()}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
