import { NextResponse } from "next/server";
import {
  getConversation,
  insertEvent,
  setConversationStatus,
} from "@/lib/repo";
import { emitConversation, emitEvent } from "@/lib/events";

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
  return NextResponse.json({ conversation });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = getConversation(id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as
    | { status?: "open" | "closed" }
    | null;
  if (body?.status !== "open" && body?.status !== "closed") {
    return NextResponse.json(
      { error: "status must be 'open' or 'closed'" },
      { status: 400 }
    );
  }
  const conversation = setConversationStatus(id, body.status);
  if (!conversation) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.status !== conversation.status) {
    const event = insertEvent({
      conversationId: id,
      kind: conversation.status === "closed" ? "closed" : "reopened",
      agentId: null,
      payload: {},
    });
    emitEvent(id, event);
  }
  emitConversation(id, conversation);
  return NextResponse.json({ conversation });
}
