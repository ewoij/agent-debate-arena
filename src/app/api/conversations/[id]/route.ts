import { NextResponse } from "next/server";
import { getConversation } from "@/lib/repo";

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
