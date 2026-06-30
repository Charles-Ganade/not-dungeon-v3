import { register } from "../registry";
import { LLMError } from "../errors";
import { LLMErrorCode } from "../types";
import type { LLMProvider, LLMChunk } from "../types";
import { createThinkingTagSplitter, streamErrorToChunk } from "../streaming";
import { Mistral } from "@mistralai/mistralai";

const MISTRAL_BASE = "https://api.mistral.ai/";

const getMistral = (endpoint: string, apiKey: string) =>
  new Mistral({
    apiKey,
    serverURL: endpoint ? endpoint.replace(/\/$/, "") : MISTRAL_BASE,
  });

const mistral: LLMProvider = {
  id: "mistral",
  label: "Mistral AI",
  baseURL: MISTRAL_BASE,

  async getModels(endpoint: string, apiKey: string): Promise<string[]> {
    try {
      const res = await getMistral(endpoint, apiKey).models.list();
      return (
        res.data
          ?.map((model) =>
            model.type === "base"
              ? model.id
              : model.type === "fine-tuned"
                ? model.id
                : null,
          )
          .filter((model) => typeof model === "string")
          .sort() || []
      );
    } catch (err) {
      throw new LLMError(LLMErrorCode.NetworkError, (err as Error).message);
    }
  },

  async *stream(request, endpoint, apiKey, signal): AsyncIterable<LLMChunk> {
    try {
      const stream = await getMistral(endpoint, apiKey).chat.stream(
        {
          model: request.model,
          messages: request.messages,
          temperature: request.params.temperature,
          topP: request.params.topP,
          maxTokens: request.params.maxOutputTokens,
          frequencyPenalty: request.params.frequencyPenalty,
          presencePenalty: request.params.presencePenalty,
          stop:
            request.params.stop.length > 0 ? request.params.stop : undefined,
          ...(request.params.thinkingEnabled
            ? {
                reasoningEffort: "high",
              }
            : {}),
        },
        { signal },
      );

      const splitThinking = createThinkingTagSplitter();

      for await (const chunk of stream) {
        const delta = chunk.data.choices?.[0]?.delta;
        if (!delta) continue;

        const reasoningDelta: string | undefined =
          delta.content && typeof delta.content !== "string"
            ? delta.content.filter((c) => c.type === "thinking").join("")
            : undefined;
        if (typeof reasoningDelta === "string" && reasoningDelta) {
          yield { type: "thinking", delta: reasoningDelta };
        }

        if (typeof delta.content === "string" && delta.content) {
          yield* splitThinking(delta.content);
        }
      }
    } catch (err) {
      yield streamErrorToChunk(err);
    }
  },
};

register(mistral);
