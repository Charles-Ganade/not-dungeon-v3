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
  hasOverflow: boolean;
  truncatedMessageCount: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Validates if the current context fits within the model's context window.
 * Returns overflow info for logging and conditional truncation.
 */
export interface ContextFitResult {
  fits: boolean;
  overage: number;
  margin: number;
}

export function validateContextFit(
  estimatedTokens: number,
  contextWindow: number,
): ContextFitResult {
  const margin = contextWindow - estimatedTokens;
  const fits = margin >= 1000;
  const overage = Math.max(0, estimatedTokens - (contextWindow - 1000));

  return { fits, overage, margin };
}

/**
 * Dynamically resolves the trigger window by walking backwards from the most recent
 * message and accumulating tokens until the budget is exhausted.
 * Budget defaults to 10% of context window, minimum 5000 tokens.
 */
export function resolveTriggerWindow(
  activePath: HistoryMessage[],
  contextWindow: number,
): HistoryMessage[] {
  if (activePath.length === 0) return [];

  const tokenBudget = Math.max(Math.floor(contextWindow * 0.1), 5000);
  let accumulatedTokens = 0;
  const window: HistoryMessage[] = [];

  for (let i = activePath.length - 1; i >= 0; i--) {
    const message = activePath[i];
    const msgTokens = estimateTokens(message.text);

    if (accumulatedTokens + msgTokens > tokenBudget && window.length > 0) {
      break;
    }

    window.unshift(message);
    accumulatedTokens += msgTokens;
  }

  return window.length > 0 ? window : activePath.slice(-1);
}

/**
 * Truncates messages to fit within context limits, preserving system message
 * and recent turns while removing oldest non-critical history.
 *
 * Strategy:
 * 1. Always keep system message (index 0)
 * 2. Remove oldest user/assistant messages until fit
 * 3. Keep the most recent N messages for narrative continuity
 */
export function truncateToFit(
  messages: LLMMessage[],
  targetTokens: number,
): { truncated: LLMMessage[]; removedCount: number } {
  if (messages.length <= 1) return { truncated: messages, removedCount: 0 };

  const systemMsg = messages[0];
  const historyMsgs = messages.slice(1);
  let currentTokens = estimateTokens(systemMsg.content);
  let removedCount = 0;

  const keptHistory: LLMMessage[] = [];

  for (let i = historyMsgs.length - 1; i >= 0; i--) {
    const msg = historyMsgs[i];
    const msgTokens = estimateTokens(msg.content);

    if (
      i === historyMsgs.length - 1 ||
      currentTokens + msgTokens <= targetTokens
    ) {
      keptHistory.unshift(msg);
      currentTokens += msgTokens;
    } else {
      removedCount += i + 1;
      break;
    }
  }

  return {
    truncated: [systemMsg, ...keptHistory],
    removedCount,
  };
}

function resolveActiveStoryCards(
  storyCards: StoryCard[],
  triggerWindow: HistoryMessage[],
): StoryCard[] {
  const enabled = storyCards.filter((c) => c.enabled);
  if (enabled.length === 0) return [];

  const recentText = triggerWindow
    .map((m) => m.text)
    .join(" ")
    .toLowerCase();

  return enabled.filter(
    (card) =>
      card.triggers.length === 0 ||
      card.triggers.some((t) => recentText.includes(t.toLowerCase())),
  );
}

/**
 * Validates that all memories have message IDs that exist within
 * the active path and form contiguous segments. Filters out broken memories.
 */
export function validateActiveMemories(
  memories: Memory[],
  activePath: HistoryMessage[],
): Memory[] {
  if (memories.length === 0 || activePath.length === 0) return memories;

  const pathIds = new Set(activePath.map((m) => m.id));
  const pathIndex = new Map(activePath.map((m, i) => [m.id, i]));

  return memories.filter((memory) => {
    if (!memory.messageIds.every((id) => pathIds.has(id))) {
      return false;
    }

    if (memory.messageIds.length > 1) {
      const indices = memory.messageIds
        .map((id) => pathIndex.get(id))
        .filter((i): i is number => i !== undefined);

      const sorted = [...indices].sort((a, b) => a - b);
      const isContiguous = sorted.every(
        (idx, i) => i === 0 || idx === sorted[i - 1] + 1,
      );

      if (!isContiguous) {
        return false;
      }
    }

    return true;
  });
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
  activeMemories: Memory[],
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

/**
 * Formats kicker text adaptively based on available token space.
 * Returns the kicker text and its estimated token count.
 */
export function formatKickerText(
  config: ResolvedConfig,
  availableTokens: number,
): { text: string; estimatedTokens: number } {
  const baseReminder =
    "[System Note: You are the narrator. Describe the outcome of the player's action above, but DO NOT take any actions for them.]";

  if (availableTokens < 300) {
    return {
      text: baseReminder,
      estimatedTokens: estimateTokens(baseReminder),
    };
  }

  const parts: string[] = [];
  if (config.authorNotes.trim()) {
    parts.push(`[System Note: ${config.authorNotes}]`);
  }
  parts.push(baseReminder);

  const fullText = parts.join("\n");
  const tokens = estimateTokens(fullText);

  return { text: fullText, estimatedTokens: tokens };
}

export function buildDefaultContext(
  input: ContextBuilderInput,
): ContextBuilderOutput {
  const {
    activePath,
    activeMemories,
    storyCards,
    config,
    instructions,
    essentials,
  } = input;

  const validatedMemories = validateActiveMemories(activeMemories, activePath);
  const triggerWindow = resolveTriggerWindow(
    activePath,
    config.params.contextWindow,
  );
  const activeStoryCards = resolveActiveStoryCards(storyCards, triggerWindow);

  const systemParts: string[] = [config.prompts.defaultSystemPrompt];

  if (instructions.trim()) {
    systemParts.push(`[Instructions]\n${instructions}`);
  }

  if (essentials.trim()) {
    systemParts.push(`[World State & Essentials]\n${essentials}`);
  }

  if (validatedMemories.length > 0) {
    const memoryContent = validatedMemories.map((m) => m.content).join("\n\n");
    systemParts.push(`[Active Memories]\n${memoryContent}`);
  }

  if (activeStoryCards.length > 0) {
    const cardBlock = activeStoryCards
      .map((c) => `[${c.title}]\n[${c.tags.join(",")}]\n${c.content}`)
      .join("\n\n");
    systemParts.push(`[Relevant Story Cards]\n${cardBlock}`);
  }

  systemParts.push(
    `[Formatting Rules]\nCRITICAL: You are the narrator. You must describe the world and the consequences of the player's actions. Write in the second person ("You"). DO NOT write dialogue or actions for the player. Stop generating immediately after describing the environment's reaction.`,
  );

  const memorizedIds = new Set(validatedMemories.flatMap((m) => m.messageIds));
  const unsummarized = activePath.filter(
    (m) => !memorizedIds.has(m.id) && m.role !== "system",
  );

  const historyMessages: LLMMessage[] = unsummarized.map((m) => {
    let text = m.text;

    if (m.role === "user") {
      text = text.replace(/^>\s*/, "");
    }

    return { role: m.role as "user" | "assistant", content: text };
  });

  const systemMsg = systemParts.join("\n\n");
  let currentEstimate = estimateTokens(systemMsg);
  for (const msg of historyMessages) {
    currentEstimate += estimateTokens(msg.content);
  }

  const availableForKicker =
    config.params.contextWindow - currentEstimate - 1000;
  const { text: kickerText, estimatedTokens: kickerTokens } = formatKickerText(
    config,
    availableForKicker,
  );

  if (historyMessages.length > 0) {
    const lastMsg = historyMessages[historyMessages.length - 1];

    if (lastMsg.role === "user") {
      lastMsg.content += `\n\n---\n${kickerText}`;
    } else {
      historyMessages.push({ role: "user", content: kickerText });
    }
  } else {
    historyMessages.push({
      role: "user",
      content: `(The story begins.)\n\n---\n${kickerText}`,
    });
  }

  let messages: LLMMessage[] = [
    { role: "system", content: systemMsg },
    ...historyMessages,
  ];

  let estimatedTokens = estimateTokens(systemMsg);
  for (const msg of historyMessages) {
    estimatedTokens += estimateTokens(msg.content);
  }

  const fitResult = validateContextFit(
    estimatedTokens,
    config.params.contextWindow,
  );

  console.log(fitResult, estimatedTokens);

  let truncatedMessageCount = 0;

  if (!fitResult.fits) {
    const targetTokens = config.params.contextWindow - 1000;
    const { truncated, removedCount } = truncateToFit(messages, targetTokens);
    messages = truncated;
    truncatedMessageCount = removedCount;

    estimatedTokens = 0;
    for (const msg of messages) {
      estimatedTokens += estimateTokens(msg.content);
    }
  }

  return {
    messages,
    estimatedTokens,
    activeStoryCards,
    hasOverflow: !fitResult.fits,
    truncatedMessageCount,
  };
}
