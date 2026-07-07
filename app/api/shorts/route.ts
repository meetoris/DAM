import { NextRequest, NextResponse } from "next/server";
import { listShorts, newId, saveShort } from "@/lib/store";
import { extractArticle } from "@/lib/extract";
import { getInsights } from "@/lib/performance";
import { writeScript } from "@/lib/generate";
import { ModelId, Short, SourceType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listShorts());
}

export async function POST(req: NextRequest) {
  try {
    let sourceType: SourceType;
    let url = "";
    let text = "";
    let fileName = "";
    let angle = "";
    let targetSeconds = 45;
    let model: ModelId = "claude-fable-5";
    let useInsights = true;

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      sourceType = (form.get("sourceType") as SourceType) ?? "text";
      url = String(form.get("url") ?? "");
      text = String(form.get("text") ?? "");
      angle = String(form.get("angle") ?? "");
      targetSeconds = Number(form.get("targetSeconds") ?? 45);
      model = (String(form.get("model") ?? "claude-fable-5")) as ModelId;
      useInsights = form.get("useInsights") !== "false";
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        fileName = file.name;
        text = await file.text();
      }
    } else {
      const body = await req.json();
      sourceType = body.sourceType ?? "text";
      url = body.url ?? "";
      text = body.text ?? "";
      angle = body.angle ?? "";
      targetSeconds = Number(body.targetSeconds ?? 45);
      model = body.model ?? "claude-fable-5";
      useInsights = body.useInsights !== false;
    }

    let content = text;
    let title = "";
    if (sourceType === "url") {
      if (!url.trim()) return NextResponse.json({ error: "URL is required." }, { status: 400 });
      const article = await extractArticle(url.trim());
      content = article.content;
      title = article.title;
    }
    if (!content.trim()) {
      return NextResponse.json({ error: "No source content provided." }, { status: 400 });
    }

    let insightsUsed: string | undefined;
    if (useInsights) {
      try {
        insightsUsed = (await getInsights()).promptSummary;
      } catch { /* insights are best-effort */ }
    }

    const now = new Date().toISOString();
    const short: Short = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      title: title || content.slice(0, 60).replace(/\s+\S*$/, "") + "…",
      status: "draft",
      source: { type: sourceType, url: url || undefined, fileName: fileName || undefined, content },
      angle,
      targetSeconds,
      model,
      scripts: [],
      insightsUsed,
    };

    const script = await writeScript(short);
    short.scripts.push(script);
    short.title = script.title;
    short.status = "scripted";
    saveShort(short);

    return NextResponse.json(short, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create short.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
