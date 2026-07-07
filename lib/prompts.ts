import { Short } from "./types";

export const SCRIPT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short, punchy working title for the video" },
    hook: { type: "string", description: "The opening line, verbatim — must stop the scroll in the first 2 seconds" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Section name, e.g. Hook, Context, Value, Payoff, CTA" },
          startSec: { type: "integer" },
          endSec: { type: "integer" },
          text: { type: "string", description: "Exactly what the creator says on camera in this section" },
          direction: { type: "string", description: "Delivery/energy note for the creator" },
        },
        required: ["name", "startSec", "endSec", "text", "direction"],
        additionalProperties: false,
      },
    },
    cta: { type: "string", description: "The closing call to action, verbatim" },
    estimatedSeconds: { type: "integer" },
    wordCount: { type: "integer" },
    formula: {
      type: "string",
      description: "2-4 sentence explanation of the persuasion/retention formula used and why it fits this content",
    },
  },
  required: ["title", "hook", "sections", "cta", "estimatedSeconds", "wordCount", "formula"],
  additionalProperties: false,
} as const;

export const FACTCHECK_SCHEMA = {
  type: "object",
  properties: {
    overall: { type: "string", enum: ["pass", "needs_review"] },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          verdict: { type: "string", enum: ["accurate", "questionable", "inaccurate", "unverifiable"] },
          explanation: { type: "string" },
          suggestion: { type: "string", description: "Corrected phrasing, if the claim needs fixing. Empty string if not needed." },
        },
        required: ["claim", "verdict", "explanation", "suggestion"],
        additionalProperties: false,
      },
    },
  },
  required: ["overall", "claims"],
  additionalProperties: false,
} as const;

export const BROLL_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startSec: { type: "integer" },
          endSec: { type: "integer" },
          description: { type: "string", description: "What the viewer sees in the B-roll clip" },
          searchQuery: { type: "string", description: "2-5 word stock footage search query" },
          placementNote: { type: "string", description: "Why this visual belongs at this moment of the script" },
        },
        required: ["startSec", "endSec", "description", "searchQuery", "placementNote"],
        additionalProperties: false,
      },
    },
  },
  required: ["scenes"],
  additionalProperties: false,
} as const;

const WPS = 2.4; // spoken words per second, brisk short-form pace

export function scriptSystemPrompt(): string {
  return `You are a short-form video scriptwriter for Instagram Reels and YouTube Shorts. You write scripts that real creators read on camera — natural spoken language, no hashtags, no emoji, no stage directions inside the spoken text. You are ruthless about the first two seconds: the hook must create an open loop or a bold claim. You keep one idea per video, use concrete numbers and examples from the source material, and end with a single clear call to action. Retention beats completeness: cut anything a viewer would swipe away from.`;
}

export function scriptUserPrompt(short: Short, feedback?: string): string {
  const targetWords = Math.round(short.targetSeconds * WPS);
  const prev = short.scripts[short.scripts.length - 1];
  const parts: string[] = [];

  parts.push(`Write a ${short.targetSeconds}-second short-form video script (about ${targetWords} words of spoken text).`);
  if (short.angle.trim()) parts.push(`Angle the creator wants: ${short.angle.trim()}`);
  parts.push(`Source material:\n"""\n${short.source.content.slice(0, 24000)}\n"""`);
  if (short.insightsUsed) {
    parts.push(`Audience performance insights from this creator's past videos — lean into what works:\n${short.insightsUsed}`);
  }
  if (feedback && prev) {
    parts.push(
      `The creator reviewed the previous version and wants changes. Previous script:\n${flattenScript(prev.sections.map((s) => s.text))}\n\nCreator feedback: ${feedback}\n\nRewrite the script applying this feedback while keeping what worked.`
    );
  }
  parts.push(
    `Timing rules: sections must tile the video from 0 to ~${short.targetSeconds} seconds with no gaps. The Hook section covers roughly seconds 0-3. Spoken text across all sections should total about ${targetWords} words.`
  );
  return parts.join("\n\n");
}

function flattenScript(texts: string[]): string {
  return texts.join("\n");
}

export function factCheckPrompt(scriptText: string, sourceContent: string): string {
  return `Fact-check this short-form video script. Extract every checkable factual claim (numbers, names, dates, causal statements, superlatives) and verify each one against the source material and your knowledge. Flag anything overstated, outdated, or unsupported — creators get destroyed in the comments for small inaccuracies.

Script:
"""
${scriptText}
"""

Source material the script was based on:
"""
${sourceContent.slice(0, 16000)}
"""

For each claim give a verdict (accurate / questionable / inaccurate / unverifiable), a one-sentence explanation, and — when the claim needs fixing — a corrected phrasing that keeps the script's energy. Overall is "pass" only if there are no inaccurate claims and at most minor questionable ones.`;
}

export function brollPrompt(short: Short, scriptText: string): string {
  return `Plan B-roll for this ${short.targetSeconds}-second talking-head short. The creator records themselves reading the script (A-roll); your job is to pick 4-8 moments where a cutaway clip should cover the A-roll, so the edit feels dynamic.

Script with timing:
"""
${scriptText}
"""

Rules: never cover the first 2 seconds (the hook is face-to-camera), each clip runs 2-6 seconds, clips must literally illustrate what is being said at that moment, and searchQuery must be a generic 2-5 word stock-footage query (e.g. "server room aisle", "person scrolling phone night") — no brand names or celebrities.`;
}

export function insightsSummaryPrompt(tableText: string): string {
  return `Here are this creator's recent Instagram Reels and YouTube Shorts with performance stats:

${tableText}

Write 4-6 concise, actionable takeaways about what is working (hook styles, topics, lengths, formats) and what to avoid, based only on this data. Each takeaway on its own line starting with "- ". These will be fed to a scriptwriting AI, so be concrete and directive.`;
}
