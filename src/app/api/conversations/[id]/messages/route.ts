import { NextResponse } from "next/server";
import {
  canAgentPost,
  getAgentByToken,
  getConversation,
  insertEvent,
  insertMessage,
  listMessages,
  listReadCursors,
  upsertReadCursor,
} from "@/lib/repo";
import { emitCursors, emitEvent, emitMessage } from "@/lib/events";
import {
  persistInlineAttachments,
  UploadError,
  type InlineAttachment,
} from "@/lib/uploads";
import type { MessageAttachment } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BODY_LEN = 16_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? Number(sinceParam) : 0;
  const messages = listMessages(id, Number.isFinite(since) ? since : 0);

  const auth = request.headers.get("authorization");
  let cursorChanged = false;
  if (auth) {
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const viewer = getAgentByToken(token);
    if (viewer) {
      const highestSeen = messages.length > 0
        ? Math.max(...messages.map((m) => m.id))
        : Number.isFinite(since) ? since : 0;
      if (highestSeen > 0) {
        upsertReadCursor(id, viewer.id, highestSeen);
        cursorChanged = true;
      }
    }
  }

  const read_cursors = listReadCursors(id);
  if (cursorChanged) {
    emitCursors(id, read_cursors);
  }
  return NextResponse.json({ messages, read_cursors });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as
    | {
        body?: string;
        as?: "moderator";
        attachments?: InlineAttachment[];
      }
    | null;

  const text = body?.body?.trim() ?? "";
  const inlineAttachments = Array.isArray(body?.attachments)
    ? body.attachments
    : [];

  if (!text && inlineAttachments.length === 0) {
    return NextResponse.json(
      { error: "body or attachments is required" },
      { status: 400 }
    );
  }
  if (text.length > MAX_BODY_LEN) {
    return NextResponse.json(
      { error: `body must be ${MAX_BODY_LEN} chars or fewer` },
      { status: 400 }
    );
  }

  let attachments: MessageAttachment[] = [];
  if (inlineAttachments.length > 0) {
    try {
      attachments = persistInlineAttachments(inlineAttachments);
    } catch (e) {
      const msg =
        e instanceof UploadError
          ? e.message
          : e instanceof Error
            ? e.message
            : "attachment failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const auth = request.headers.get("authorization");
  if (auth) {
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const agent = getAgentByToken(token);
    if (!agent) {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }
    if (conversation.status === "closed") {
      const event = insertEvent({
        conversationId: id,
        kind: "rejected",
        agentId: agent.id,
        payload: { body_preview: text.slice(0, 200), reason: "closed" },
      });
      emitEvent(id, event);
      return NextResponse.json(
        { error: "conversation is closed" },
        { status: 403 }
      );
    }
    if (!canAgentPost(id, agent.id)) {
      const event = insertEvent({
        conversationId: id,
        kind: "rejected",
        agentId: agent.id,
        payload: { body_preview: text.slice(0, 200), reason: "muted" },
      });
      emitEvent(id, event);
      return NextResponse.json(
        { error: "agent is muted in this conversation" },
        { status: 403 }
      );
    }
    const message = insertMessage({
      conversationId: id,
      authorType: "agent",
      authorAgentId: agent.id,
      body: text,
      attachments,
    });
    emitMessage(id, message);
    return NextResponse.json({ message }, { status: 201 });
  }

  if (conversation.status === "closed") {
    return NextResponse.json(
      { error: "conversation is closed" },
      { status: 403 }
    );
  }

  // No token: only the moderator UI can post (local-only trust).
  if (body?.as !== "moderator") {
    return NextResponse.json(
      { error: "missing Authorization header" },
      { status: 401 }
    );
  }
  const message = insertMessage({
    conversationId: id,
    authorType: "moderator",
    authorAgentId: null,
    body: text,
    attachments,
  });
  emitMessage(id, message);
  return NextResponse.json({ message }, { status: 201 });
}
