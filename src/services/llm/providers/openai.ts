import { register } from "../registry";
import { responseToError } from "../errors";
import { LLMErrorCode } from "../types";
import type { LLMProvider, LLMChunk } from "../types";

const openai: LLMProvider = {
  id: "openai",
  label: "OpenAI / Compatible",

  async *stream(request, endpoint, apiKey, signal): AsyncIterable<LLMChunk> {
    const url = `${endpoint.replace(/\/$/, "")}/chat/completions`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.params.temperature,
          top_p: request.params.topP,
          max_tokens: request.params.maxOutputTokens,
          frequency_penalty: request.params.frequencyPenalty,
          presence_penalty: request.params.presencePenalty,
          stop: request.params.stop.length > 0 ? request.params.stop : undefined,
          stream: true,
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

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") return;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            if (!delta) continue;

            // Standard text content
            if (typeof delta.content === "string" && delta.content) {
              yield { type: "text", delta: delta.content };
            }

            // OpenAI reasoning_content (o-series models)
            if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
              yield { type: "thinking", delta: delta.reasoning_content };
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

register(openai);