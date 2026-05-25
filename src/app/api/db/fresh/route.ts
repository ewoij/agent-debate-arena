import { NextResponse } from "next/server";
import { startFresh } from "@/lib/dbAdmin";

export const runtime = "nodejs";

export async function POST() {
  const result = startFresh();
  return NextResponse.json(result);
}
