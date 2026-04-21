import { register } from "../registry";
import { LLMError } from "../errors";
import { LLMErrorCode } from "../types";
import type { LLMProvider, LLMChunk } from "../types";
import { Ollama } from "ollama/browser";

const getOllama = (endpoint: string) =>
  new Ollama({
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
    ...(endpoint ? {
      host: endpoint.replace(/\/$/, "")
    } : {})
  });

const ollama: LLMProvider = {
  id: "ollama",
  label: "Ollama Proxy (local)",
  baseURL: "http://localhost:11434",

  async getModels(endpoint: string, _apiKey: string): Promise<string[]> {
    try {
      const { models } = await getOllama(endpoint).list();
      return models.map(m => m.name).sort();
    } catch (err) {
      throw new LLMError(LLMErrorCode.NetworkError, (err as Error).message);
    }
  },

  async *stream(request, endpoint, _apiKey, signal): AsyncIterable<LLMChunk> {
    try {
      const params = request.params;
      const stream = await getOllama(endpoint.replace(/\/$/, "")).chat({
        stream: true,
        model: request.model,
        messages: request.messages,
        options: {
          num_ctx: params.contextWindow,
          frequency_penalty: params.frequencyPenalty,
          num_predict: params.maxOutputTokens,
          presence_penalty: params.presencePenalty,
          stop: params.stop,
          temperature: params.temperature,
          top_p: params.topP
        },
        think: params.thinkingEnabled
      })

      let isThinkingTagMode = false;

      for await (const chunk of stream) {
        const thinkingDelta = chunk.message?.thinking;
        if (typeof thinkingDelta === "string" && thinkingDelta) {
          yield { type: "thinking", delta: thinkingDelta };
        }

        const contentDelta = chunk.message?.content;
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

        if (chunk.done) return;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        yield {
          type: "error",
          code: LLMErrorCode.Aborted,
          message: "Request aborted",
        };
        return;
      }
      yield {
        type: "error",
        code: LLMErrorCode.NetworkError,
        message: (err as Error).message,
      };
    }
  },
};

register(ollama);
