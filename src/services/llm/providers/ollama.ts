import { register } from "../registry";
import { LLMError, responseToError } from "../errors";
import { LLMErrorCode } from "../types";
import type { LLMProvider, LLMChunk } from "../types";
import { isValidUrl } from "@/utils";

const ollama: LLMProvider = {
  id: "ollama",
  label: "Ollama (local)",

  async getModels(endpoint: string, _apiKey: string): Promise<string[]> {
    const url = `${endpoint.replace(/\/$/, "")}/api/tags`;
    if (!isValidUrl(url)) {
      throw new LLMError(LLMErrorCode.ProviderUnavailable, "Invalid URL.")
    }
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new LLMError(LLMErrorCode.NetworkError, (err as Error).message);
    }
    if (!res.ok) throw await responseToError(res);
    const json = await res.json() as { models?: { name: string }[] };
    if (!Array.isArray(json.models)) {
      throw new LLMError(LLMErrorCode.ProviderError, "Unexpected response shape from /api/tags");
    }
    return json.models
      .map((m) => m.name)
      .filter(Boolean)
      .sort();
  },

  async *stream(request, endpoint, _apiKey, signal): AsyncIterable<LLMChunk> {
    const url = `${endpoint.replace(/\/$/, "")}/api/chat`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
          options: {
            temperature: request.params.temperature,
            top_p: request.params.topP,
            num_predict: request.params.maxOutputTokens,
            stop: request.params.stop.length > 0 ? request.params.stop : undefined,
            // Note: frequency_penalty and presence_penalty have no Ollama equivalent
          },
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
          if (!trimmed) continue;

          try {
            const json = JSON.parse(trimmed);

            if (json.error) {
              yield { type: "error", code: LLMErrorCode.ProviderError, message: json.error };
              return;
            }

            const delta = json.message?.content;
            if (typeof delta === "string" && delta) {
              yield { type: "text", delta };
            }

            // json.done === true signals end of stream
            if (json.done) return;
          } catch {
            // Malformed NDJSON line — skip silently
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

register(ollama);