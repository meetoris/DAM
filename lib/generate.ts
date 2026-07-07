import { anthropicKey, demoMode, generateJSON, generateWithWebSearch } from "./ai";
import { mockBroll, mockFactCheck, mockScript } from "./mock";
import {
  BROLL_SCHEMA,
  FACTCHECK_SCHEMA,
  SCRIPT_SCHEMA,
  brollPrompt,
  factCheckPrompt,
  scriptSystemPrompt,
  scriptUserPrompt,
} from "./prompts";
import { findClip } from "./pexels";
import {
  BrollPlan,
  BrollScene,
  FactCheckClaim,
  FactCheckResult,
  Script,
  ScriptSection,
  Short,
} from "./types";

interface RawScript {
  title: string;
  hook: string;
  sections: ScriptSection[];
  cta: string;
  estimatedSeconds: number;
  wordCount: number;
  formula: string;
}

export async function writeScript(short: Short, feedback?: string): Promise<Script> {
  let raw: RawScript;
  if (demoMode(short.model)) {
    raw = mockScript(short, feedback);
  } else {
    raw = await generateJSON<RawScript>({
      model: short.model,
      system: scriptSystemPrompt(),
      prompt: scriptUserPrompt(short, feedback),
      schema: SCRIPT_SCHEMA as unknown as Record<string, unknown>,
      schemaName: "short_form_script",
    });
  }
  return {
    ...raw,
    model: short.model,
    generatedAt: new Date().toISOString(),
    revisionNote: feedback ? `Rewrite based on feedback: ${feedback}` : undefined,
  };
}

export function scriptToText(script: Script): string {
  return script.sections
    .map((s) => `[${s.startSec}s–${s.endSec}s | ${s.name}] ${s.text}`)
    .join("\n");
}

export function scriptSpokenText(script: Script): string {
  return script.sections.map((s) => s.text).join("\n\n");
}

export async function runFactCheck(short: Short): Promise<FactCheckResult> {
  const script = short.scripts[short.scripts.length - 1];
  if (!script) throw new Error("No script to fact-check yet.");
  const text = scriptToText(script);

  const system =
    "You are a rigorous fact-checker for a video creator. You would rather flag a borderline claim than let an error ship.";
  const jsonInstruction = `\n\nRespond with ONLY a JSON object matching this schema (no prose before or after):\n${JSON.stringify(FACTCHECK_SCHEMA)}`;

  let result: { overall: "pass" | "needs_review"; claims: FactCheckClaim[] };
  let usedWebSearch = false;
  if (anthropicKey()) {
    // best path: verify claims against live web results
    result = await generateWithWebSearch({
      system,
      prompt: factCheckPrompt(text, short.source.content) + jsonInstruction,
    });
    usedWebSearch = true;
  } else if (!demoMode(short.model)) {
    result = await generateJSON({
      model: short.model,
      system,
      prompt: factCheckPrompt(text, short.source.content),
      schema: FACTCHECK_SCHEMA as unknown as Record<string, unknown>,
      schemaName: "fact_check",
    });
  } else {
    result = mockFactCheck(text);
  }
  return {
    checkedAt: new Date().toISOString(),
    model: short.model,
    usedWebSearch,
    overall: result.overall,
    claims: result.claims,
  };
}

export async function planBroll(short: Short): Promise<BrollPlan> {
  const script = short.scripts[short.scripts.length - 1];
  if (!script) throw new Error("No script to plan B-roll for yet.");

  let raw: { scenes: Omit<BrollScene, "clip">[] };
  if (demoMode(short.model)) {
    raw = mockBroll(short);
  } else {
    raw = await generateJSON({
      model: short.model,
      system: "You are a short-form video editor planning cutaway B-roll.",
      prompt: brollPrompt(short, scriptToText(script)),
      schema: BROLL_SCHEMA as unknown as Record<string, unknown>,
      schemaName: "broll_plan",
    });
  }

  const scenes: BrollScene[] = await Promise.all(
    raw.scenes.map(async (scene) => ({ ...scene, clip: await findClip(scene.searchQuery) }))
  );
  return { generatedAt: new Date().toISOString(), scenes };
}
