import { NextResponse } from "next/server";
import { getInsights } from "@/lib/performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getInsights());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load insights.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
