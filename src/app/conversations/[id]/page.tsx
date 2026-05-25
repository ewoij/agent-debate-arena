"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatTime } from "@/lib/format";
import type { Agent, ArenaEvent, Conversation, Message } from "@/lib/types";

interface Participant {
  agent: Agent;
  can_post: boolean;
}

type TimelineEntry =
  | { kind: "message"; createdAt: number; key: string; data: Message }
  | { kind: "event"; createdAt: number; key: string; data: ArenaEvent };

function buildTimeline(messages: Message[], events: ArenaEvent[]): TimelineEntry[] {
  const merged: TimelineEntry[] = [
    ...messages.map<TimelineEntry>((m) => ({
      kind: "message",
      createdAt: m.created_at,
      key: `m-${m.id}`,
      data: m,
    })),
    ...events.map<TimelineEntry>((e) => ({
      kind: "event",
      createdAt: e.created_at,
      key: `e-${e.id}`,
      data: e,
    })),
  ];
  merged.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.key.localeCompare(b.key);
  });
  return merged;
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<ArenaEvent[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [soloTarget, setSoloTarget] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const loadConversation = useCallback(async () => {
    const r = await fetch(`/api/conversations/${id}`);
    if (!r.ok) return;
    const data = (await r.json()) as { conversation: Conversation };
    setConversation(data.conversation);
  }, [id]);

  const loadMessages = useCallback(async () => {
    const r = await fetch(`/api/conversations/${id}/messages`);
    if (!r.ok) return;
    const data = (await r.json()) as { messages: Message[] };
    setMessages(data.messages);
  }, [id]);

  const loadEvents = useCallback(async () => {
    const r = await fetch(`/api/conversations/${id}/events`);
    if (!r.ok) return;
    const data = (await r.json()) as { events: ArenaEvent[] };
    setEvents(data.events);
  }, [id]);

  const loadParticipants = useCallback(async () => {
    const r = await fetch(`/api/conversations/${id}/permissions`);
    if (!r.ok) return;
    const data = (await r.json()) as { participants: Participant[] };
    setParticipants(data.participants);
  }, [id]);

  // Initial load
  useEffect(() => {
    Promise.all([
      loadConversation(),
      loadMessages(),
      loadEvents(),
      loadParticipants(),
    ]).then(() => setLoading(false));
  }, [loadConversation, loadMessages, loadEvents, loadParticipants]);

  // Subscribe to SSE
  useEffect(() => {
    const source = new EventSource(`/api/conversations/${id}/stream`);
    source.addEventListener("message", (e) => {
      const msg = JSON.parse((e as MessageEvent).data) as Message;
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    });
    source.addEventListener("permission", () => {
      loadParticipants();
    });
    source.addEventListener("conversation", (e) => {
      const next = JSON.parse((e as MessageEvent).data) as Conversation;
      setConversation(next);
    });
    source.addEventListener("event", (e) => {
      const ev = JSON.parse((e as MessageEvent).data) as ArenaEvent;
      setEvents((prev) =>
        prev.some((x) => x.id === ev.id) ? prev : [...prev, ev]
      );
    });
    return () => source.close();
  }, [id, loadParticipants]);

  // Auto-scroll if user is near the bottom
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function onTimelineScroll() {
    const el = timelineRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  }

  async function bulkPermissions(action: "mute_all" | "unmute_all") {
    try {
      const r = await fetch(`/api/conversations/${id}/permissions/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) throw new Error("Bulk action failed");
      await loadParticipants();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function soloGlobally(agentId: string, agentName: string) {
    try {
      const r = await fetch(`/api/permissions/solo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
      if (!r.ok) throw new Error("Solo failed");
      const data = (await r.json()) as { affected_conversations: number };
      toast.success(
        `Soloed ${agentName} across ${data.affected_conversations} open conversation${
          data.affected_conversations === 1 ? "" : "s"
        }`
      );
      await loadParticipants();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function setStatus(next: "open" | "closed") {
    try {
      const r = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!r.ok) throw new Error("Failed");
      const data = (await r.json()) as { conversation: Conversation };
      setConversation(data.conversation);
      toast.success(next === "closed" ? "Conversation closed" : "Conversation reopened");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function togglePermission(agentId: string, next: boolean) {
    // Optimistic update
    setParticipants((prev) =>
      prev.map((p) =>
        p.agent.id === agentId ? { ...p, can_post: next } : p
      )
    );
    try {
      const r = await fetch(`/api/conversations/${id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, can_post: next }),
      });
      if (!r.ok) throw new Error("Toggle failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      // Rollback
      setParticipants((prev) =>
        prev.map((p) =>
          p.agent.id === agentId ? { ...p, can_post: !next } : p
        )
      );
    }
  }

  const conversationClosed = conversation?.status === "closed";

  const timeline = useMemo(
    () => buildTimeline(messages, events),
    [messages, events]
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Conversation not found.{" "}
        <Link href="/" className="ml-2 underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      <section className="flex-1 flex flex-col min-w-0 border-r border-border">
        <header className="border-b border-border px-6 py-4 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link href="/" className="hover:text-foreground">
                Conversations
              </Link>
              <span>/</span>
              <Badge variant={conversation.status === "open" ? "default" : "secondary"}>
                {conversation.status}
              </Badge>
            </div>
            <h1 className="text-base font-medium leading-snug">
              {conversation.topic}
            </h1>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <a
              href={`/api/conversations/${id}/export?format=json`}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
            >
              JSON
            </a>
            <a
              href={`/api/conversations/${id}/export?format=markdown`}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
            >
              MD
            </a>
            {conversation.status === "open" ? (
              <Button variant="outline" size="sm" onClick={() => setStatus("closed")}>
                Close
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setStatus("open")}>
                Reopen
              </Button>
            )}
          </div>
        </header>

        <div
          ref={timelineRef}
          onScroll={onTimelineScroll}
          className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4"
        >
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No messages yet. Type below or wait for an agent to post.
            </p>
          ) : (
            timeline.map((entry) =>
              entry.kind === "message" ? (
                <MessageRow key={entry.key} message={entry.data} />
              ) : (
                <EventRow key={entry.key} event={entry.data} />
              )
            )
          )}
        </div>

        <div className="border-t border-border p-3 shrink-0">
          {conversationClosed ? (
            <p className="text-xs text-muted-foreground text-center">
              Conversation is closed.
            </p>
          ) : (
            <Composer conversationId={id} />
          )}
        </div>
      </section>

      <aside className="w-72 shrink-0 flex flex-col bg-muted/20">
        <header className="px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-medium">Participants</h2>
          <p className="text-xs text-muted-foreground">
            Toggle posting per agent. Muted by default.
          </p>
        </header>
        <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
          {participants.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              No agents registered yet.{" "}
              <Link href="/agents" className="underline">
                Add one
              </Link>
              .
            </p>
          ) : (
            participants.map((p) => (
              <div
                key={p.agent.id}
                className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-accent/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: p.agent.color }}
                  />
                  <span className="text-sm truncate">{p.agent.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSoloTarget(p.agent)}
                    disabled={conversationClosed}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded disabled:opacity-0"
                    title="Solo this agent across all open conversations"
                  >
                    solo
                  </button>
                  <Switch
                    checked={p.can_post}
                    onCheckedChange={(v) => togglePermission(p.agent.id, v)}
                    disabled={conversationClosed}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <Separator />
        <div className="p-2 text-xs text-muted-foreground space-y-2">
          <div className="flex gap-2 px-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => bulkPermissions("mute_all")}
              disabled={conversationClosed || participants.length === 0}
            >
              Mute all
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => bulkPermissions("unmute_all")}
              disabled={conversationClosed || participants.length === 0}
            >
              Unmute all
            </Button>
          </div>
          <p className="px-2">
            {participants.filter((p) => p.can_post).length} of{" "}
            {participants.length} can post.
          </p>
        </div>
      </aside>

      <Dialog
        open={!!soloTarget}
        onOpenChange={(o) => !o && setSoloTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solo {soloTarget?.name}?</DialogTitle>
            <DialogDescription>
              This will mute every other agent in every open conversation, and
              ensure {soloTarget?.name} can post in all of them. Closed
              conversations are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSoloTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (soloTarget) {
                  soloGlobally(soloTarget.id, soloTarget.name);
                  setSoloTarget(null);
                }
              }}
            >
              Solo globally
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Composer({ conversationId }: { conversationId: string }) {
  const [value, setValue] = useState("");
  const [posting, setPosting] = useState(false);

  async function send() {
    const body = value.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, as: "moderator" }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to post");
      }
      setValue("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="flex gap-2 items-end">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Post as Moderator… (⌘/Ctrl+Enter to send, markdown supported)"
        rows={2}
        className="resize-none"
      />
      <Button onClick={send} disabled={posting || !value.trim()}>
        {posting ? "Sending…" : "Send"}
      </Button>
    </div>
  );
}

const EventRow = memo(function EventRow({ event }: { event: ArenaEvent }) {
  const time = formatTime(event.created_at);
  if (event.kind === "permission_changed") {
    const action = event.payload.can_post ? "unmuted" : "muted";
    return (
      <SystemLine time={time}>
        Moderator {action}{" "}
        <AgentRef name={event.agent_name} color={event.agent_color} />
      </SystemLine>
    );
  }
  if (event.kind === "closed") {
    return <SystemLine time={time}>Conversation closed</SystemLine>;
  }
  if (event.kind === "reopened") {
    return <SystemLine time={time}>Conversation reopened</SystemLine>;
  }
  if (event.kind === "muted_all") {
    return <SystemLine time={time}>Moderator muted everyone</SystemLine>;
  }
  if (event.kind === "unmuted_all") {
    return <SystemLine time={time}>Moderator unmuted everyone</SystemLine>;
  }
  if (event.kind === "soloed") {
    return (
      <SystemLine time={time}>
        Soloed{" "}
        <AgentRef name={event.agent_name} color={event.agent_color} /> globally
      </SystemLine>
    );
  }
  if (event.kind === "rejected") {
    const reason = event.payload.reason ?? "blocked";
    return (
      <div className="flex flex-col gap-1 border-l-2 border-amber-500/40 pl-3 py-1">
        <div className="flex items-center gap-2 text-xs text-amber-500/90">
          <span>⊘</span>
          <AgentRef name={event.agent_name} color={event.agent_color} />
          <span>tried to post — {reason}</span>
          <span className="text-muted-foreground">{time}</span>
        </div>
        {event.payload.body_preview ? (
          <p className="pl-5 text-xs text-muted-foreground italic line-clamp-3">
            “{event.payload.body_preview}”
          </p>
        ) : null}
      </div>
    );
  }
  return null;
});

function SystemLine({
  time,
  children,
}: {
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1">
      <span className="border-t border-border flex-1" />
      <span className="flex items-center gap-1.5 px-2">
        {children}
        <span className="opacity-70">· {time}</span>
      </span>
      <span className="border-t border-border flex-1" />
    </div>
  );
}

function AgentRef({
  name,
  color,
}: {
  name: string | null;
  color: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: color ?? "#888" }}
      />
      <span className="font-medium text-foreground">{name ?? "(unknown)"}</span>
    </span>
  );
}

const MessageRow = memo(function MessageRow({ message }: { message: Message }) {
  const isModerator = message.author_type === "moderator";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs">
        {isModerator ? (
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-foreground/60 shrink-0" />
        ) : (
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: message.author_color ?? "#888" }}
          />
        )}
        <span className="font-medium text-foreground">
          {message.author_name}
        </span>
        {isModerator ? (
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            moderator
          </Badge>
        ) : null}
        <span className="text-muted-foreground">
          {formatTime(message.created_at)}
        </span>
      </div>
      <div className="pl-5 text-sm markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.body}</ReactMarkdown>
      </div>
    </div>
  );
});
