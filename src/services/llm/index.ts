import "./providers/openai";
import "./providers/anthropic";
import "./providers/ollama";

import { get, list } from "./registry";
import type { LLMRequest, LLMChunk, LLMMessage, ScriptStream } from "./types";
import { LLMErrorCode } from "./types";
import { LLMError } from "./errors";

export type { LLMRequest, LLMChunk, LLMMessage, ScriptStream };
export { LLMErrorCode };
export { list as listProviders };

/**
 * Fetches available models from the active provider.
 * Throws an LLMError on network failure or unexpected response.
 * The UI should wrap this in a try/catch and surface the error.
 */
export async function listModels(
  providerId: string,
  endpoint: string,
  apiKey: string,
): Promise<string[]> {
  let provider;
  try {
    provider = get(providerId);
  } catch (err) {
    throw new LLMError(LLMErrorCode.UnknownProvider, (err as Error).message);
  }
  return provider.getModels(endpoint, apiKey);
}

/**
 * Streams a response from the active provider.
 * The engine calls this after the context builder has assembled
 * the request. The AbortSignal is tied to the session's abort
 * controller so cancellation propagates correctly.
 */
export async function* stream(
  providerId: string,
  request: LLMRequest,
  endpoint: string,
  apiKey: string,
  signal: AbortSignal
): AsyncIterable<LLMChunk> {
  let provider;
  try {
    provider = get(providerId);
  } catch (err) {
    yield {
      type: "error",
      code: LLMErrorCode.UnknownProvider,
      message: (err as Error).message,
    };
    return;
  }

  yield* provider.stream(request, endpoint, apiKey, signal);
}

/**
 * Returns a pre-bound ScriptStream for use in the scripting sandbox.
 * Reuses the active provider and resolved config. Thinking is always
 * disabled — script-initiated calls are utility calls, not story generation.
 */
export function createScriptStream(
  providerId: string,
  endpoint: string,
  apiKey: string,
  model: string,
  baseRequest: Omit<LLMRequest, "messages">,
  signal: AbortSignal
): ScriptStream {
  return async function* (input: string | LLMMessage[]): AsyncIterable<LLMChunk> {
    const messages: LLMMessage[] = typeof input === "string"
      ? [{ role: "user", content: input }]
      : input;

    const request: LLMRequest = {
      ...baseRequest,
      model,
      messages,
      params: {
        ...baseRequest.params,
        thinkingEnabled: false,
      },
    };

    yield* stream(providerId, request, endpoint, apiKey, signal);
  };
}