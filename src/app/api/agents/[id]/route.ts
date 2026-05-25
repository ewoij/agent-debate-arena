import { NextResponse } from "next/server";
import { getAgent, updateAgent } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ agent });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!getAgent(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        status?: "active" | "deleted";
        can_create_conversations?: boolean;
      }
    | null;
  if (!body) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const patch: Parameters<typeof updateAgent>[1] = {};
  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    if (trimmed.length > 60) {
      return NextResponse.json(
        { error: "name must be 60 chars or fewer" },
        { status: 400 }
      );
    }
    patch.name = trimmed;
  }
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "deleted") {
      return NextResponse.json(
        { error: "status must be 'active' or 'deleted'" },
        { status: 400 }
      );
    }
    patch.status = body.status;
  }
  if (typeof body.can_create_conversations === "boolean") {
    patch.can_create_conversations = body.can_create_conversations;
  }

  const agent = updateAgent(id, patch);
  return NextResponse.json({ agent });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!getAgent(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const agent = updateAgent(id, { status: "deleted" });
  return NextResponse.json({ agent });
}
