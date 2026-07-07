import { NextRequest, NextResponse } from "next/server";
import { deleteShort, getShort, saveShort } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const short = getShort(id);
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(short);
}

/** Manual edits: replace the spoken text of sections in the latest script. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const short = getShort(id);
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const script = short.scripts[short.scripts.length - 1];
  if (!script) return NextResponse.json({ error: "No script yet." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const texts: unknown = body.sectionTexts;
  if (!Array.isArray(texts) || texts.length !== script.sections.length || !texts.every((t) => typeof t === "string")) {
    return NextResponse.json({ error: "sectionTexts must be a string array matching the section count." }, { status: 400 });
  }

  script.sections = script.sections.map((s, i) => ({ ...s, text: (texts[i] as string).trim() }));
  script.wordCount = script.sections.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
  script.revisionNote = "Manually edited";
  // manual edits invalidate the previous fact-check
  short.factCheck = undefined;
  saveShort(short);
  return NextResponse.json(short);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteShort(id);
  return NextResponse.json({ ok: true });
}
