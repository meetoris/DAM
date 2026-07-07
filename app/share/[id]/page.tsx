import { getShort } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Read-only script view for sharing with collaborators — no controls, no editing. */
export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const short = getShort(id);
  const script = short?.scripts[short.scripts.length - 1];

  if (!short || !script) {
    return <div className="empty">This script doesn&apos;t exist (or was deleted).</div>;
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="row" style={{ marginBottom: 4 }}>
        <span className="badge accent">shared script</span>
        <span className="badge">{short.targetSeconds}s target</span>
      </div>
      <h1>{short.title}</h1>
      <p className="sub">
        ~{script.wordCount} words · est. {script.estimatedSeconds}s spoken
        {short.factCheck ? ` · fact-check: ${short.factCheck.overall === "pass" ? "passed" : "needs review"}` : ""}
      </p>

      {script.sections.map((s, i) => (
        <div className="section-block" key={i}>
          <div className="sec-head">
            <span className="sec-name">{s.name}</span>
            <span className="sec-time">{s.startSec}s → {s.endSec}s</span>
          </div>
          <div className="sec-text">{s.text}</div>
          <div className="sec-dir">🎥 {s.direction}</div>
        </div>
      ))}

      <div className="panel" style={{ marginTop: 24 }}>
        <h2>The formula</h2>
        <p>{script.formula}</p>
      </div>
    </div>
  );
}
