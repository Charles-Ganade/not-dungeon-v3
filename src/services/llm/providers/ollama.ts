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
      throw new LLMError(LLMErrorCode.ProviderUnavailable, "Invalid URL.");
    }
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "ngrok-skip-browser-warning": "true",
        }
      });
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
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
          options: {
            temperature: request.params.temperature,
            top_p: request.params.topP,
            num_predict: request.params.maxOutputTokens,
            stop: request.params.stop.length > 0 ? request.params.stop : undefined,
          },
          think: request.params.thinkingEnabled
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
    
    let isThinkingTagMode = false;

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

            const contentDelta = json.message?.content;
            const thinkingDelta = json.message?.thinking;
            if (typeof thinkingDelta === "string" && thinkingDelta) {
              thinkingDelta;
              yield { type: "thinking", delta: thinkingDelta };
            }
            if (typeof contentDelta === "string" && contentDelta) {
              let remaining = contentDelta;
              
              while (remaining) {
                if (isThinkingTagMode) {
                  const endIndex = remaining.indexOf("</think>");
                  if (endIndex !== -1) {
                    const chunk = remaining.slice(0, endIndex);
                    if (chunk) yield { type: "thinking", delta: chunk };
                    isThinkingTagMode = false;
                    remaining = remaining.slice(endIndex + 8);
                  } else {
                    yield { type: "thinking", delta: remaining };
                    remaining = "";
                  }
                } else {
                  const startIndex = remaining.indexOf("<think>");
                  if (startIndex !== -1) {
                    const chunk = remaining.slice(0, startIndex);
                    if (chunk) yield { type: "text", delta: chunk };
                    isThinkingTagMode = true;
                    remaining = remaining.slice(startIndex + 7);
                  } else {
                    yield { type: "text", delta: remaining };
                    remaining = "";
                  }
                }
              }
            }

            if (json.done) return;
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

register(ollama);