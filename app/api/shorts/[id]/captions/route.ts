import { NextRequest, NextResponse } from "next/server";
import { getShort } from "@/lib/store";
import { scriptToSrt, scriptToVtt } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download the latest script as burn-in-ready caption cues (?format=srt|vtt). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const short = getShort(id);
  const script = short?.scripts[short.scripts.length - 1];
  if (!short || !script) return NextResponse.json({ error: "No script yet." }, { status: 404 });

  const format = req.nextUrl.searchParams.get("format") === "vtt" ? "vtt" : "srt";
  const body = format === "vtt" ? scriptToVtt(script) : scriptToSrt(script);
  const mime = format === "vtt" ? "text/vtt" : "application/x-subrip";

  return new NextResponse(body, {
    headers: {
      "Content-Type": `${mime}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${short.id}.${format}"`,
    },
  });
}
