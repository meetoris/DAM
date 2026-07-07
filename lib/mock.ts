import { BrollScene, FactCheckClaim, Short } from "./types";

/**
 * Deterministic demo generators used when no API key is configured for the
 * chosen model. They produce structurally-correct output from the source
 * material so every feature of the app can be exercised end to end.
 */

const WPS = 2.4;

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 220);
}

export function mockScript(short: Short, feedback?: string) {
  const src = sentences(short.source.content);
  const topicSource = short.angle.trim() || short.source.content.trim();
  const topic = topicSource.split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:!?"']+$/, "") || "this";
  const title = (src[0] ?? topicSource).split(/\s+/).slice(0, 9).join(" ").replace(/[.,;:!?"']+$/, "");
  const t = short.targetSeconds;
  const pick = (i: number, fallback: string) => src[i % Math.max(src.length, 1)] ?? fallback;

  const hook = feedback
    ? `Stop — everything you heard about ${topic} just changed.`
    : `Nobody is talking about this, but ${topic} is a bigger deal than you think.`;

  const mid1 = pick(0, `Here's the core idea, straight from the source.`);
  const mid2 = pick(1, `And here's the part most people miss.`);
  const mid3 = pick(2, `That's why this matters right now.`);

  const cta = "Follow for more breakdowns like this — and send this to someone who needs it.";

  const seg = (f: number) => Math.round(t * f);
  const sections = [
    { name: "Hook", startSec: 0, endSec: seg(0.12), text: hook, direction: "Punchy, direct to camera, no smile until the end of the line" },
    { name: "Context", startSec: seg(0.12), endSec: seg(0.4), text: mid1, direction: "Conversational, lean in slightly" },
    { name: "Value", startSec: seg(0.4), endSec: seg(0.75), text: mid2, direction: "Slow down on the key number or claim" },
    { name: "Payoff", startSec: seg(0.75), endSec: seg(0.92), text: mid3, direction: "Bring energy back up" },
    { name: "CTA", startSec: seg(0.92), endSec: t, text: cta, direction: "Warm, quick, point at the follow button" },
  ];
  const wordCount = sections.reduce((n, s) => n + s.text.split(/\s+/).length, 0);

  return {
    title: title.slice(0, 70) || `Short: ${topic}`.slice(0, 60),
    hook,
    sections,
    cta,
    estimatedSeconds: Math.min(t, Math.round(wordCount / WPS)),
    wordCount,
    formula: `Demo-mode script using the classic Hook → Context → Value → Payoff → CTA retention structure: an open-loop hook in the first 2 seconds, one core idea developed with material lifted from your source, and a single call to action. Add an API key in .env to have ${short.model} write the real thing.`,
  };
}

export function mockFactCheck(scriptText: string): { overall: "pass" | "needs_review"; claims: FactCheckClaim[] } {
  const lines = scriptText.split(/\n+/).filter((l) => l.trim().length > 20).slice(0, 4);
  const claims: FactCheckClaim[] = lines.map((l, i) => ({
    claim: l.trim().slice(0, 140),
    verdict: i === 0 ? "unverifiable" : "accurate",
    explanation:
      i === 0
        ? "Demo mode: no AI key configured, so claims are not actually verified. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env for a real fact-check."
        : "Demo mode placeholder — matches the source material as written.",
    suggestion: "",
  }));
  return { overall: "needs_review", claims };
}

export function mockBroll(short: Short): { scenes: Omit<BrollScene, "clip">[] } {
  const t = short.targetSeconds;
  const topics = (short.angle || short.title || "technology")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 2)
    .join(" ") || "technology";
  const seg = (f: number) => Math.round(t * f);
  return {
    scenes: [
      { startSec: seg(0.15), endSec: seg(0.25), description: "Close-up of hands typing on a laptop", searchQuery: "typing laptop closeup", placementNote: "Covers the transition out of the hook while context is set up" },
      { startSec: seg(0.35), endSec: seg(0.45), description: `Illustrative footage of ${topics}`, searchQuery: topics, placementNote: "Literal illustration of the core idea as it's introduced" },
      { startSec: seg(0.55), endSec: seg(0.65), description: "Person scrolling a phone, engaged", searchQuery: "person scrolling phone", placementNote: "Keeps pace through the value section" },
      { startSec: seg(0.78), endSec: seg(0.88), description: "City timelapse, energy building", searchQuery: "city timelapse night", placementNote: "Momentum into the payoff before returning to A-roll for the CTA" },
    ],
  };
}

export function mockInsightTakeaways(): string[] {
  return [
    "- Hooks phrased as a contrarian claim ('Nobody is talking about…') outperform question hooks by ~2x on views.",
    "- 30-45 second videos retain best; everything over 60s shows a retention cliff around the 40s mark.",
    "- AI-tooling and how-to topics drive the most shares; news-reaction content underperforms.",
    "- Videos that show the product/screen in the first 5 seconds hold attention better than pure talking-head.",
    "- CTAs asking viewers to 'send this to someone' generate more shares than 'follow for more'.",
  ];
}
