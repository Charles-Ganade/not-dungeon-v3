import { register } from "../registry";
import { responseToError } from "../errors";
import { LLMErrorCode } from "../types";
import type { LLMProvider, LLMChunk, LLMMessage } from "../types";

const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Anthropic separates the system prompt from the messages array.
 * Extract it here and pass the rest as the messages array.
 */
function splitMessages(messages: LLMMessage[]): {
  system: string | undefined;
  messages: LLMMessage[];
} {
  const systemMessages = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const system = systemMessages.length > 0
    ? systemMessages.map((m) => m.content).join("\n\n")
    : undefined;
  return { system, messages: rest };
}

const anthropic: LLMProvider = {
  id: "anthropic",
  label: "Anthropic (Claude)",

  async *stream(request, endpoint, apiKey, signal): AsyncIterable<LLMChunk> {
    const url = `${endpoint.replace(/\/$/, "")}/messages`;
    const { system, messages } = splitMessages(request.messages);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: request.model,
          messages,
          ...(system ? { system } : {}),
          max_tokens: request.params.maxOutputTokens,
          temperature: request.params.temperature,
          top_p: request.params.topP,
          stop_sequences: request.params.stop.length > 0 ? request.params.stop : undefined,
          stream: true,
          ...(request.params.thinkingEnabled
            ? { thinking: { type: "enabled", budget_tokens: Math.floor(request.params.maxOutputTokens * 0.8) } }
            : {}),
        }),
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        yield { type: "error", code: LLMErrorCode.Aborted, message: "Request aborted" };
        return;
      }
      yield { type: "error", code: LLMErrorCode.NetworkError, message: (err as Error).message };
      return;
    }

    if (!res.ok) {
      yield (await responseToError(res)).toChunk();
      return;
    }

    if (!res.body) {
      yield { type: "error", code: LLMErrorCode.ProviderError, message: "No response body" };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // Anthropic SSE uses named events — track the current event type
    let currentEvent = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.slice(6).trim();
            continue;
          }

          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();

          try {
            const json = JSON.parse(data);

            switch (currentEvent) {
              case "content_block_delta": {
                const delta = json.delta;
                if (delta?.type === "text_delta" && typeof delta.text === "string") {
                  yield { type: "text", delta: delta.text };
                } else if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
                  yield { type: "thinking", delta: delta.thinking };
                }
                break;
              }
              case "error": {
                const err = json.error;
                yield {
                  type: "error",
                  code: LLMErrorCode.ProviderError,
                  message: err?.message ?? "Anthropic stream error",
                };
                return;
              }
              // message_start, content_block_start, content_block_stop,
              // message_delta, message_stop — no action needed
            }
          } catch {
            // Malformed SSE line — skip silently
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        yield { type: "error", code: LLMErrorCode.Aborted, message: "Stream aborted" };
        return;
      }
      yield { type: "error", code: LLMErrorCode.NetworkError, message: (err as Error).message };
    } finally {
      reader.releaseLock();
    }
  },
};

register(anthropic);