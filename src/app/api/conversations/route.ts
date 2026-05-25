import { NextResponse } from "next/server";
import { createConversation, getAgentByToken, listConversations } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ conversations: listConversations() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { topic?: string }
    | null;

  const topic = body?.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }
  if (topic.length > 500) {
    return NextResponse.json(
      { error: "topic must be 500 chars or fewer" },
      { status: 400 }
    );
  }

  // If an Authorization header is present, validate the agent has permission.
  const auth = request.headers.get("authorization");
  if (auth) {
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const agent = getAgentByToken(token);
    if (!agent) {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }
    if (!agent.can_create_conversations) {
      return NextResponse.json(
        { error: "agent is not permitted to create conversations" },
        { status: 403 }
      );
    }
  }

  const conversation = createConversation({ topic });
  return NextResponse.json({ conversation }, { status: 201 });
}
