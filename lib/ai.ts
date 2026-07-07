import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { MODEL_OPTIONS, ModelId } from "./types";
import { cred } from "./settings";

export function providerFor(model: ModelId): "anthropic" | "openai" {
  return MODEL_OPTIONS.find((m) => m.id === model)?.provider ?? "anthropic";
}

export function anthropicKey(): string | undefined {
  return cred("anthropicApiKey");
}
export function openaiKey(): string | undefined {
  return cred("openaiApiKey");
}

export function hasKeyFor(model: ModelId): boolean {
  return providerFor(model) === "anthropic" ? Boolean(anthropicKey()) : Boolean(openaiKey());
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

function anthropicClient(): Anthropic {
  return new Anthropic({ apiKey: anthropicKey() });
}

async function generateAnthropic<T>(args: GenerateArgs): Promise<T> {
  const client = anthropicClient();
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

  throwOnRefusal(response);
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Model returned no text content.");
  return parseJSON<T>(text.text);
}

/**
 * Fact-checking grounded with live web search. Runs on Sonnet 5 (which
 * supports the current web_search tool) regardless of the script's writer,
 * and asks for JSON in the response text since server tools drive the turn.
 */
export async function generateWithWebSearch<T>(args: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<T> {
  const client = anthropicClient();
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: args.prompt }];

  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: args.maxTokens ?? 8192,
      thinking: { type: "adaptive" },
      system: args.system,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      messages,
    });
    throwOnRefusal(response);
    if (response.stop_reason === "pause_turn") {
      // server-side tool loop paused — resend to let it resume
      messages = [...messages, { role: "assistant", content: response.content }];
      continue;
    }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return parseJSON<T>(text);
  }
  throw new Error("Web search did not complete.");
}

function throwOnRefusal(response: Anthropic.Message): void {
  if (response.stop_reason === "refusal") {
    throw new Error(
      "The model declined this request" +
        (response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : ".")
    );
  }
}

async function generateOpenAI<T>(args: GenerateArgs): Promise<T> {
  const client = new OpenAI({ apiKey: openaiKey() });
  const model = cred("openaiModel") || "gpt-5.5";
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
