import { NextResponse } from "next/server";
import { currentDbInfo, listArchives } from "@/lib/dbAdmin";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    current: currentDbInfo(),
    archives: listArchives(),
  });
}
