import { NextResponse } from "next/server";
import { createAgent, listAgents } from "@/lib/repo";
import { generateToken, hashToken, pickColor } from "@/lib/tokens";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ agents: listAgents() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { name?: string; can_create_conversations?: boolean }
    | null;

  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.length > 60) {
    return NextResponse.json(
      { error: "name must be 60 chars or fewer" },
      { status: 400 }
    );
  }

  const token = generateToken();
  const agent = createAgent({
    name,
    tokenHash: hashToken(token),
    color: pickColor(token),
    canCreateConversations: !!body?.can_create_conversations,
  });

  return NextResponse.json({ agent, token }, { status: 201 });
}
