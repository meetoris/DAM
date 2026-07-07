"use client";

import { useEffect, useMemo, useState } from "react";

interface Field {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  set: boolean;
  source: "settings" | "env" | null;
  hint: string;
}

const FIELD_TESTS: Record<string, string> = {
  anthropicApiKey: "anthropic",
  openaiApiKey: "openai",
  pexelsApiKey: "pexels",
  instagramAccessToken: "instagram",
  youtubeApiKey: "youtube",
};

const GROUP_BLURBS: Record<string, string> = {
  "AI models": "Powers script writing, fact-checking, B-roll planning, and insight analysis.",
  "B-roll": "Matches a real downloadable stock clip to every planned B-roll scene (free key at pexels.com/api).",
  "Performance loop": "Pulls your real Reels/Shorts stats so scripts learn from what actually performs.",
};

export default function SettingsPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  async function load() {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setFields(data.fields);
    }
  }
  useEffect(() => { load(); }, []);

  const groups = useMemo(() => {
    const out: Record<string, Field[]> = {};
    for (const f of fields) (out[f.group] ??= []).push(f);
    return out;
  }, [fields]);

  const dirty = Object.keys(values).length > 0;

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Save failed.");
      setValues({});
      setSaved(true);
      await load();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function clearKey(key: string) {
    setValues((v) => ({ ...v, [key]: "" }));
  }

  async function testConnection(integration: string) {
    setTesting(integration);
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration }),
      });
      const data = await res.json();
      setTestResults((r) => ({ ...r, [integration]: data }));
    } catch {
      setTestResults((r) => ({ ...r, [integration]: { ok: false, message: "Test request failed." } }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Settings · Integrations</h1>
      <p className="sub">
        Add or rotate API credentials without touching the server. Values saved here override environment
        variables and are stored server-side in <span className="mono">data/settings.json</span> — they are never
        sent back to the browser.
      </p>

      {Object.entries(groups).map(([group, groupFields]) => (
        <div className="panel" style={{ marginBottom: 18 }} key={group}>
          <h2>{group}</h2>
          <p className="muted small" style={{ marginTop: -6 }}>{GROUP_BLURBS[group]}</p>
          {groupFields.map((f) => {
            const pendingClear = values[f.key] === "";
            return (
              <label className="field" key={f.key}>
                <span>
                  {f.label}{" "}
                  {pendingClear ? (
                    <em className="badge warn">will be removed on save</em>
                  ) : f.set ? (
                    <em className={`badge ${f.source === "settings" ? "good" : ""}`}>
                      {f.source === "settings" ? `saved here (${f.hint})` : `from env (${f.hint})`}
                    </em>
                  ) : (
                    <em className="badge">not set</em>
                  )}
                </span>
                <div className="row">
                  <input
                    className="grow"
                    style={{ width: "auto" }}
                    type={f.secret ? "password" : "text"}
                    placeholder={f.set ? "Enter a new value to replace" : "Enter value"}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    autoComplete="off"
                  />
                  {f.set && f.source === "settings" && !pendingClear && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => clearKey(f.key)}>
                      Remove
                    </button>
                  )}
                  {FIELD_TESTS[f.key] && f.set && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={testing !== null}
                      onClick={() => testConnection(FIELD_TESTS[f.key])}
                    >
                      {testing === FIELD_TESTS[f.key] ? (<><span className="spinner" />Testing…</>) : "Test"}
                    </button>
                  )}
                </div>
                {FIELD_TESTS[f.key] && testResults[FIELD_TESTS[f.key]] && (
                  <div className={testResults[FIELD_TESTS[f.key]].ok ? "small" : "small"} style={{ marginTop: 6 }}>
                    <span className={`badge ${testResults[FIELD_TESTS[f.key]].ok ? "good" : "bad"}`}>
                      {testResults[FIELD_TESTS[f.key]].ok ? "✓ connected" : "✗ failed"}
                    </span>{" "}
                    <span className="muted">{testResults[FIELD_TESTS[f.key]].message}</span>
                  </div>
                )}
              </label>
            );
          })}
        </div>
      ))}

      {error && <div className="error-box">{error}</div>}

      <div className="row">
        <button className="btn btn-primary" disabled={busy || !dirty} onClick={save}>
          {busy ? (<><span className="spinner" />Saving…</>) : "Save changes"}
        </button>
        {saved && <span className="badge good">Saved ✓ — takes effect immediately</span>}
      </div>

      <p className="muted small" style={{ marginTop: 24 }}>
        Note: this app has no user accounts — anyone who can reach it can use these integrations. Run it on a
        private network or behind your own auth proxy if others can access the host.
      </p>
    </div>
  );
}
