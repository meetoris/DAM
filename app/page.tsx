import Link from "next/link";
import { listShorts } from "@/lib/store";
import { MODEL_OPTIONS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const shorts = listShorts();
  const keys = {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    pexels: Boolean(process.env.PEXELS_API_KEY),
  };

  return (
    <div>
      <h1>Your Shorts</h1>
      <p className="sub">
        From source material to a recordable, editable short — script, fact-check, teleprompter, B-roll.
      </p>

      {!keys.anthropic && !keys.openai && (
        <div className="notice">
          Demo mode: no AI keys found. Everything works with built-in placeholder generation — add{" "}
          <span className="mono">ANTHROPIC_API_KEY</span> (and optionally{" "}
          <span className="mono">OPENAI_API_KEY</span>, <span className="mono">PEXELS_API_KEY</span>) to{" "}
          <span className="mono">.env</span> for real output.
        </div>
      )}

      {shorts.length === 0 ? (
        <div className="empty">
          <p style={{ fontSize: 17, marginBottom: 6 }}>No shorts yet.</p>
          <p style={{ marginBottom: 20 }}>Drop in an article URL, raw text, or a file and get a full script in seconds.</p>
          <Link href="/new" className="btn btn-primary">＋ Create your first short</Link>
        </div>
      ) : (
        <div className="card-grid">
          {shorts.map((s) => {
            const script = s.scripts[s.scripts.length - 1];
            const model = MODEL_OPTIONS.find((m) => m.id === s.model);
            return (
              <Link key={s.id} href={`/shorts/${s.id}`} className="short-card">
                <div className="meta">
                  <span className={`badge ${s.status === "ready" ? "good" : s.status === "scripted" ? "accent" : ""}`}>
                    {s.status}
                  </span>
                  <span className="badge">{s.targetSeconds}s</span>
                  <span className="badge">{model?.label ?? s.model}</span>
                </div>
                <h3>{s.title}</h3>
                {script && <div className="muted small">Hook: “{script.hook.slice(0, 90)}{script.hook.length > 90 ? "…" : ""}”</div>}
                <div className="muted small">
                  {s.scripts.length} draft{s.scripts.length === 1 ? "" : "s"}
                  {s.factCheck ? ` · fact-checked (${s.factCheck.overall === "pass" ? "✓ pass" : "review"})` : ""}
                  {s.broll ? ` · ${s.broll.scenes.length} B-roll clips` : ""}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
