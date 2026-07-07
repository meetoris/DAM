import { NextRequest, NextResponse } from "next/server";
import { getShort, saveShort } from "@/lib/store";
import { writeScript } from "@/lib/generate";
import { ModelId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rewrite / optimize the script, optionally applying creator feedback or a model switch. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const short = getShort(id);
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json().catch(() => ({}));
    const feedback: string | undefined = body.feedback || undefined;
    if (body.model) short.model = body.model as ModelId;
    if (body.targetSeconds) short.targetSeconds = Number(body.targetSeconds);
    if (typeof body.angle === "string") short.angle = body.angle;

    const script = await writeScript(short, feedback);
    short.scripts.push(script);
    short.title = script.title;
    // a rewritten script invalidates previous checks and plans
    short.factCheck = undefined;
    short.status = "scripted";
    saveShort(short);
    return NextResponse.json(short);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate script.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
