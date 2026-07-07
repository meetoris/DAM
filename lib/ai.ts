import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { MODEL_OPTIONS, ModelId } from "./types";

export function providerFor(model: ModelId): "anthropic" | "openai" {
  return MODEL_OPTIONS.find((m) => m.id === model)?.provider ?? "anthropic";
}

export function hasKeyFor(model: ModelId): boolean {
  return providerFor(model) === "anthropic"
    ? Boolean(process.env.ANTHROPIC_API_KEY)
    : Boolean(process.env.OPENAI_API_KEY);
}

export function demoMode(model: ModelId): boolean {
  return !hasKeyFor(model);
}

interface GenerateArgs {
  model: ModelId;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
}

/**
 * Generate a JSON object matching `schema` from the chosen model.
 * Throws if the provider's API key is missing — callers decide whether to
 * fall back to the built-in demo generator.
 */
export async function generateJSON<T>(args: GenerateArgs): Promise<T> {
  const provider = providerFor(args.model);
  if (provider === "openai") return generateOpenAI<T>(args);
  return generateAnthropic<T>(args);
}

async function generateAnthropic<T>(args: GenerateArgs): Promise<T> {
  const client = new Anthropic();
  const maxTokens = args.maxTokens ?? 8192;

  const base = {
    max_tokens: maxTokens,
    system: args.system,
    messages: [{ role: "user" as const, content: args.prompt }],
    output_config: {
      format: { type: "json_schema" as const, schema: args.schema },
    },
  };

  let response: Anthropic.Message;
  if (args.model === "claude-fable-5") {
    // Fable 5: thinking is always on (omit the param). Opt into server-side
    // refusal fallbacks so a benign-but-flagged request is transparently
    // re-served by Opus 4.8 in the same call.
    response = (await client.beta.messages.create({
      model: "claude-fable-5",
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      ...base,
    })) as unknown as Anthropic.Message;
  } else {
    const thinking =
      args.model === "claude-haiku-4-5"
        ? undefined
        : ({ type: "adaptive" } as const);
    response = await client.messages.create({
      model: args.model,
      ...(thinking ? { thinking } : {}),
      ...base,
    });
  }

  if (response.stop_reason === "refusal") {
    throw new Error(
      "The model declined this request" +
        (response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : ".")
    );
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Model returned no text content.");
  return parseJSON<T>(text.text);
}

async function generateOpenAI<T>(args: GenerateArgs): Promise<T> {
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL || "gpt-5.5";
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: args.schemaName, schema: args.schema, strict: true },
    },
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Model returned no content.");
  return parseJSON<T>(content);
}

function parseJSON<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // salvage a JSON object embedded in prose or code fences
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as T;
    }
    throw new Error("Could not parse model output as JSON.");
  }
}
