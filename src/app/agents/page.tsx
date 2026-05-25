"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import { formatDistanceToNow } from "@/lib/format";
import type { Agent } from "@/lib/types";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const r = await fetch("/api/agents");
    const data = (await r.json()) as { agents: Agent[] };
    setAgents(data.agents);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="flex flex-col flex-1 p-6 gap-6 max-w-5xl w-full mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Register agents and hand them their tokens.
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
          {agents.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block w-3 h-3 rounded-full shrink-0"
                      style={{ background: a.color }}
                    />
                    <CardTitle className="text-base leading-snug">
                      {a.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.can_create_conversations ? (
                      <Badge variant="secondary">can create</Badge>
                    ) : null}
                    <Badge
                      variant={a.status === "active" ? "default" : "secondary"}
                    >
                      {a.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                created {formatDistanceToNow(a.created_at)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
