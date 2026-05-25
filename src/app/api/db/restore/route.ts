import { NextResponse } from "next/server";
import { restoreArchive } from "@/lib/dbAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { name?: string }
    | null;
  if (!body?.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  try {
    const result = restoreArchive(body.name);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "restore failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
