import fs from "fs";
import path from "path";
import { PerformanceInsights, VideoStat } from "./types";
import { insightsSummaryPrompt } from "./prompts";
import { generateJSON, hasKeyFor } from "./ai";
import { mockInsightTakeaways } from "./mock";
import { cred } from "./settings";

/**
 * The performance feedback loop: pull the creator's recent Reels/Shorts
 * (real APIs when credentials exist, bundled sample data otherwise), derive
 * takeaways, and produce a compact summary that gets injected into every
 * script-generation prompt.
 */
export async function getInsights(): Promise<PerformanceInsights> {
  const [ig, igReal] = await fetchInstagram();
  const [yt, ytReal] = await fetchYouTube();
  const videos = [...ig, ...yt].sort((a, b) => b.views - a.views);
  const usingSampleData = !(igReal || ytReal);

  const takeaways = await deriveTakeaways(videos);
  const top = videos.slice(0, 3).map((v) => `"${v.hook ?? v.title}" (${fmt(v.views)} views)`);
  const promptSummary = [
    `Top performing hooks: ${top.join("; ")}.`,
    ...takeaways.map((t) => t.replace(/^-\s*/, "")),
  ].join(" ");

  return {
    generatedAt: new Date().toISOString(),
    usingSampleData,
    videos,
    takeaways,
    promptSummary,
  };
}

async function deriveTakeaways(videos: VideoStat[]): Promise<string[]> {
  // Heuristic takeaways computed from the data itself
  const heuristics = computeHeuristics(videos);

  // If an Anthropic key exists, layer AI-written takeaways on top
  if (hasKeyFor("claude-sonnet-5")) {
    try {
      const table = videos
        .map(
          (v) =>
            `${v.platform} | ${v.title} | hook: "${v.hook ?? "?"}" | ${v.durationSec}s | ${fmt(v.views)} views | ${fmt(v.likes)} likes | ${v.comments} comments | retention ${v.retentionPct ?? "?"}% | topic: ${v.topic ?? "?"}`
        )
        .join("\n");
      const result = await generateJSON<{ takeaways: string[] }>({
        model: "claude-sonnet-5",
        system: "You are a short-form video growth analyst. Be concrete and directive.",
        prompt: insightsSummaryPrompt(table),
        schema: {
          type: "object",
          properties: { takeaways: { type: "array", items: { type: "string" } } },
          required: ["takeaways"],
          additionalProperties: false,
        },
        schemaName: "insight_takeaways",
        maxTokens: 2000,
      });
      if (result.takeaways?.length) return result.takeaways;
    } catch {
      // fall through to heuristics
    }
  }
  return heuristics.length ? heuristics : mockInsightTakeaways();
}

function computeHeuristics(videos: VideoStat[]): string[] {
  if (videos.length < 3) return [];
  const out: string[] = [];
  const byViews = [...videos].sort((a, b) => b.views - a.views);
  const topThird = byViews.slice(0, Math.max(1, Math.floor(videos.length / 3)));
  const bottomThird = byViews.slice(-Math.max(1, Math.floor(videos.length / 3)));

  const avgTopDur = avg(topThird.map((v) => v.durationSec));
  const avgBotDur = avg(bottomThird.map((v) => v.durationSec));
  out.push(
    `- Your best videos average ${Math.round(avgTopDur)}s; your weakest average ${Math.round(avgBotDur)}s — target ~${Math.round(avgTopDur)}s.`
  );

  const topTopics = count(topThird.map((v) => v.topic ?? "other"));
  const botTopics = count(bottomThird.map((v) => v.topic ?? "other"));
  const best = Object.entries(topTopics).sort((a, b) => b[1] - a[1])[0];
  const worst = Object.entries(botTopics).sort((a, b) => b[1] - a[1])[0];
  if (best) out.push(`- "${best[0]}" content dominates your top performers — lead with it.`);
  if (worst && worst[0] !== best?.[0]) out.push(`- "${worst[0]}" content clusters in your weakest videos — avoid or reframe it.`);

  const withRet = videos.filter((v) => v.retentionPct != null);
  if (withRet.length >= 3) {
    const topRet = avg(topThird.map((v) => v.retentionPct ?? 0));
    out.push(`- Top videos hold ${Math.round(topRet)}% average retention — structure for a mid-video payoff to keep it there.`);
  }

  const claimHooks = topThird.filter((v) => v.hook && !v.hook.includes("?")).length;
  if (claimHooks >= topThird.length / 2) {
    out.push(`- Statement/claim hooks outperform question hooks in your data — open with a bold claim, not a question.`);
  }
  return out;
}

async function fetchInstagram(): Promise<[VideoStat[], boolean]> {
  const token = cred("instagramAccessToken");
  const userId = cred("instagramUserId");
  if (token && userId) {
    try {
      const url = `https://graph.instagram.com/v21.0/${userId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,media_product_type&limit=25&access_token=${token}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { data?: any[] };
        const reels = (data.data ?? []).filter((m) => m.media_product_type === "REELS");
        const stats: VideoStat[] = [];
        for (const m of reels.slice(0, 10)) {
          let views = 0;
          try {
            const ins = await fetch(
              `https://graph.instagram.com/v21.0/${m.id}/insights?metric=views&access_token=${token}`
            );
            if (ins.ok) {
              const insData = (await ins.json()) as { data?: any[] };
              views = insData.data?.[0]?.values?.[0]?.value ?? 0;
            }
          } catch { /* keep views at 0 */ }
          stats.push({
            platform: "instagram",
            id: m.id,
            title: (m.caption ?? "Untitled reel").slice(0, 80),
            publishedAt: m.timestamp?.slice(0, 10) ?? "",
            views,
            likes: m.like_count ?? 0,
            comments: m.comments_count ?? 0,
            durationSec: 0,
          });
        }
        if (stats.length) return [stats, true];
      }
    } catch { /* fall through to samples */ }
  }
  return [loadSample("instagram.json"), false];
}

async function fetchYouTube(): Promise<[VideoStat[], boolean]> {
  const key = cred("youtubeApiKey");
  const channelId = cred("youtubeChannelId");
  if (key && channelId) {
    try {
      const search = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&maxResults=15&order=date&type=video&videoDuration=short&key=${key}`
      );
      if (search.ok) {
        const searchData = (await search.json()) as { items?: any[] };
        const ids = (searchData.items ?? []).map((i) => i.id?.videoId).filter(Boolean);
        if (ids.length) {
          const stats = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}&key=${key}`
          );
          if (stats.ok) {
            const statsData = (await stats.json()) as { items?: any[] };
            const videos: VideoStat[] = (statsData.items ?? []).map((v) => ({
              platform: "youtube" as const,
              id: v.id,
              title: v.snippet?.title ?? "Untitled",
              publishedAt: v.snippet?.publishedAt?.slice(0, 10) ?? "",
              views: Number(v.statistics?.viewCount ?? 0),
              likes: Number(v.statistics?.likeCount ?? 0),
              comments: Number(v.statistics?.commentCount ?? 0),
              durationSec: parseISODuration(v.contentDetails?.duration ?? "PT0S"),
            }));
            if (videos.length) return [videos, true];
          }
        }
      }
    } catch { /* fall through to samples */ }
  }
  return [loadSample("youtube.json"), false];
}

function loadSample(file: string): VideoStat[] {
  try {
    const p = path.join(process.cwd(), "data", "samples", file);
    return JSON.parse(fs.readFileSync(p, "utf8")) as VideoStat[];
  } catch {
    return [];
  }
}

function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  return (Number(m?.[1] ?? 0)) * 60 + Number(m?.[2] ?? 0);
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
function count(items: string[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, i) => ((acc[i] = (acc[i] ?? 0) + 1), acc), {});
}
function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n);
}
