"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MODEL_OPTIONS, SourceType } from "@/lib/types";

const LENGTHS = [30, 45, 60, 90];

export default function NewShort() {
  const router = useRouter();
  const [providersReady, setProvidersReady] = useState<{ anthropic: boolean; openai: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const set = (k: string) => Boolean(d.fields?.find((f: { key: string; set: boolean }) => f.key === k)?.set);
        setProvidersReady({ anthropic: set("anthropicApiKey"), openai: set("openaiApiKey") });
      })
      .catch(() => setProvidersReady(null));
  }, []);
  const [sourceType, setSourceType] = useState<SourceType>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState("");
  const [targetSeconds, setTargetSeconds] = useState(45);
  const [model, setModel] = useState("claude-fable-5");
  const [useInsights, setUseInsights] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("sourceType", sourceType);
      form.set("url", url);
      form.set("text", text);
      if (file) form.set("file", file);
      form.set("angle", angle);
      form.set("targetSeconds", String(targetSeconds));
      form.set("model", model);
      form.set("useInsights", String(useInsights));

      const res = await fetch("/api/shorts", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.push(`/shorts/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1>New Short</h1>
      <p className="sub">Give it source material and an angle — it writes the script, then you take it to camera.</p>

      <form onSubmit={submit}>
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="seg" style={{ marginBottom: 18 }}>
            {(["url", "text", "file"] as SourceType[]).map((t) => (
              <button key={t} type="button" className={sourceType === t ? "active" : ""} onClick={() => setSourceType(t)}>
                {t === "url" ? "Article URL" : t === "text" ? "Paste text" : "Upload file"}
              </button>
            ))}
          </div>

          {sourceType === "url" && (
            <label className="field">
              <span>Article / post URL</span>
              <input type="url" placeholder="https://example.com/that-article" value={url} onChange={(e) => setUrl(e.target.value)} required />
            </label>
          )}
          {sourceType === "text" && (
            <label className="field">
              <span>Raw text</span>
              <textarea rows={8} placeholder="Paste the article, notes, transcript, or anything the script should be based on…" value={text} onChange={(e) => setText(e.target.value)} required />
            </label>
          )}
          {sourceType === "file" && (
            <label className="field">
              <span>File (.pdf, .docx, .txt, .md, .csv…)</span>
              <input type="file" accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </label>
          )}

          <label className="field">
            <span>Your angle (optional)</span>
            <textarea
              rows={2}
              placeholder='e.g. "Frame it for indie founders, skeptical tone, mention I tested this myself"'
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
            />
          </label>
        </div>

        <div className="panel" style={{ marginBottom: 18 }}>
          <label className="field">
            <span>Target length</span>
            <div className="seg">
              {LENGTHS.map((len) => (
                <button key={len} type="button" className={targetSeconds === len ? "active" : ""} onClick={() => setTargetSeconds(len)}>
                  {len}s
                </button>
              ))}
            </div>
          </label>

          <label className="field">
            <span>Script writer</span>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {MODEL_OPTIONS.map((m) => {
                const live = providersReady ? providersReady[m.provider] : true;
                return (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.blurb}{live ? "" : " (demo mode — add key in Settings)"}
                  </option>
                );
              })}
            </select>
            {providersReady && !providersReady[MODEL_OPTIONS.find((m) => m.id === model)!.provider] && (
              <div className="small muted" style={{ marginTop: 6 }}>
                This model has no API key yet, so it will generate a demo placeholder script.{" "}
                <Link href="/settings" style={{ textDecoration: "underline" }}>Add the key in Settings → Integrations</Link>.
              </div>
            )}
          </label>

          <label className="row small" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={useInsights} onChange={(e) => setUseInsights(e.target.checked)} style={{ width: "auto" }} />
            <span>
              Use my performance insights — bias the script toward hooks, lengths, and topics that
              worked in my past Reels/Shorts
            </span>
          </label>
        </div>

        {error && <div className="error-box">{error}</div>}

        <button className="btn btn-primary" disabled={busy} style={{ fontSize: 15, padding: "12px 24px" }}>
          {busy ? (<><span className="spinner" />Writing your script…</>) : "Generate script →"}
        </button>
      </form>
    </div>
  );
}
