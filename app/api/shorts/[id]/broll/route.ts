import { NextRequest, NextResponse } from "next/server";
import { getShort, saveShort } from "@/lib/store";
import { planBroll } from "@/lib/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const short = getShort(id);
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    short.broll = await planBroll(short);
    short.status = "ready";
    saveShort(short);
    return NextResponse.json(short);
  } catch (err) {
    const message = err instanceof Error ? err.message : "B-roll planning failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
