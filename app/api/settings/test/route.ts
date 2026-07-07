import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { cred } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Integration = "anthropic" | "openai" | "pexels" | "instagram" | "youtube";

/**
 * Live connection test per integration — minimal, near-zero-cost calls so the
 * admin can validate a credential the moment it's saved.
 */
export async function POST(req: NextRequest) {
  const { integration } = (await req.json().catch(() => ({}))) as { integration?: Integration };
  try {
    switch (integration) {
      case "anthropic": {
        const key = cred("anthropicApiKey");
        if (!key) return fail("No Anthropic API key configured.");
        const client = new Anthropic({ apiKey: key });
        const count = await client.messages.countTokens({
          model: "claude-haiku-4-5",
          messages: [{ role: "user", content: "ping" }],
        });
        return ok(`Key is valid (count_tokens returned ${count.input_tokens} tokens).`);
      }
      case "openai": {
        const key = cred("openaiApiKey");
        if (!key) return fail("No OpenAI API key configured.");
        const client = new OpenAI({ apiKey: key });
        const models = await client.models.list();
        const target = cred("openaiModel") || "gpt-5.5";
        const found = models.data.some((m) => m.id === target);
        return ok(`Key is valid.${found ? ` Model "${target}" is available.` : ` Note: model "${target}" not in your model list — set "OpenAI model id" to one you have access to.`}`);
      }
      case "pexels": {
        const key = cred("pexelsApiKey");
        if (!key) return fail("No Pexels API key configured.");
        const res = await fetch("https://api.pexels.com/videos/search?query=city&per_page=1", {
          headers: { Authorization: key },
        });
        if (!res.ok) return fail(`Pexels rejected the key (HTTP ${res.status}).`);
        return ok("Key is valid — stock clips will be matched to B-roll scenes.");
      }
      case "instagram": {
        const token = cred("instagramAccessToken");
        const userId = cred("instagramUserId");
        if (!token || !userId) return fail("Instagram access token and user id are both required.");
        const res = await fetch(
          `https://graph.instagram.com/v21.0/${userId}?fields=id,username&access_token=${token}`
        );
        const data = (await res.json()) as { username?: string; error?: { message?: string } };
        if (!res.ok) return fail(`Instagram API error: ${data.error?.message ?? `HTTP ${res.status}`}`);
        return ok(`Connected as @${data.username ?? userId}.`);
      }
      case "youtube": {
        const key = cred("youtubeApiKey");
        const channelId = cred("youtubeChannelId");
        if (!key || !channelId) return fail("YouTube API key and channel id are both required.");
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${key}`
        );
        const data = (await res.json()) as { items?: { snippet?: { title?: string } }[]; error?: { message?: string } };
        if (!res.ok) return fail(`YouTube API error: ${data.error?.message ?? `HTTP ${res.status}`}`);
        const title = data.items?.[0]?.snippet?.title;
        if (!title) return fail("Key works, but the channel id was not found.");
        return ok(`Connected to channel "${title}".`);
      }
      default:
        return fail("Unknown integration.");
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Connection test failed.");
  }
}

function ok(message: string) {
  return NextResponse.json({ ok: true, message });
}
function fail(message: string) {
  return NextResponse.json({ ok: false, message });
}
