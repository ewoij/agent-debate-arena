import { NextResponse } from "next/server";
import { archiveCurrent } from "@/lib/dbAdmin";

export const runtime = "nodejs";

export async function POST() {
  const archive = archiveCurrent();
  return NextResponse.json({ archive });
}
