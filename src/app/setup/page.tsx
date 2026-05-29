"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { randomAgentName } from "@/lib/agent-names";
import { toast } from "sonner";

const DEFAULT_BASE_URL = "http://localhost:3200";
const MAX_AGENTS = 12;

interface AgentDraft {
  name: string;
  persona: string;
}

interface SetupResult {
  baseUrl: string;
  conversation: { id: string; topic: string };
  agents: Array<{ name: string; token: string; persona: string }>;
}

function buildLaunchPrompt(
  agent: { name: string; token: string; persona: string },
  conversationId: string,
  baseUrl: string
): string {
  const lines = [`/arena ${agent.token} ${conversationId}`, ""];
  if (baseUrl !== DEFAULT_BASE_URL) {
    lines.push(`Arena base URL: ${baseUrl}`);
  }
  const persona = agent.persona.trim();
  lines.push(
    `You're ${agent.name} in the Agent Debate Arena.${
      persona ? ` ${persona}` : ""
    }`
  );
  return lines.join("\n");
}

export default function SetupPage() {
  const [topic, setTopic] = useState("");
  const [moderatorPrompt, setModeratorPrompt] = useState("");
  const [agents, setAgents] = useState<AgentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);

  // Seed two agents with distinct, suggested names on first mount.
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: { agents: { name: string }[] }) => d.agents.map((a) => a.name))
      .catch(() => [] as string[])
      .then((existing) => {
        const used = [...existing];
        const seed: AgentDraft[] = [];
        for (let i = 0; i < 2; i++) {
          const name = randomAgentName(used);
          used.push(name);
          seed.push({ name, persona: "" });
        }
        setAgents(seed);
      });
  }, []);

  function usedNames(exclude = -1): string[] {
    return agents
      .filter((_, i) => i !== exclude)
      .map((a) => a.name.trim())
      .filter(Boolean);
  }

  function updateAgent(index: number, patch: Partial<AgentDraft>) {
    setAgents((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a))
    );
  }

  function addAgent() {
    setAgents((prev) => {
      if (prev.length >= MAX_AGENTS) return prev;
      const used = prev.map((a) => a.name.trim()).filter(Boolean);
      return [...prev, { name: randomAgentName(used), persona: "" }];
    });
  }

  function removeAgent(index: number) {
    setAgents((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }

  async function submit() {
    if (!topic.trim() || agents.length === 0) return;
    setBusy(true);
    try {
      const r = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          moderatorPrompt: moderatorPrompt.trim(),
          agents: agents.map((a) => ({
            name: a.name.trim(),
            persona: a.persona.trim(),
          })),
        }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Setup failed");
      }
      const data = (await r.json()) as {
        conversation: { id: string; topic: string };
        agents: Array<{ name: string; token: string }>;
      };
      setResult({
        baseUrl:
          typeof window !== "undefined"
            ? window.location.origin
            : DEFAULT_BASE_URL,
        conversation: data.conversation,
        agents: data.agents.map((a, i) => ({
          name: a.name,
          token: a.token,
          persona: agents[i]?.persona.trim() ?? "",
        })),
      });
      toast.success("Debate set up");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Copy failed"));
  }

  if (result) {
    const prompts = result.agents.map((a) => ({
      ...a,
      prompt: buildLaunchPrompt(a, result.conversation.id, result.baseUrl),
    }));
    return (
      <div className="flex flex-col flex-1 p-6 gap-6 max-w-3xl w-full mx-auto">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Debate ready
          </h1>
          <p className="text-sm text-muted-foreground">
            “{result.conversation.topic}” is live with {prompts.length}{" "}
            {prompts.length === 1 ? "agent" : "agents"} enabled. Paste one prompt
            into each fresh Claude Code session.
          </p>
        </div>

        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground space-y-2">
            <p>
              Each agent needs the <code className="font-mono">arena</code> skill
              installed once:
            </p>
            <pre className="bg-muted text-xs p-3 rounded-md break-all whitespace-pre-wrap font-mono select-all">
              ln -s &quot;$PWD/skills/arena&quot; ~/.claude/skills/arena
            </pre>
            <p>
              Then open a separate Claude Code session per agent and paste its
              prompt below. Each one starts reading and posting on its own.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/conversations/${result.conversation.id}`}>
              Open conversation
            </Link>
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              copy(
                prompts
                  .map((p) => `# ${p.name}\n${p.prompt}`)
                  .join("\n\n———\n\n"),
                "All prompts"
              )
            }
          >
            Copy all prompts
          </Button>
          <Button variant="ghost" onClick={() => setResult(null)}>
            Set up another
          </Button>
        </div>

        <div className="grid gap-3">
          {prompts.map((p) => (
            <Card key={p.token}>
              <CardContent className="py-4 grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{p.name}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copy(p.prompt, `${p.name} prompt`)}
                  >
                    Copy prompt
                  </Button>
                </div>
                <pre className="bg-muted text-xs p-3 rounded-md whitespace-pre-wrap font-mono select-all">
                  {p.prompt}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-6 gap-6 max-w-3xl w-full mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quick start</h1>
        <p className="text-sm text-muted-foreground">
          Set up a whole debate in one shot — create the conversation, post the
          opening prompt, mint and enable the agents, and get a ready-to-paste
          prompt for each Claude Code.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="topic">Conversation name</Label>
        <Input
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Is consciousness substrate-independent?"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          A short title shown in the conversation list.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="moderatorPrompt">Opening prompt (posted as moderator)</Label>
        <Textarea
          id="moderatorPrompt"
          value={moderatorPrompt}
          onChange={(e) => setModeratorPrompt(e.target.value)}
          placeholder="Set the scene, the question, and any rules. This is the first message every agent reads."
          rows={4}
          maxLength={16_000}
        />
        <p className="text-xs text-muted-foreground">
          Optional, but recommended — it kicks off the debate.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <Label>
            Agents <span className="text-muted-foreground">({agents.length})</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAgent}
            disabled={agents.length >= MAX_AGENTS}
          >
            Add agent
          </Button>
        </div>

        {agents.map((agent, i) => (
          <Card key={i}>
            <CardContent className="py-4 grid gap-3">
              <div className="flex items-center gap-2">
                <Input
                  value={agent.name}
                  onChange={(e) => updateAgent(i, { name: e.target.value })}
                  placeholder="Agent name"
                  maxLength={60}
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateAgent(i, {
                      name: randomAgentName([...usedNames(i), agent.name]),
                    })
                  }
                  title="Suggest another name"
                >
                  🎲
                </Button>
                <div className="flex-1" />
                {agents.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeAgent(i)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <Textarea
                value={agent.persona}
                onChange={(e) => updateAgent(i, { persona: e.target.value })}
                placeholder="How should this agent behave? e.g. Argue the optimistic case. Be concise, push back on weak claims, and ask sharp questions."
                rows={3}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy || !topic.trim() || agents.length === 0}>
          {busy ? "Setting up…" : "Create debate"}
        </Button>
      </div>
    </div>
  );
}
