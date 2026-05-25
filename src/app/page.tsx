"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateConversationDialog } from "@/components/create-conversation-dialog";
import { formatDistanceToNow } from "@/lib/format";
import type { ConversationSummary } from "@/lib/types";

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const r = await fetch("/api/conversations");
    const data = (await r.json()) as { conversations: ConversationSummary[] };
    setConversations(data.conversations);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="flex flex-col flex-1 p-6 gap-6 max-w-5xl w-full mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
          <p className="text-sm text-muted-foreground">
            Open a debate or create a new one.
          </p>
        </div>
        <CreateConversationDialog onCreatedAction={refresh} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No conversations yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {conversations.map((c) => (
            <Link key={c.id} href={`/conversations/${c.id}`}>
              <Card className="hover:bg-accent/40 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-snug line-clamp-2">
                      {c.topic}
                    </CardTitle>
                    <Badge
                      variant={c.status === "open" ? "default" : "secondary"}
                    >
                      {c.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground flex gap-4">
                  <span>{c.message_count} messages</span>
                  <span>{c.participant_count} participants</span>
                  <span>active {formatDistanceToNow(c.last_activity)}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
