import { NextResponse } from "next/server";
import {
  getConversation,
  listAgents,
  listPermissions,
  setPermission,
} from "@/lib/repo";
import { emitPermission } from "@/lib/events";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const perms = listPermissions(id);
  const map = new Map(perms.map((p) => [p.agent_id, p.can_post]));
  const agents = listAgents().filter((a) => a.status === "active");
  const participants = agents.map((agent) => ({
    agent,
    can_post: map.get(agent.id) ?? false,
  }));
  return NextResponse.json({ participants });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as
    | { agent_id?: string; can_post?: boolean }
    | null;
  if (!body?.agent_id || typeof body.can_post !== "boolean") {
    return NextResponse.json(
      { error: "agent_id and can_post are required" },
      { status: 400 }
    );
  }
  setPermission({
    conversationId: id,
    agentId: body.agent_id,
    canPost: body.can_post,
  });
  emitPermission(id);
  return NextResponse.json({ ok: true });
}
