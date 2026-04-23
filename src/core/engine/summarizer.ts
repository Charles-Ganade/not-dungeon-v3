import { sessionStore, configStore } from "@/store";
import { stream, LLMMessage } from "@/services/llm";
import type { Memory, HistoryMessage } from "@/core/types/stories";

export async function summarizeHistory(): Promise<Pick<
  Memory,
  "content" | "messageIds"
> | null> {
  const story = sessionStore.story;
  const config = configStore.config;

  if (!story || !config) return null;

  const activePath = sessionStore.activePath;
  const activeMemories = sessionStore.activeMemories;

  const summarizedIds = new Set(activeMemories.flatMap((m) => m.messageIds));

  const unsummarizedPath = activePath.filter((m) => !summarizedIds.has(m.id));
  const textChars = unsummarizedPath.reduce((acc, m) => acc + m.text.length, 0);
  const estimatedTokens = textChars / 4;

  const threshold = config.params.contextWindow * 0.8;

  if (estimatedTokens < threshold) return null;

  const preserveTokenBudget = config.params.contextWindow * 0.33;
  let preservedTokens = 0;
  let summarizableBoundary = 0;

  for (let i = activePath.length - 1; i >= 0; i--) {
    const msg = activePath[i];

    if (!summarizedIds.has(msg.id)) {
      preservedTokens += msg.text.length / 4;
    }

    if (preservedTokens > preserveTokenBudget) {
      summarizableBoundary = i + 1;
      break;
    }
  }

  const chunkToSummarize: HistoryMessage[] = [];

  for (let i = 0; i < summarizableBoundary; i++) {
    const msg = activePath[i];
    if (!summarizedIds.has(msg.id)) {
      chunkToSummarize.push(msg);
    } else if (chunkToSummarize.length > 0) {
      break;
    }
  }

  if (chunkToSummarize.length === 0) return null;

  const chatLog = chunkToSummarize
    .map((m) => `${m.role.toUpperCase()}:\n${m.text}`)
    .join("\n\n");

  const messages: LLMMessage[] = [
    { role: "system", content: config.prompts.memoryGeneratorPrompt },
    {
      role: "user",
      content: `Please summarize the following events concisely:\n\n${chatLog}`,
    },
  ];

  try {
    const signal = new AbortController().signal;
    let content = "";
    const streamIterable = stream(
      config.providerId,
      {
        model: config.model,
        messages,
        params: { ...config.params, thinkingEnabled: false },
      },
      config.endpoint,
      config.apiKey,
      signal,
    );

    for await (const llmChunk of streamIterable) {
      if (llmChunk.type === "text") {
        content += llmChunk.delta;
      } else if (llmChunk.type === "error") {
        throw new Error(llmChunk.message);
      }
    }

    if (!content.trim()) return null;

    return {
      content: content.trim(),
      messageIds: chunkToSummarize.map((m) => m.id),
    };
  } catch (e) {
    console.error("[Auto-Summarizer] Failed:", e);
    return null;
  }
}
