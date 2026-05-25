import { NextResponse } from "next/server";
import { getConversation, listReadCursors } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!getConversation(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ read_cursors: listReadCursors(id) });
}
