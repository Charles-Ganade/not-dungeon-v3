import type { HistoryMessage, Memory, StoryCard } from "@/core/types/stories";
import type { ResolvedConfig } from "@/core/types/stories";
import type { ContextMessage } from "@/core/types/hooks";
import { countTokens } from "./tokenizer";

export interface ContextBuilderInput {
  /** Ordered root → leaf messages on the active branch. */
  activePath: HistoryMessage[];
  /** Memories whose messageIds are all within the active path. */
  activeMemories: Memory[];
  storyCards: StoryCard[];
  instructions: string;
  essentials: string;
  config: ResolvedConfig;
  /**
   * System-role messages produced by an input hook's `ctx.inject(...)`.
   * Inserted directly after the default system message and counted in
   * the token budget. Defaults to none.
   */
  injectedMessages?: ContextMessage[];
}

export interface ContextBuilderOutput {
  messages: ContextMessage[];
  /** Token count (model tokenizer). Used by the buildContext hook. */
  estimatedTokens: number;
  /** Story cards whose triggers matched the recent context. */
  activeStoryCards: StoryCard[];
  hasOverflow: boolean;
  truncatedMessageCount: number;
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
    const msgTokens = countTokens(message.text);

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
  messages: ContextMessage[],
  targetTokens: number,
): { truncated: ContextMessage[]; removedCount: number } {
  if (messages.length <= 1) return { truncated: messages, removedCount: 0 };

  // Preserve the leading run of system messages — the default system prompt
  // plus any hook-injected system messages. These are high-priority header
  // context and must never be dropped to make room for history.
  let headerEnd = 0;
  while (headerEnd < messages.length && messages[headerEnd].role === "system") {
    headerEnd++;
  }
  if (headerEnd === 0) headerEnd = 1;

  const header = messages.slice(0, headerEnd);
  const historyMsgs = messages.slice(headerEnd);

  let currentTokens = header.reduce(
    (sum, msg) => sum + countTokens(msg.text),
    0,
  );
  let removedCount = 0;

  const keptHistory: ContextMessage[] = [];

  for (let i = historyMsgs.length - 1; i >= 0; i--) {
    const msg = historyMsgs[i];
    const msgTokens = countTokens(msg.text);

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
    truncated: [...header, ...keptHistory],
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

/** Sums the token counts of every message's text (uses the cached tokenizer). */
function sumTokens(messages: ContextMessage[]): number {
  return messages.reduce((sum, msg) => sum + countTokens(msg.text), 0);
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
      estimatedTokens: countTokens(baseReminder),
    };
  }

  const parts: string[] = [];
  if (config.authorNotes.trim()) {
    parts.push(`[System Note: ${config.authorNotes}]`);
  }
  parts.push(baseReminder);

  const fullText = parts.join("\n");
  const tokens = countTokens(fullText);

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
  const injectedMessages = input.injectedMessages ?? [];

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

  const historyMessages: ContextMessage[] = unsummarized.map((m) => {
    let text = m.text;

    if (m.role === "user") {
      text = text.replace(/^>\s*/, "");
    }

    return { id: m.id, role: m.role as "user" | "assistant", text };
  });

  const systemMsg = systemParts.join("\n\n");
  // Count the system prompt + injected messages once and reuse it across the
  // pre-/post-kicker and truncation estimates. The system prompt concatenates
  // instructions, essentials, memories, and story cards, so it's the largest
  // single string here — counting it more than once is the main waste.
  const headerTokens = countTokens(systemMsg) + sumTokens(injectedMessages);
  const currentEstimate = headerTokens + sumTokens(historyMessages);

  const availableForKicker =
    config.params.contextWindow - currentEstimate - 1000;
  const { text: kickerText } = formatKickerText(config, availableForKicker);

  if (historyMessages.length > 0) {
    const lastMsg = historyMessages[historyMessages.length - 1];

    if (lastMsg.role === "user") {
      lastMsg.text += `\n\n---\n${kickerText}`;
    } else {
      historyMessages.push({ id: null, role: "user", text: kickerText });
    }
  } else {
    historyMessages.push({
      id: null,
      role: "user",
      text: `(The story begins.)\n\n---\n${kickerText}`,
    });
  }

  let messages: ContextMessage[] = [
    { id: null, role: "system", text: systemMsg },
    ...injectedMessages,
    ...historyMessages,
  ];

  // Only the history changed (the kicker mutated its last message); the header
  // count is unchanged, so reuse it rather than re-counting the system prompt.
  let estimatedTokens = headerTokens + sumTokens(historyMessages);

  const fitResult = validateContextFit(
    estimatedTokens,
    config.params.contextWindow,
  );

  let truncatedMessageCount = 0;

  if (!fitResult.fits) {
    const targetTokens = config.params.contextWindow - 1000;
    const { truncated, removedCount } = truncateToFit(messages, targetTokens);
    messages = truncated;
    truncatedMessageCount = removedCount;

    estimatedTokens = sumTokens(messages);
  }

  return {
    messages,
    estimatedTokens,
    activeStoryCards,
    hasOverflow: !fitResult.fits,
    truncatedMessageCount,
  };
}
