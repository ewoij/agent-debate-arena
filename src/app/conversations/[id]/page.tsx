"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatTime } from "@/lib/format";
import type { Agent, Conversation, Message } from "@/lib/types";

interface Participant {
  agent: Agent;
  can_post: boolean;
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [posting, setPosting] = useState(false);
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

  const loadParticipants = useCallback(async () => {
    const r = await fetch(`/api/conversations/${id}/permissions`);
    if (!r.ok) return;
    const data = (await r.json()) as { participants: Participant[] };
    setParticipants(data.participants);
  }, [id]);

  // Initial load
  useEffect(() => {
    Promise.all([loadConversation(), loadMessages(), loadParticipants()]).then(
      () => setLoading(false)
    );
  }, [loadConversation, loadMessages, loadParticipants]);

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

  async function postModeratorMessage() {
    const body = composerValue.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, as: "moderator" }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to post");
      }
      setComposerValue("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPosting(false);
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

  const messageList = useMemo(() => messages, [messages]);

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
        </header>

        <div
          ref={timelineRef}
          onScroll={onTimelineScroll}
          className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4"
        >
          {messageList.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No messages yet. Type below or wait for an agent to post.
            </p>
          ) : (
            messageList.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))
          )}
        </div>

        <div className="border-t border-border p-3 shrink-0">
          {conversationClosed ? (
            <p className="text-xs text-muted-foreground text-center">
              Conversation is closed.
            </p>
          ) : (
            <div className="flex gap-2 items-end">
              <Textarea
                value={composerValue}
                onChange={(e) => setComposerValue(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    (e.metaKey || e.ctrlKey) &&
                    e.key === "Enter"
                  ) {
                    e.preventDefault();
                    postModeratorMessage();
                  }
                }}
                placeholder="Post as Moderator… (⌘/Ctrl+Enter to send, markdown supported)"
                rows={2}
                className="resize-none"
              />
              <Button
                onClick={postModeratorMessage}
                disabled={posting || !composerValue.trim()}
              >
                {posting ? "Sending…" : "Send"}
              </Button>
            </div>
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
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-accent/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: p.agent.color }}
                  />
                  <span className="text-sm truncate">{p.agent.name}</span>
                </div>
                <Switch
                  checked={p.can_post}
                  onCheckedChange={(v) => togglePermission(p.agent.id, v)}
                  disabled={conversationClosed}
                />
              </div>
            ))
          )}
        </div>
        <Separator />
        <div className="p-2 text-xs text-muted-foreground space-y-1">
          <p className="px-2">
            {participants.filter((p) => p.can_post).length} of{" "}
            {participants.length} can post.
          </p>
        </div>
      </aside>
    </div>
  );
}

function MessageRow({ message }: { message: Message }) {
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
        <span
          className={
            isModerator
              ? "font-medium text-foreground"
              : "font-medium text-foreground"
          }
        >
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
}
