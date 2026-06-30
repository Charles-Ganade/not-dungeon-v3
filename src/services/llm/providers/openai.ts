import { register } from "../registry";
import { LLMError } from "../errors";
import { LLMErrorCode } from "../types";
import type { LLMProvider, LLMChunk } from "../types";
import { streamErrorToChunk } from "../streaming";
import OpenAI from "openai";

const OPENAI_BASE = "https://api.openai.com/v1";

const getOpenAI = (endpoint: string, apiKey: string) =>
  new OpenAI({
    apiKey,
    baseURL: endpoint ? endpoint.replace(/\/$/, "") : OPENAI_BASE,
    dangerouslyAllowBrowser: true,
  });

const openai: LLMProvider = {
  id: "openai",
  label: "OpenAI / Compatible",
  baseURL: OPENAI_BASE,

  async getModels(endpoint: string, apiKey: string): Promise<string[]> {
    try {
      const openai = getOpenAI(endpoint, apiKey);
      const models = await openai.models.list();
      return models.data.map((m) => m.id).sort();
    } catch (err) {
      throw new LLMError(LLMErrorCode.NetworkError, (err as Error).message);
    }
  },

  async *stream(request, endpoint, apiKey, signal): AsyncIterable<LLMChunk> {
    try {
      const stream = await getOpenAI(endpoint, apiKey).responses.stream(
        {
          model: request.model,
          input: request.messages,
          temperature: request.params.temperature ?? undefined,
          top_p: request.params.topP ?? undefined,
          max_output_tokens: request.params.maxOutputTokens ?? undefined,
        },
        { signal },
      );

      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          yield { type: "text", delta: event.delta };
        }

        if (
          event.type === "response.reasoning_text.delta" ||
          event.type === "response.reasoning_summary_text.delta"
        ) {
          yield { type: "thinking", delta: event.delta };
        }
      }
    } catch (err) {
      yield streamErrorToChunk(err);
    }
  },
};

register(openai);
