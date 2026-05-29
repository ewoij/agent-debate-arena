import { NextResponse } from "next/server";
import {
  createAgent,
  createConversation,
  insertMessage,
  listAgents,
  setPermission,
} from "@/lib/repo";
import { emitMessage, emitPermission } from "@/lib/events";
import { generateToken, hashToken, pickColor } from "@/lib/tokens";
import { randomAgentName } from "@/lib/agent-names";

export const runtime = "nodejs";

const MAX_TOPIC_LEN = 500;
const MAX_PROMPT_LEN = 16_000;
const MAX_AGENTS = 12;

interface AgentInput {
  name?: string;
  persona?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { topic?: string; moderatorPrompt?: string; agents?: AgentInput[] }
    | null;

  const topic = body?.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }
  if (topic.length > MAX_TOPIC_LEN) {
    return NextResponse.json(
      { error: `topic must be ${MAX_TOPIC_LEN} chars or fewer` },
      { status: 400 }
    );
  }

  const moderatorPrompt = body?.moderatorPrompt?.trim() ?? "";
  if (moderatorPrompt.length > MAX_PROMPT_LEN) {
    return NextResponse.json(
      { error: `opening prompt must be ${MAX_PROMPT_LEN} chars or fewer` },
      { status: 400 }
    );
  }

  const agentInputs = Array.isArray(body?.agents) ? body.agents : [];
  if (agentInputs.length === 0) {
    return NextResponse.json(
      { error: "at least one agent is required" },
      { status: 400 }
    );
  }
  if (agentInputs.length > MAX_AGENTS) {
    return NextResponse.json(
      { error: `at most ${MAX_AGENTS} agents can be set up at once` },
      { status: 400 }
    );
  }
  for (const a of agentInputs) {
    if (a.name && a.name.trim().length > 60) {
      return NextResponse.json(
        { error: "agent names must be 60 chars or fewer" },
        { status: 400 }
      );
    }
  }

  // 1. Create the conversation.
  const conversation = createConversation({ topic });

  // 2. Post the opening prompt as the moderator (optional).
  if (moderatorPrompt) {
    const message = insertMessage({
      conversationId: conversation.id,
      authorType: "moderator",
      authorAgentId: null,
      body: moderatorPrompt,
    });
    emitMessage(conversation.id, message);
  }

  // 3. Mint each agent, then enable it to post in this conversation.
  const used = new Set(listAgents().map((a) => a.name));
  const agents = agentInputs.map((input) => {
    let name = input.name?.trim();
    if (!name) {
      name = randomAgentName([...used]);
    }
    used.add(name);

    const token = generateToken();
    const agent = createAgent({
      name,
      tokenHash: hashToken(token),
      color: pickColor(token),
      canCreateConversations: false,
    });
    setPermission({
      conversationId: conversation.id,
      agentId: agent.id,
      canPost: true,
    });
    return { id: agent.id, name: agent.name, token };
  });

  emitPermission(conversation.id);

  return NextResponse.json(
    {
      conversation: { id: conversation.id, topic: conversation.topic },
      agents,
    },
    { status: 201 }
  );
}
