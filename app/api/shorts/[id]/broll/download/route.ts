import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getShort } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zip every matched B-roll clip (plus the placement plan) for one-click download. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const short = getShort(id);
  if (!short?.broll) return NextResponse.json({ error: "No B-roll plan yet." }, { status: 404 });

  const zip = new JSZip();
  const plan = short.broll.scenes
    .map(
      (s, i) =>
        `Clip ${i + 1}: place at ${s.startSec}s–${s.endSec}s\n` +
        `  Visual: ${s.description}\n` +
        `  Why here: ${s.placementNote}\n` +
        `  Search query: ${s.searchQuery}\n` +
        (s.clip?.credit ? `  Credit: ${s.clip.credit}\n` : "") +
        (s.clip?.searchUrl ? `  Find it: ${s.clip.searchUrl}\n` : "")
    )
    .join("\n");
  zip.file("broll-plan.txt", `B-roll plan for "${short.title}"\n\n${plan}`);

  let downloaded = 0;
  await Promise.all(
    short.broll.scenes.map(async (scene, i) => {
      const url = scene.clip?.downloadUrl;
      if (!url) return;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        const name = `clip-${String(i + 1).padStart(2, "0")}-${scene.startSec}s-${scene.searchQuery
          .replace(/[^a-z0-9]+/gi, "-")
          .slice(0, 30)}.mp4`;
        zip.file(name, buf);
        downloaded++;
      } catch { /* skip failed downloads; plan file still ships */ }
    })
  );

  const blob = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(blob), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="broll-${short.id}${downloaded ? "" : "-plan"}.zip"`,
    },
  });
}
