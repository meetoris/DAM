# Social Video Factory

A dashboard that turns source material into a produced short-form video (Instagram Reels / YouTube Shorts) — end to end:

1. **New Short** — feed it an article URL, pasted text, or an uploaded file (**PDF, DOCX, or any text format**), add notes on your angle, pick a target length (30/45/60/90s) and the AI model you want writing (Claude Fable 5, Opus 4.8, Sonnet 5, Haiku 4.5, or GPT-5.5).
2. **Script** — a full, timed, section-by-section script (Hook → Context → Value → Payoff → CTA) with delivery directions, plus the **formula** it used and why.
3. **Iterate** — give feedback and rewrite, one-click auto-optimize, regenerate with a different model, generate **3 alternate hook options** and swap in the winner with one click, or **edit any line by hand**. Full revision history is kept.
4. **Fact-check** — every checkable claim gets a verdict (accurate / questionable / inaccurate / unverifiable), an explanation, and a corrected phrasing so you don't ship an error. With an Anthropic key configured, claims are **verified against live web search** (Sonnet 5 + the web_search server tool).
5. **Teleprompter** — full-screen prompter with adjustable speed, font size, mirror mode (for beamsplitter rigs), and keyboard controls for recording your A-roll.
6. **B-roll** — a timed cutaway plan (what to show, when, and why), with a matching stock clip auto-fetched from Pexels for every scene, and a one-click **download all** zip.
7. **Performance feedback loop** — the Insights page analyzes your recent Instagram Reels and YouTube Shorts (real APIs, or bundled sample data), derives takeaways about what's working, and injects them into every future script so the writer keeps improving from your real numbers.
8. **Export & share** — download the script as `.md`, `.doc`, or burn-in-ready **`.srt`/`.vtt` captions** (chunked into short caption-friendly cues, not whole sentences — ready to drop into CapCut/Premiere/Descript), copy the spoken text, or copy a read-only **share link** (`/share/<id>`) for collaborators.
9. **Settings → Integrations** — add or rotate every API credential from the UI; values are stored server-side (never echoed to the browser) and override environment variables, so no redeploy is needed.

## Quick start

```bash
npm install
cp .env.example .env   # add keys (optional — see below)
npm run dev            # http://localhost:3000
```

**The app runs with zero configuration** in demo mode: script/fact-check/B-roll generation falls back to deterministic placeholders and the insights loop uses bundled sample data, so every feature can be exercised end to end. Add keys in **Settings → Integrations** (or `.env`) to unlock the real thing:

| Key | Unlocks |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude Fable 5 / Opus 4.8 / Sonnet 5 / Haiku 4.5 script writing, fact-checking, B-roll planning, AI insight takeaways |
| `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`) | The GPT writer option |
| `PEXELS_API_KEY` | Real downloadable stock clips matched to each B-roll scene (free key at pexels.com/api) |
| `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_USER_ID` | Real Reels stats in the feedback loop |
| `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID` | Real Shorts stats in the feedback loop |

Notes on the Anthropic integration: Fable 5 runs with server-side refusal fallbacks to Opus 4.8 enabled (beta `server-side-fallback-2026-06-01`), structured outputs (`output_config.format`) guarantee valid JSON from every generation, and adaptive thinking is used on the models that support it.

Each integration has a **Test** button in Settings that makes a minimal live call (Anthropic `count_tokens`, OpenAI model list, Pexels search, IG/YT profile lookups) so you know a credential works the moment you save it.

## Deploy

```bash
docker build -t social-video-factory .
docker run -p 3000:3000 -v svf-data:/app/data social-video-factory
```

The `data/` volume persists shorts and integration settings across restarts. No database, no other services.

## Adopted patterns

Two capabilities are deliberately adapted from patterns common in well-known open-source auto-shorts/auto-subtitle generators (e.g. ShortGPT, MoneyPrinterTurbo, captacity/auto-subtitle) rather than invented from scratch — this app doesn't render or burn in video itself, so each pattern is adapted to fit a planning tool instead of a renderer:

- **Chunked caption export (`.srt`/`.vtt`)** — these tools burn in short 3-7 word caption chunks synced to speech rather than whole-sentence subtitles, because that's what reads well on a 9:16 screen. We don't burn video, so instead we export standard subtitle files pre-chunked the same way (`lib/captions.ts`), ready to drop into whatever editor you use.
- **Hook variant generation** — several of these tools generate multiple candidate hooks/titles and let you pick the strongest rather than committing to the first draft. The "🪝 3 hook options" button applies the same idea to just the opening line, so you can A/B it without regenerating the whole script.

## Testing

`npm run smoke` builds nothing — run `npm run build` first, then it boots the production server and exercises every flow (create → rewrite → manual edit → fact-check → B-roll → zip → share → insights → settings round-trip). CI (`.github/workflows/ci.yml`) runs build + smoke on every PR.

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
