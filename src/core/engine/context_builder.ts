import type { HistoryMessage, Memory, StoryCard } from "@/core/types/stories";
import type { ResolvedConfig } from "@/core/types/stories";
import type { LLMMessage } from "@/services/llm/types";

export interface ContextBuilderInput {
  /** Ordered root → leaf messages on the active branch. */
  activePath: HistoryMessage[];
  /** Memories whose messageIds are all within the active path. */
  activeMemories: Memory[];
  storyCards: StoryCard[];
  instructions: string;  
  essentials: string;    
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

   
    const memory = memoryByFirstId.get(message.id);
    if (memory) {
      parts.push(`[Summary: ${memory.content}]`);
      for (const id of memory.messageIds) skipped.add(id);
      continue;
    }

   
    if (memorizedIds.has(message.id)) continue;

    if (message.role === "user") {
      parts.push(`> ${message.text}`);
    } else if (message.role === "assistant") {
      parts.push(message.text);
    }
   
  }

  return parts.join("\n\n");
}

export function buildDefaultContext(
  input: ContextBuilderInput
): ContextBuilderOutput {
  const { activePath, activeMemories, storyCards, config, instructions, essentials } = input;

  const activeStoryCards = resolveActiveStoryCards(storyCards, activePath);

  const systemParts: string[] = [config.prompts.defaultSystemPrompt];

  if (instructions.trim()) {
    systemParts.push(`[Instructions]\n${instructions}`);
  }
 
  if (essentials.trim()) {
    systemParts.push(`[World State & Essentials]\n${essentials}`);
  }

  if (activeMemories.length > 0) {
    const memoryContent = activeMemories.map((m) => m.content).join("\n\n");
    systemParts.push(`[Active Memories]\n${memoryContent}`);
  }

  if (activeStoryCards.length > 0) {
    const cardBlock = activeStoryCards
      .map((c) => `[${c.title}]\n[${c.tags.join(",")}]\n${c.content}`)
      .join("\n\n");
    systemParts.push(`[Relevant Story Cards]\n${cardBlock}`);
  }

  systemParts.push(`[Formatting Rules]\nCRITICAL: You are the narrator. You must describe the world and the consequences of the player's actions. Write in the second person ("You"). DO NOT write dialogue or actions for the player. Stop generating immediately after describing the environment's reaction.`);

  const memorizedIds = new Set(activeMemories.flatMap((m) => m.messageIds));
  const unsummarized = activePath.filter((m) => !memorizedIds.has(m.id) && m.role !== "system");

  const historyMessages: LLMMessage[] = unsummarized.map((m) => {
    let text = m.text;
    
    if (m.role === "user") {
      text = text.replace(/^>\s*/, "");
    }
    
    return { role: m.role as "user" | "assistant", content: text };
  });

  const kickerParts: string[] = [];
  if (config.authorNotes.trim()) {
    kickerParts.push(`[System Note: ${config.authorNotes}]`);
  }
  kickerParts.push(`[System Note: Remember, you are the narrator. Describe the outcome of the player's action above, but DO NOT take any actions for them.]`);
  
  const kickerText = kickerParts.join("\n");

  if (historyMessages.length > 0) {
    const lastMsg = historyMessages[historyMessages.length - 1];
    
    if (lastMsg.role === "user") {
      lastMsg.content += `\n\n---\n${kickerText}`;
    } else {
      historyMessages.push({ role: "user", content: kickerText });
    }
  } else {
    historyMessages.push({ role: "user", content: `(The story begins.)\n\n---\n${kickerText}` });
  }

  const messages: LLMMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
    ...historyMessages,
  ];

  const estimatedTokens = messages.reduce(
    (acc, m) => acc + estimateTokens(m.content),
    0
  );

  return { messages, estimatedTokens, activeStoryCards };
}