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
    messages: [{ role: "user", content: buildUserMessage(inputJson) }],
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

  throw new Error(`Anthropic response did not contain a tool_use block for ${NARRATIVE_TOOL.name}`);
}

/* ------------------------------------------------------------------
 * Streaming variant
 *
 * The non-streaming call above returns the full structured tool_use
 * payload at once. For UX we want the review paragraph to appear as
 * it generates so the user sees motion within the first second.
 *
 * Anthropic streams tool_use input as `input_json_delta` events —
 * the JSON object is built incrementally one chunk at a time. We
 * accumulate those chunks and extract the `review_paragraph` field
 * out of the partial JSON as it grows, yielding only the NEW text
 * since the last yield. When the stream finishes, we yield the
 * fully-parsed structured payload so the caller can persist it and
 * re-render the rich view (strengths, watch items, etc.).
 * ------------------------------------------------------------------ */

export type AnthropicStreamEvent =
  | { type: "text_delta"; text: string }
  | {
      type: "done";
      narrative: Omit<NarrativeOutput, "generated_at" | "model" | "mode">;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
      };
    };

export async function* callAnthropicStream(
  inputJson: string,
): AsyncGenerator<AnthropicStreamEvent, void, unknown> {
  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 1024,
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
    messages: [{ role: "user", content: buildUserMessage(inputJson) }],
  });

  let accumulated = "";
  let lastEmitted = "";

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
      accumulated += event.delta.partial_json;
      const paragraph = extractPartialField(accumulated, "review_paragraph");
      if (paragraph !== null && paragraph.length > lastEmitted.length) {
        const newText = paragraph.slice(lastEmitted.length);
        lastEmitted = paragraph;
        yield { type: "text_delta", text: newText };
      }
    }
  }

  const final = await stream.finalMessage();
  for (const block of final.content) {
    if (block.type === "tool_use" && block.name === NARRATIVE_TOOL.name) {
      const payload = block.input as Omit<NarrativeOutput, "generated_at" | "model" | "mode">;
      // If the model produced more paragraph text after our last delta
      // emission (rare but possible), flush the tail before the done
      // event so the streaming view ends with the same text as the
      // persisted narrative.
      if (payload.review_paragraph && payload.review_paragraph.length > lastEmitted.length) {
        yield {
          type: "text_delta",
          text: payload.review_paragraph.slice(lastEmitted.length),
        };
      }
      yield {
        type: "done",
        narrative: payload,
        usage: {
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          cache_read_input_tokens: final.usage.cache_read_input_tokens ?? undefined,
        },
      };
      return;
    }
  }
  throw new Error(`Anthropic stream finished without a tool_use block for ${NARRATIVE_TOOL.name}`);
}

/**
 * Pull a string field out of partial JSON without crashing on incomplete
 * input. Used to extract `review_paragraph` from the in-flight tool_use
 * input as it streams in. Hand-rolled rather than pulling a streaming
 * JSON parser because (a) we only need one field, (b) the input shape
 * is fixed, and (c) we never want to throw — partial input must always
 * yield "the longest valid prefix of that field's value or null".
 *
 * Behavior:
 *   - Returns null if the field key isn't in the buffer yet.
 *   - Returns the partial value string if the value is mid-stream.
 *   - Returns the full value string once the closing quote is seen.
 *   - Handles \n \t \" \\ \/ \uXXXX escapes; any incomplete escape at
 *     the buffer's tail is treated as not-yet-readable and stops the
 *     scan there.
 */
export function extractPartialField(json: string, field: string): string | null {
  const needle = `"${field}":"`;
  const fieldIdx = json.indexOf(needle);
  if (fieldIdx === -1) return null;
  let i = fieldIdx + needle.length;
  let result = "";
  while (i < json.length) {
    const c = json[i];
    if (c === "\\") {
      if (i + 1 >= json.length) return result; // incomplete escape — stop
      const next = json[i + 1];
      switch (next) {
        case "n":
          result += "\n";
          i += 2;
          break;
        case "t":
          result += "\t";
          i += 2;
          break;
        case "r":
          result += "\r";
          i += 2;
          break;
        case '"':
          result += '"';
          i += 2;
          break;
        case "\\":
          result += "\\";
          i += 2;
          break;
        case "/":
          result += "/";
          i += 2;
          break;
        case "u":
          if (i + 6 > json.length) return result; // incomplete \uXXXX
          result += String.fromCharCode(parseInt(json.slice(i + 2, i + 6), 16));
          i += 6;
          break;
        default:
          result += next;
          i += 2;
      }
    } else if (c === '"') {
      return result; // closed
    } else {
      result += c;
      i += 1;
    }
  }
  return result;
}
