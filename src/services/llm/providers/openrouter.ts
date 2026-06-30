import { register } from "../registry";
import { LLMError } from "../errors";
import { LLMErrorCode } from "../types";
import type { LLMProvider, LLMChunk } from "../types";
import { createThinkingTagSplitter, streamErrorToChunk } from "../streaming";
import { OpenRouter } from "@openrouter/sdk";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const getOpenRouter = (endpoint: string, apiKey: string) =>
  new OpenRouter({
    apiKey,
    serverURL: endpoint ? endpoint.replace(/\/$/, "") : OPENROUTER_BASE,
  });

const openrouter: LLMProvider = {
  id: "openrouter",
  label: "OpenRouter",
  baseURL: OPENROUTER_BASE,

  async getModels(endpoint: string, apiKey: string): Promise<string[]> {
    try {
      const res = await getOpenRouter(endpoint, apiKey).models.list({
        httpReferer: window.location.hostname,
        appTitle: "Not Dungeon",
        outputModalities: "text",
      });
      return res.data.map((model) => model.id).sort();
    } catch (err) {
      throw new LLMError(LLMErrorCode.NetworkError, (err as Error).message);
    }
  },

  async *stream(request, endpoint, apiKey, signal): AsyncIterable<LLMChunk> {
    try {
      const stream = await getOpenRouter(endpoint, apiKey).chat.send(
        {
          chatRequest: {
            model: request.model,
            messages: request.messages,
            temperature: request.params.temperature,
            topP: request.params.topP,
            maxTokens: request.params.maxOutputTokens,
            frequencyPenalty: request.params.frequencyPenalty,
            presencePenalty: request.params.presencePenalty,
            stop:
              request.params.stop.length > 0 ? request.params.stop : undefined,
            stream: true,
            ...(request.params.thinkingEnabled
              ? { reasoning: { effort: "high" } }
              : {}),
          },
        },
        { signal },
      );

      const splitThinking = createThinkingTagSplitter();

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        const reasoningDelta: string | undefined =
          delta.reasoning ??
          delta.reasoningDetails
            ?.map((d) =>
              d.type === "reasoning.text"
                ? d.text
                : d.type === "reasoning.summary"
                  ? d.summary
                  : "",
            )
            .join("");
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

register(openrouter);
