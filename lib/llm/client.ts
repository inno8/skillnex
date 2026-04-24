/**
 * Anthropic client wrapper with prompt caching and tool_use enforcement.
 *
 * Model choice: claude-haiku-4-5. Fast, cheap, excellent at structured output.
 * Sonnet is overkill for templated narratives — prove value with Haiku first.
 *
 * Cost per narrative: ~500 in + 250 out tokens. With 90% prompt-cache hit
 * across a 110-employee run: ~$0.03 total. See PLAN.md §3.
 */

import Anthropic from "@anthropic-ai/sdk";

import { NARRATIVE_TOOL, SYSTEM_PROMPT, buildUserMessage } from "./prompts";
import { NARRATIVE_JSON_SCHEMA, type NarrativeOutput } from "./types";

export const MODEL = "claude-haiku-4-5";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

export function isLLMConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function useMock(): boolean {
  if (process.env.SKILLNEX_MOCK_LLM === "true") return true;
  if (!process.env.ANTHROPIC_API_KEY) return true;
  return false;
}

export async function callAnthropic(inputJson: string): Promise<{
  narrative: Omit<NarrativeOutput, "generated_at" | "model" | "mode">;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
}> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    // System prompt with cache_control — Anthropic caches it for 5 min across
    // all subsequent calls, reducing cost on a bulk-analyze run by ~90%.
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: NARRATIVE_TOOL.name,
        description: NARRATIVE_TOOL.description,
        input_schema: NARRATIVE_JSON_SCHEMA as never,
      },
    ],
    tool_choice: { type: "tool", name: NARRATIVE_TOOL.name },
    messages: [
      { role: "user", content: buildUserMessage(inputJson) },
    ],
  });

  // Find the tool_use block
  for (const block of msg.content) {
    if (block.type === "tool_use" && block.name === NARRATIVE_TOOL.name) {
      const payload = block.input as Omit<NarrativeOutput, "generated_at" | "model" | "mode">;
      return {
        narrative: payload,
        usage: {
          input_tokens: msg.usage.input_tokens,
          output_tokens: msg.usage.output_tokens,
          cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? undefined,
        },
      };
    }
  }

  throw new Error(
    `Anthropic response did not contain a tool_use block for ${NARRATIVE_TOOL.name}`,
  );
}
