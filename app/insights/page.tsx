"use client";

import { useEffect, useState } from "react";
import { PerformanceInsights } from "@/lib/types";

export default function InsightsPage() {
  const [insights, setInsights] = useState<PerformanceInsights | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/insights", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load insights.");
        setInsights(data);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error-box">{error}</div>;
  if (!insights) return <div className="muted"><span className="spinner" />Analyzing your channels…</div>;

  const igCount = insights.videos.filter((v) => v.platform === "instagram").length;
  const ytCount = insights.videos.filter((v) => v.platform === "youtube").length;

  return (
    <div>
      <h1>Performance Insights</h1>
      <p className="sub">
        The feedback loop: your Reels and Shorts are analyzed for what actually works, and every new script is biased
        toward it.
      </p>

      {insights.usingSampleData && (
        <div className="notice">
          Showing bundled sample data. Add <span className="mono">INSTAGRAM_ACCESS_TOKEN</span> /{" "}
          <span className="mono">INSTAGRAM_USER_ID</span> and <span className="mono">YOUTUBE_API_KEY</span> /{" "}
          <span className="mono">YOUTUBE_CHANNEL_ID</span> to .env to analyze your real channels.
        </div>
      )}

      <div className="panel" style={{ marginBottom: 18 }}>
        <h2>What&apos;s working ({igCount} Reels · {ytCount} Shorts analyzed)</h2>
        {insights.takeaways.map((t, i) => (
          <div className="takeaway" key={i}>
            <span className="tick">→</span>
            <span>{t.replace(/^-\s*/, "")}</span>
          </div>
        ))}
        <p className="muted small" style={{ marginTop: 14 }}>
          These takeaways are injected into every script generation (when “use my performance insights” is on), so the
          writer keeps improving as your numbers come in.
        </p>
      </div>

      <div className="panel" style={{ overflowX: "auto" }}>
        <h2>Recent videos</h2>
        <table className="stats">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Video</th>
              <th className="num">Length</th>
              <th className="num">Views</th>
              <th className="num">Likes</th>
              <th className="num">Comments</th>
              <th className="num">Retention</th>
            </tr>
          </thead>
          <tbody>
            {insights.videos.map((v) => (
              <tr key={`${v.platform}-${v.id}`}>
                <td>{v.platform === "instagram" ? "📸 IG" : "▶ YT"}</td>
                <td>
                  {v.title}
                  {v.hook && <div className="muted small">“{v.hook}”</div>}
                </td>
                <td className="num">{v.durationSec ? `${v.durationSec}s` : "—"}</td>
                <td className="num">{fmt(v.views)}</td>
                <td className="num">{fmt(v.likes)}</td>
                <td className="num">{fmt(v.comments)}</td>
                <td className="num">{v.retentionPct != null ? `${v.retentionPct}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n);
}
