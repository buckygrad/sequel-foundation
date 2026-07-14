// Sequel LLM plumbing — the shared, domain-free layer under every AI feature.
// Prompts, schemas, and routes stay in each app; this is the client seam,
// model-selection configuration, typed error mapping, and the SSE streaming
// pattern that survives Netlify's synchronous-function timeout.
export { getClient, LLM_MAX_TOKENS } from "./client";
export {
  modelFor,
  withModelFallback,
  LLM_MODEL_PROSE,
  LLM_MODEL_PRESENTATION,
  LLM_FALLBACK_MODEL,
} from "./models";
export type { LlmTaskClass } from "./models";
export { llmErrorEvent } from "./http";
export { streamJob } from "./stream";
export type { LlmStreamEvent } from "./stream";
export { consumeLlmStream, LlmStreamError } from "./stream-client";
