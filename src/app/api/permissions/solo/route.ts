import { NextResponse } from "next/server";
import { getAgent, insertEvent, soloAgentGlobally } from "@/lib/repo";
import { emitEvent, emitPermission } from "@/lib/events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { agent_id?: string }
    | null;
  if (!body?.agent_id) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }
  const agent = getAgent(body.agent_id);
  if (!agent) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }
  const conversationIds = soloAgentGlobally(body.agent_id);
  for (const cid of conversationIds) {
    const event = insertEvent({
      conversationId: cid,
      kind: "soloed",
      agentId: body.agent_id,
      payload: {},
    });
    emitEvent(cid, event);
    emitPermission(cid);
  }
  return NextResponse.json({
    affected_conversations: conversationIds.length,
  });
}
