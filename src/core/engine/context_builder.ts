import type { HistoryMessage, Memory, StoryCard } from "@/core/types/stories";
import type { ResolvedConfig } from "@/core/types/stories";
import type { LLMMessage } from "@/services/llm/types";

export interface ContextBuilderInput {
  /** Ordered root → leaf messages on the active branch. */
  activePath: HistoryMessage[];
  /** Memories whose messageIds are all within the active path. */
  activeMemories: Memory[];
  storyCards: StoryCard[];
  instructions: string;   // ADD
  essentials: string;     // ADD
  config: ResolvedConfig;
}

export interface ContextBuilderOutput {
  messages: LLMMessage[];
  /** Rough token estimate (chars / 4). Used by the buildContext hook. */
  estimatedTokens: number;
  /** Story cards whose triggers matched the recent context. */
  activeStoryCards: StoryCard[];
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const TRIGGER_WINDOW = 10;

function resolveActiveStoryCards(
  storyCards: StoryCard[],
  activePath: HistoryMessage[]
): StoryCard[] {
  const enabled = storyCards.filter((c) => c.enabled);
  if (enabled.length === 0) return [];

  const recentText = activePath
    .slice(-TRIGGER_WINDOW)
    .map((m) => m.text)
    .join(" ")
    .toLowerCase();

  return enabled.filter(
    (card) =>
      card.triggers.length === 0 ||
      card.triggers.some((t) => recentText.includes(t.toLowerCase()))
  );
}

/**
 * Walks the active path and builds the story history string,
 * substituting memory summaries for the message segments they cover.
 *
 * Format:
 *   [Summary: ...] — for a summarised segment
 *   > {text}       — for a user/player message
 *   {text}         — for an assistant/story message
 * System-role messages are omitted (they were hook injections).
 */
function buildHistoryString(
  activePath: HistoryMessage[],
  activeMemories: Memory[]
): string {
  if (activePath.length === 0) return "";

  // Map: first messageId in each memory → the memory
  const memoryByFirstId = new Map<string, Memory>();
  for (const memory of activeMemories) {
    if (memory.messageIds.length > 0) {
      memoryByFirstId.set(memory.messageIds[0], memory);
    }
  }
  const memorizedIds = new Set(activeMemories.flatMap((m) => m.messageIds));

  const parts: string[] = [];
  const skipped = new Set<string>();

  for (const message of activePath) {
    if (skipped.has(message.id)) continue;

    // Leading edge of a memory segment → emit summary, skip the rest
    const memory = memoryByFirstId.get(message.id);
    if (memory) {
      parts.push(`[Summary: ${memory.content}]`);
      for (const id of memory.messageIds) skipped.add(id);
      continue;
    }

    // Stray memorized message (shouldn't occur with correct memory data)
    if (memorizedIds.has(message.id)) continue;

    if (message.role === "user") {
      parts.push(`> ${message.text}`);
    } else if (message.role === "assistant") {
      parts.push(message.text);
    }
    // role "system" — omitted
  }

  return parts.join("\n\n");
}

export function buildDefaultContext(
  input: ContextBuilderInput
): ContextBuilderOutput {
  const { activePath, activeMemories, storyCards, config, instructions, essentials } = input;

  const activeStoryCards = resolveActiveStoryCards(storyCards, activePath);

  // ── System message ──────────────────────────────────────────
  const systemParts: string[] = [config.prompts.defaultSystemPrompt];

  if (instructions.trim()) {
    systemParts.push(`Instructions:\n${instructions}`);
  }
 
  if (essentials.trim()) {
    systemParts.push(`Essentials:\n${essentials}`);
  }

  if (activeStoryCards.length > 0) {
    const cardBlock = activeStoryCards
      .map((c) => `[${c.title}]\n[${c.tags.join(",")}]\n${c.content}`)
      .join("\n\n");
    systemParts.push(`World information:\n${cardBlock}`);
  }

  if (config.authorNotes) {
    systemParts.push(`[Author's notes: ${config.authorNotes}]`);
  }

  const historyContent = buildHistoryString(activePath, activeMemories);

  const messages: LLMMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
    { role: "user", content: historyContent || "(The story begins.)" },
  ];

  const estimatedTokens = messages.reduce(
    (acc, m) => acc + estimateTokens(m.content),
    0
  );

  return { messages, estimatedTokens, activeStoryCards };
}