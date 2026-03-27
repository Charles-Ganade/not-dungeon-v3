import { register } from "../registry";
import { responseToError } from "../errors";
import { LLMErrorCode } from "../types";
import type { LLMProvider, LLMChunk, LLMMessage } from "../types";

const ANTHROPIC_VERSION = "2023-06-01";

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

  async getModels(_endpoint: string, _apiKey: string): Promise<string[]> {
    return [
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
    ];
  },

  async *stream(request, endpoint, apiKey, signal): AsyncIterable<LLMChunk> {
    const url = `${endpoint.replace(/\/$/, "")}/messages`;
    const { system, messages } = splitMessages(request.messages);

   
    const payload: any = {
      model: request.model,
      messages,
      ...(system ? { system } : {}),
      stop_sequences: request.params.stop.length > 0 ? request.params.stop : undefined,
      stream: true,
    };

    if (request.params.thinkingEnabled) {
      const budgetTokens = Math.max(1024, Math.floor(request.params.maxOutputTokens * 0.8));
      const maxTokens = Math.max(request.params.maxOutputTokens, budgetTokens + 500);

      payload.max_tokens = maxTokens;
      payload.thinking = { type: "enabled", budget_tokens: budgetTokens };
    } else {
      payload.max_tokens = request.params.maxOutputTokens;
      payload.temperature = request.params.temperature;
      payload.top_p = request.params.topP;
    }

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
        body: JSON.stringify(payload),
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
                yield {
                  type: "error",
                  code: LLMErrorCode.ProviderError,
                  message: json.error?.message ?? "Anthropic stream error",
                };
                return;
              }
            }
          } catch {
           
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