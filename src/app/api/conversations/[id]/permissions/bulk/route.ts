import { NextResponse } from "next/server";
import {
  getConversation,
  insertEvent,
  muteAllInConversation,
  unmuteAllInConversation,
} from "@/lib/repo";
import { emitEvent, emitPermission } from "@/lib/events";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!getConversation(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as
    | { action?: "mute_all" | "unmute_all" }
    | null;
  if (body?.action !== "mute_all" && body?.action !== "unmute_all") {
    return NextResponse.json(
      { error: "action must be 'mute_all' or 'unmute_all'" },
      { status: 400 }
    );
  }
  if (body.action === "mute_all") {
    muteAllInConversation(id);
  } else {
    unmuteAllInConversation(id);
  }
  const event = insertEvent({
    conversationId: id,
    kind: body.action === "mute_all" ? "muted_all" : "unmuted_all",
    agentId: null,
    payload: {},
  });
  emitEvent(id, event);
  emitPermission(id);
  return NextResponse.json({ ok: true });
}
