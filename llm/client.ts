import Anthropic from "@anthropic-ai/sdk";

// Single Anthropic client for the whole app. All LLM calls are isolated behind
// this one module so prompts, caching, and model selection live in one place.
// Tests mock this module — never the SDK internals.

// Model selection lives in ./models.ts (task-class → model configuration).
// Do NOT set temperature/top_p/top_k or budget_tokens on any current model — they 400.

// Non-streaming default per the claude-api skill guidance — keeps requests
// under the SDK's HTTP timeout while leaving room for structured output.
export const LLM_MAX_TOKENS = 16_000;

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env (see .env.example).",
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
