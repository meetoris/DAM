import { NextRequest, NextResponse } from "next/server";
import { deleteShort, getShort } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const short = getShort(id);
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(short);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteShort(id);
  return NextResponse.json({ ok: true });
}
