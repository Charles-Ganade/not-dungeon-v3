import { sessionStore, configStore } from "@/store";
import { stream, LLMMessage } from "@/services/llm";
import type { Memory, HistoryMessage } from "@/core/types/stories";

const PRESERVE_COUNT = 10; // Number of recent messages to always exclude from summarization

export async function summarizeHistory(): Promise<Pick<Memory, "content" | "messageIds"> | null> {
  const story = sessionStore.story;
  const config = configStore.config;

  if (!story || !config) return null;

  const activePath = sessionStore.activePath;
  const activeMemories = sessionStore.activeMemories;

  // 1. Estimate tokens (using char/4 heuristic)
  const textChars = activePath.reduce((acc, m) => acc + m.text.length, 0);
  const estimatedTokens = textChars / 4;
  const threshold = config.params.contextWindow * 0.8;

  if (estimatedTokens < threshold) return null;

  // 2. Find oldest contiguous segment of unsummarized messages
  const summarizedIds = new Set(activeMemories.flatMap((m) => m.messageIds));
  const summarizableBoundary = Math.max(0, activePath.length - PRESERVE_COUNT);
  const chunkToSummarize: HistoryMessage[] = [];

  for (let i = 0; i < summarizableBoundary; i++) {
    const msg = activePath[i];
    if (!summarizedIds.has(msg.id)) {
      chunkToSummarize.push(msg);
    } else if (chunkToSummarize.length > 0) {
      // We hit a summarized message after finding some unsummarized ones.
      // We've found the oldest contiguous segment. Break to summarize just this chunk.
      break;
    }
  }

  if (chunkToSummarize.length === 0) return null;

  // 3. Format for the LLM
  const chatLog = chunkToSummarize
    .map((m) => `${m.role.toUpperCase()}:\n${m.text}`)
    .join("\n\n");

  const messages: LLMMessage[] = [
    { role: "system", content: config.prompts.memoryGeneratorPrompt },
    { role: "user", content: `Please summarize the following events concisely:\n\n${chatLog}` },
  ];

  try {
    const signal = new AbortSignal();
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
      signal
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
    // Return null so the main turn doesn't crash if the summarizer fails
    return null;
  }
}