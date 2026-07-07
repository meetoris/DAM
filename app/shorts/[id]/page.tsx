"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Teleprompter from "@/components/Teleprompter";
import { MODEL_OPTIONS, Short } from "@/lib/types";

type Tab = "script" | "formula" | "factcheck" | "broll";

export default function ShortWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [short, setShort] = useState<Short | null>(null);
  const [tab, setTab] = useState<Tab>("script");
  const [revision, setRevision] = useState(-1); // -1 = latest
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [prompterOpen, setPrompterOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTexts, setEditTexts] = useState<string[]>([]);
  const [hookOptions, setHookOptions] = useState<string[] | null>(null);
  const [hookBusy, setHookBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/shorts/${id}`, { cache: "no-store" });
    if (res.ok) setShort(await res.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const script = useMemo(() => {
    if (!short?.scripts.length) return null;
    const idx = revision === -1 ? short.scripts.length - 1 : revision;
    return short.scripts[Math.min(idx, short.scripts.length - 1)];
  }, [short, revision]);

  const spokenText = useMemo(
    () => (script ? script.sections.map((s) => s.text).join("\n\n") : ""),
    [script]
  );

  async function act(label: string, path: string, body?: object) {
    setBusy(label);
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${label} failed.`);
      setShort(data);
      setRevision(-1);
      setHookOptions(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  }

  async function loadHookOptions() {
    setHookBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/shorts/${id}/hooks`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate hook options.");
      setHookOptions(data.hooks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate hook options.");
    } finally {
      setHookBusy(false);
    }
  }

  async function useHook(hookText: string) {
    if (!script) return;
    const hookIdx = script.sections.findIndex((s) => s.name.toLowerCase() === "hook");
    const idx = hookIdx === -1 ? 0 : hookIdx;
    const texts = editing ? [...editTexts] : script.sections.map((s) => s.text);
    texts[idx] = hookText;
    setBusy("Save");
    setError("");
    try {
      const res = await fetch(`/api/shorts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionTexts: texts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply hook.");
      setShort(data);
      setHookOptions(null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply hook.");
    } finally {
      setBusy(null);
    }
  }

  function download(name: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportMarkdown() {
    if (!short || !script) return;
    const md = [
      `# ${script.title}`,
      ``,
      `**Target:** ${short.targetSeconds}s · **Model:** ${script.model} · **Words:** ${script.wordCount}`,
      ``,
      `## Script`,
      ...script.sections.map((s) => `### ${s.name} (${s.startSec}s–${s.endSec}s)\n${s.text}\n*Delivery: ${s.direction}*`),
      ``,
      `## Formula`,
      script.formula,
    ].join("\n");
    download(`${slug(script.title)}.md`, md, "text/markdown");
  }

  function exportDoc() {
    if (!short || !script) return;
    const html = `<html><head><meta charset="utf-8"><title>${esc(script.title)}</title></head><body>
      <h1>${esc(script.title)}</h1>
      <p><b>Target:</b> ${short.targetSeconds}s &middot; <b>Model:</b> ${esc(script.model)} &middot; <b>Words:</b> ${script.wordCount}</p>
      ${script.sections.map((s) => `<h3>${esc(s.name)} (${s.startSec}s–${s.endSec}s)</h3><p>${esc(s.text)}</p><p><i>Delivery: ${esc(s.direction)}</i></p>`).join("")}
      <h2>Formula</h2><p>${esc(script.formula)}</p>
    </body></html>`;
    download(`${slug(script.title)}.doc`, html, "application/msword");
  }

  async function copyScript() {
    await navigator.clipboard.writeText(spokenText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  function startEditing() {
    if (!script) return;
    setEditTexts(script.sections.map((s) => s.text));
    setRevision(-1);
    setEditing(true);
    setHookOptions(null);
  }

  async function saveEdits() {
    setBusy("Save");
    setError("");
    try {
      const res = await fetch(`/api/shorts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionTexts: editTexts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setShort(data);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this short?")) return;
    await fetch(`/api/shorts/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (!short) return <div className="muted"><span className="spinner" />Loading…</div>;

  const model = MODEL_OPTIONS.find((m) => m.id === short.model);

  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <Link href="/" className="muted small">← All shorts</Link>
      </div>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <h1>{short.title}</h1>
          <div className="row" style={{ marginBottom: 20 }}>
            <span className={`badge ${short.status === "ready" ? "good" : "accent"}`}>{short.status}</span>
            <span className="badge">{short.targetSeconds}s target</span>
            <span className="badge">{model?.label ?? short.model}</span>
            {short.source.type === "url" && short.source.url && (
              <a href={short.source.url} target="_blank" className="badge" rel="noreferrer">source ↗</a>
            )}
            {short.insightsUsed && <span className="badge accent" title={short.insightsUsed}>insights-tuned</span>}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={remove}>Delete</button>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="tabs">
        <button className={tab === "script" ? "active" : ""} onClick={() => setTab("script")}>Script</button>
        <button className={tab === "formula" ? "active" : ""} onClick={() => setTab("formula")}>Formula</button>
        <button className={tab === "factcheck" ? "active" : ""} onClick={() => setTab("factcheck")}>
          Fact-check{short.factCheck ? (short.factCheck.overall === "pass" ? " ✓" : " ⚠") : ""}
        </button>
        <button className={tab === "broll" ? "active" : ""} onClick={() => setTab("broll")}>
          B-roll{short.broll ? ` (${short.broll.scenes.length})` : ""}
        </button>
      </div>

      {tab === "script" && script && (
        <div>
          <div className="row" style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setPrompterOpen(true)}>🎬 Teleprompter</button>
            <button className="btn" onClick={copyScript}>{copied ? "Copied ✓" : "Copy script"}</button>
            <button className="btn" onClick={exportMarkdown}>Export .md</button>
            <button className="btn" onClick={exportDoc}>Export .doc</button>
            <a className="btn" href={`/api/shorts/${id}/captions?format=srt`}>Export .srt</a>
            <a className="btn" href={`/api/shorts/${id}/captions?format=vtt`}>Export .vtt</a>
            <button className="btn" onClick={copyShareLink}>{linkCopied ? "Link copied ✓" : "🔗 Share"}</button>
            <button className="btn" disabled={hookBusy} onClick={loadHookOptions}>
              {hookBusy ? (<><span className="spinner" />Writing hooks…</>) : "🪝 3 hook options"}
            </button>
            {editing ? (
              <>
                <button className="btn btn-primary" disabled={busy !== null} onClick={saveEdits}>
                  {busy === "Save" ? (<><span className="spinner" />Saving…</>) : "Save edits"}
                </button>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn" onClick={startEditing}>✎ Edit</button>
            )}
            <div className="grow" />
            {short.scripts.length > 1 && (
              <select
                style={{ width: "auto" }}
                value={revision === -1 ? short.scripts.length - 1 : revision}
                onChange={(e) => { setRevision(Number(e.target.value)); setHookOptions(null); }}
              >
                {short.scripts.map((s, i) => (
                  <option key={i} value={i}>
                    Draft {i + 1}{i === short.scripts.length - 1 ? " (latest)" : ""} — {s.model}
                  </option>
                ))}
              </select>
            )}
          </div>

          {script.revisionNote && <div className="muted small" style={{ marginBottom: 12 }}>{script.revisionNote}</div>}

          {hookOptions && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <h2 style={{ margin: 0 }}>Pick a hook</h2>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setHookOptions(null)}>✕</button>
              </div>
              {hookOptions.map((h, i) => (
                <div className="claim" key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="grow">“{h}”</div>
                  <button className="btn btn-sm btn-primary" disabled={busy !== null} onClick={() => useHook(h)}>Use this</button>
                </div>
              ))}
            </div>
          )}

          {script.sections.map((s, i) => (
            <div className="section-block" key={i}>
              <div className="sec-head">
                <span className="sec-name">{s.name}</span>
                <span className="sec-time">{s.startSec}s → {s.endSec}s</span>
              </div>
              {editing ? (
                <textarea
                  rows={2}
                  value={editTexts[i] ?? ""}
                  onChange={(e) => setEditTexts((prev) => prev.map((t, j) => (j === i ? e.target.value : t)))}
                />
              ) : (
                <div className="sec-text">{s.text}</div>
              )}
              <div className="sec-dir">🎥 {s.direction}</div>
            </div>
          ))}

          <div className="muted small" style={{ margin: "8px 0 24px" }}>
            ~{script.wordCount} words · est. {script.estimatedSeconds}s spoken · written by {script.model}
          </div>

          <div className="panel">
            <h2>Not quite right?</h2>
            <label className="field">
              <span>Tell it what to change — tone, hook, facts to add, anything</span>
              <textarea
                rows={3}
                placeholder='e.g. "Punchier hook, drop the second stat, make the CTA about saving the video"'
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </label>
            <div className="row">
              <button
                className="btn btn-primary"
                disabled={busy !== null || !feedback.trim()}
                onClick={() => { act("Rewrite", `/api/shorts/${id}/generate`, { feedback }); setFeedback(""); }}
              >
                {busy === "Rewrite" ? (<><span className="spinner" />Rewriting…</>) : "Rewrite with feedback"}
              </button>
              <button
                className="btn"
                disabled={busy !== null}
                onClick={() => act("Optimize", `/api/shorts/${id}/generate`, { feedback: "Optimize this script: tighten every line, strengthen the hook, remove filler words, improve retention." })}
              >
                {busy === "Optimize" ? (<><span className="spinner" />Optimizing…</>) : "✨ Auto-optimize"}
              </button>
              <div className="grow" />
              <select
                style={{ width: "auto" }}
                value={short.model}
                disabled={busy !== null}
                onChange={(e) => act("Regenerate", `/api/shorts/${id}/generate`, { model: e.target.value, feedback: "Rewrite this script in your own style." })}
                title="Regenerate with a different model"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {tab === "formula" && script && (
        <div className="panel">
          <h2>The formula behind this script</h2>
          <p style={{ fontSize: 15.5 }}>{script.formula}</p>
          <h2 style={{ marginTop: 24 }}>Structure at a glance</h2>
          {script.sections.map((s, i) => {
            const pct = Math.max(4, ((s.endSec - s.startSec) / short.targetSeconds) * 100);
            return (
              <div key={i} className="row" style={{ marginBottom: 8 }}>
                <span style={{ width: 90 }} className="small mono muted">{s.startSec}–{s.endSec}s</span>
                <div style={{ width: `${pct}%`, minWidth: 60, background: "var(--panel-2)", border: "1px solid var(--line)", borderLeft: "3px solid var(--accent)", borderRadius: 6, padding: "4px 10px", fontSize: 13, fontWeight: 600 }}>
                  {s.name}
                </div>
              </div>
            );
          })}
          {short.insightsUsed && (
            <>
              <h2 style={{ marginTop: 24 }}>Performance insights baked in</h2>
              <p className="muted small">{short.insightsUsed}</p>
            </>
          )}
        </div>
      )}

      {tab === "factcheck" && (
        <div>
          <div className="row" style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" disabled={busy !== null} onClick={() => act("Fact-check", `/api/shorts/${id}/factcheck`)}>
              {busy === "Fact-check" ? (<><span className="spinner" />Checking claims…</>) : short.factCheck ? "Re-run fact-check" : "Run fact-check"}
            </button>
            {short.factCheck && (
              <>
                <span className={`badge ${short.factCheck.overall === "pass" ? "good" : "warn"}`}>
                  {short.factCheck.overall === "pass" ? "✓ Pass — safe to record" : "⚠ Needs review"}
                </span>
                {short.factCheck.usedWebSearch && <span className="badge accent">web-search verified</span>}
              </>
            )}
          </div>
          {!short.factCheck && <p className="muted">Every checkable claim in the script gets a verdict, an explanation, and a corrected phrasing when needed — before you say it on camera.</p>}
          {short.factCheck?.claims.map((c, i) => (
            <div key={i} className={`claim ${c.verdict}`}>
              <div className="verdict">{c.verdict}</div>
              <div style={{ margin: "4px 0" }}>“{c.claim}”</div>
              <div className="muted small">{c.explanation}</div>
              {c.suggestion && <div className="suggestion">✏️ Say instead: “{c.suggestion}”</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "broll" && (
        <div>
          <div className="row" style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" disabled={busy !== null} onClick={() => act("B-roll", `/api/shorts/${id}/broll`)}>
              {busy === "B-roll" ? (<><span className="spinner" />Planning shots…</>) : short.broll ? "Re-plan B-roll" : "Generate B-roll plan"}
            </button>
            {short.broll && (
              <a className="btn" href={`/api/shorts/${id}/broll/download`}>⬇ Download all</a>
            )}
          </div>
          {!short.broll && (
            <p className="muted">
              It reads the script timing and plans cutaway clips — what to show, when to place it, and a matching stock clip
              for each moment. Record your A-roll, drop these on top, and the edit is mostly done.
            </p>
          )}
          {short.broll?.scenes.map((s, i) => (
            <div key={i} className="scene">
              <div className="thumb" style={s.clip?.thumbnailUrl ? { backgroundImage: `url(${s.clip.thumbnailUrl})` } : undefined}>
                {!s.clip?.thumbnailUrl && "no preview"}
              </div>
              <div className="grow">
                <div className="timecode">{s.startSec}s → {s.endSec}s</div>
                <div style={{ fontWeight: 600, margin: "2px 0" }}>{s.description}</div>
                <div className="muted small">{s.placementNote}</div>
                <div className="row small" style={{ marginTop: 6 }}>
                  <span className="badge">“{s.searchQuery}”</span>
                  {s.clip?.downloadUrl && <a className="badge good" href={s.clip.downloadUrl} target="_blank" rel="noreferrer">clip ↗</a>}
                  {s.clip?.searchUrl && <a className="badge" href={s.clip.searchUrl} target="_blank" rel="noreferrer">find on Pexels ↗</a>}
                  {s.clip?.credit && <span className="muted">{s.clip.credit}</span>}
                </div>
              </div>
            </div>
          ))}
          {short.broll && !short.broll.scenes.some((s) => s.clip?.downloadUrl) && (
            <div className="notice">
              No <span className="mono">PEXELS_API_KEY</span> configured — showing search links instead of downloadable clips.
              Add a free key to .env and re-plan to get real footage matched automatically.
            </div>
          )}
        </div>
      )}

      {prompterOpen && script && <Teleprompter text={spokenText} onClose={() => setPrompterOpen(false)} />}
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50) || "script";
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
