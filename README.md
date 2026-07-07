# Social Video Factory

A dashboard that turns source material into a produced short-form video (Instagram Reels / YouTube Shorts) — end to end:

1. **New Short** — feed it an article URL, pasted text, or an uploaded file, add notes on your angle, pick a target length (30/45/60/90s) and the AI model you want writing (Claude Fable 5, Opus 4.8, Sonnet 5, Haiku 4.5, or GPT-5.5).
2. **Script** — a full, timed, section-by-section script (Hook → Context → Value → Payoff → CTA) with delivery directions, plus the **formula** it used and why.
3. **Iterate** — give feedback and rewrite, one-click auto-optimize, or regenerate with a different model. Full revision history is kept.
4. **Fact-check** — every checkable claim gets a verdict (accurate / questionable / inaccurate / unverifiable), an explanation, and a corrected phrasing so you don't ship an error.
5. **Teleprompter** — full-screen prompter with adjustable speed, font size, mirror mode (for beamsplitter rigs), and keyboard controls for recording your A-roll.
6. **B-roll** — a timed cutaway plan (what to show, when, and why), with a matching stock clip auto-fetched from Pexels for every scene, and a one-click **download all** zip.
7. **Performance feedback loop** — the Insights page analyzes your recent Instagram Reels and YouTube Shorts (real APIs, or bundled sample data), derives takeaways about what's working, and injects them into every future script so the writer keeps improving from your real numbers.
8. **Export** — download the script as `.md` or `.doc`, or copy the spoken text.

## Quick start

```bash
npm install
cp .env.example .env   # add keys (optional — see below)
npm run dev            # http://localhost:3000
```

**The app runs with zero configuration** in demo mode: script/fact-check/B-roll generation falls back to deterministic placeholders and the insights loop uses bundled sample data, so every feature can be exercised end to end. Add keys to unlock the real thing:

| Key | Unlocks |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude Fable 5 / Opus 4.8 / Sonnet 5 / Haiku 4.5 script writing, fact-checking, B-roll planning, AI insight takeaways |
| `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`) | The GPT writer option |
| `PEXELS_API_KEY` | Real downloadable stock clips matched to each B-roll scene (free key at pexels.com/api) |
| `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_USER_ID` | Real Reels stats in the feedback loop |
| `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID` | Real Shorts stats in the feedback loop |

Notes on the Anthropic integration: Fable 5 runs with server-side refusal fallbacks to Opus 4.8 enabled (beta `server-side-fallback-2026-06-01`), structured outputs (`output_config.format`) guarantee valid JSON from every generation, and adaptive thinking is used on the models that support it.

## Stack

Next.js 15 (App Router) · TypeScript · `@anthropic-ai/sdk` · `openai` · JSON-file storage in `data/` (no database to set up) · zero CSS frameworks.

## Layout

```
app/                 pages + API routes
  api/shorts         create/list/get/delete, generate (rewrite), factcheck, broll (+zip download)
  api/insights       the performance feedback loop
  shorts/[id]        the workspace: script / formula / fact-check / B-roll / teleprompter / export
components/          Teleprompter
lib/                 types, JSON store, AI provider layer (Anthropic/OpenAI/demo), prompts,
                     Pexels matching, URL article extraction, performance analysis
data/samples/        sample IG/YT stats used when no channel credentials are configured
```
