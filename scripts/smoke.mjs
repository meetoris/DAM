/**
 * End-to-end API smoke test. Requires a completed `npm run build`.
 * Starts the production server on PORT (default 3100), exercises every flow
 * in demo mode, and exits non-zero on the first failure.
 */
import { spawn } from "node:child_process";

const PORT = process.env.SMOKE_PORT || "3100";
const BASE = `http://localhost:${PORT}`;
let failures = 0;

function check(name, cond, detail = "") {
  const ok = Boolean(cond);
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// spawn the next binary directly under node (no npx wrapper) so kill() reaches
// the real server process instead of orphaning it
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", PORT], {
  stdio: "pipe",
});
server.stdout.on("data", () => {});
server.stderr.on("data", (d) => process.env.SMOKE_VERBOSE && console.error(String(d)));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server did not start in time.");
}

try {
  await waitForServer();
  check("homepage renders", true);

  // create a short from raw text (demo mode)
  const createRes = await fetch(`${BASE}/api/shorts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceType: "text",
      text: "Smoke test source. Short-form video drives most social watch time. Viewers decide in two seconds. Consistent posting compounds growth over months.",
      angle: "smoke test angle",
      targetSeconds: 30,
      model: "claude-fable-5",
    }),
  });
  const short = await createRes.json();
  check("create short", createRes.status === 201 && short.scripts?.length === 1, JSON.stringify(short).slice(0, 200));
  const id = short.id;

  // rewrite with feedback
  const rewriteRes = await fetch(`${BASE}/api/shorts/${id}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback: "punchier" }),
  });
  const rewritten = await rewriteRes.json();
  check("rewrite with feedback", rewriteRes.ok && rewritten.scripts?.length === 2);

  // manual edit
  const texts = rewritten.scripts.at(-1).sections.map((s, i) => (i === 0 ? "Edited hook line." : s.text));
  const patchRes = await fetch(`${BASE}/api/shorts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sectionTexts: texts }),
  });
  const patched = await patchRes.json();
  check("manual edit", patchRes.ok && patched.scripts.at(-1).sections[0].text === "Edited hook line.");

  // fact-check
  const fcRes = await fetch(`${BASE}/api/shorts/${id}/factcheck`, { method: "POST" });
  const fc = await fcRes.json();
  check("fact-check", fcRes.ok && Array.isArray(fc.factCheck?.claims) && fc.factCheck.claims.length > 0);

  // b-roll plan
  const brRes = await fetch(`${BASE}/api/shorts/${id}/broll`, { method: "POST" });
  const br = await brRes.json();
  check("b-roll plan", brRes.ok && br.broll?.scenes?.length >= 3);

  // b-roll zip
  const zipRes = await fetch(`${BASE}/api/shorts/${id}/broll/download`);
  const zipBytes = new Uint8Array(await zipRes.arrayBuffer());
  check("b-roll zip", zipRes.ok && zipBytes[0] === 0x50 && zipBytes[1] === 0x4b, "not a zip");

  // share page
  const shareRes = await fetch(`${BASE}/share/${id}`);
  check("share page", shareRes.ok && (await shareRes.text()).includes("shared script"));

  // insights
  const insRes = await fetch(`${BASE}/api/insights`);
  const ins = await insRes.json();
  check("insights", insRes.ok && ins.videos?.length > 0 && ins.takeaways?.length > 0);

  // settings round-trip (never echoes secrets)
  const setRes = await fetch(`${BASE}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pexelsApiKey: "smoke-test-key-1234" }),
  });
  const getRes = await fetch(`${BASE}/api/settings`);
  const settings = await getRes.json();
  const pexelsField = settings.fields?.find((f) => f.key === "pexelsApiKey");
  check(
    "settings save + masked read",
    setRes.ok && pexelsField?.set && pexelsField?.source === "settings" &&
      pexelsField?.hint === "…1234" && !JSON.stringify(settings).includes("smoke-test-key-1234")
  );
  await fetch(`${BASE}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pexelsApiKey: "" }),
  });
  const cleared = await (await fetch(`${BASE}/api/settings`)).json();
  check("settings clear", cleared.fields?.find((f) => f.key === "pexelsApiKey")?.source !== "settings");

  // connection test endpoint reports missing creds cleanly (no throw, no 500)
  const testRes = await fetch(`${BASE}/api/settings/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ integration: "pexels" }),
  });
  const testData = await testRes.json();
  check("connection test endpoint", testRes.ok && typeof testData.ok === "boolean" && typeof testData.message === "string");

  // github trending endpoint: either live results or a clean JSON error
  // (unauthenticated GitHub API may be rate-limited or blocked in some CIs)
  const ghRes = await fetch(`${BASE}/api/github/trending?window=trending`);
  const gh = await ghRes.json();
  check(
    "github trending endpoint",
    (ghRes.ok && Array.isArray(gh.repos) && gh.repos.length > 0 && gh.repos[0].stars >= gh.repos.at(-1).stars) ||
      (!ghRes.ok && typeof gh.error === "string"),
    JSON.stringify(gh).slice(0, 120)
  );

  // pages render
  for (const path of ["/new", "/insights", "/settings", `/shorts/${id}`]) {
    const res = await fetch(`${BASE}${path}`);
    check(`page ${path}`, res.ok);
  }

  // cleanup
  await fetch(`${BASE}/api/shorts/${id}`, { method: "DELETE" });
} catch (err) {
  console.error("✗ smoke test crashed:", err);
  failures++;
} finally {
  server.kill("SIGTERM");
}

console.log(failures === 0 ? "\nAll smoke tests passed." : `\n${failures} smoke test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
