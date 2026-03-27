import type { ModelParams } from "@/core/types/settings";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * The normalized request shape passed to every provider.
 * Assembled by the engine from the resolved config + context builder output.
 */
export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  params: ModelParams;
}

/**
 * Normalized output from a provider stream. The engine only ever
 * sees these three shapes regardless of which provider is active.
 *
 * "text"     — a delta of story/response text to append
 * "thinking" — a delta of reasoning text (shown in thinking panel)
 * "error"    — a terminal chunk; no further chunks will follow
 */
export type LLMChunk =
  | { type: "text"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "error"; code: LLMErrorCode; message: string };

/**
 * The strategy interface every provider implements.
 * `endpoint` and `apiKey` are passed in separately because
 * some providers need neither (e.g. a local server with no auth).
 */
export interface LLMProvider {
  readonly id: string;
  /** Human-readable name shown in the settings UI. */
  readonly label: string;
  stream(
    request: LLMRequest,
    endpoint: string,
    apiKey: string,
    signal: AbortSignal
  ): AsyncIterable<LLMChunk>;
}

/**
 * The simplified stream exposed to user scripts via ctx.ai.
 * Always uses the active provider and resolved config.
 * Thinking is always disabled for script-initiated calls.
 *
 * The input is either a plain prompt string (sent as a single
 * user message) or a full messages array for more control.
 */
export type ScriptStream = (
  input: string | LLMMessage[]
) => AsyncIterable<LLMChunk>;

export enum LLMErrorCode {
  // Network / connectivity
  NetworkError = "NETWORK_ERROR",
  Timeout = "TIMEOUT",
  Aborted = "ABORTED",

  // Auth
  Unauthorized = "UNAUTHORIZED",
  Forbidden = "FORBIDDEN",

  // Rate limits / quotas
  RateLimited = "RATE_LIMITED",
  InsufficientQuota = "INSUFFICIENT_QUOTA",

  // Request problems
  InvalidRequest = "INVALID_REQUEST",
  ContextLengthExceeded = "CONTEXT_LENGTH_EXCEEDED",
  ModelNotFound = "MODEL_NOT_FOUND",

  // Provider-side
  ProviderError = "PROVIDER_ERROR",
  ProviderUnavailable = "PROVIDER_UNAVAILABLE",

  // Registry
  UnknownProvider = "UNKNOWN_PROVIDER",

  Unknown = "UNKNOWN",
}