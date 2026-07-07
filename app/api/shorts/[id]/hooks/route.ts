import { NextRequest, NextResponse } from "next/server";
import { getShort } from "@/lib/store";
import { generateHookVariants } from "@/lib/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns 3 alternate hook lines — transient, not persisted until the creator picks one. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const short = getShort(id);
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const hooks = await generateHookVariants(short);
    return NextResponse.json({ hooks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate hook variants.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
