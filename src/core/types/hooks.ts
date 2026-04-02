import type { HistoryMessage, Memory, ResolvedConfig, StoryCard } from "./stories";
import type { ScriptStream } from "@/services/llm/types";

/**
 * Fields available to all three script files (input.js, buildContext.js, output.js).
 * Scripts access these as top-level properties on the `ctx` object.
 */
interface BaseHookContext {
  /**
   * Read-only snapshot of the story state at the start of the turn.
   * Reflects messages, memories, and story cards as they were when
   * the turn began — not updated mid-turn.
   */
  readonly state: {
    readonly messages: readonly HistoryMessage[];
    readonly memories: readonly Memory[];
    readonly storyCards: readonly StoryCard[];
  };

  /**
   * The story's essentials field. Mutable — assign a new string to
   * update it. Changes are delta-tracked and visible to downstream
   * scripts in the same turn.
   */
  essentials: string;

  /**
   * A persistent string for script state. Never sent to the AI.
   * Useful for storing serialized JSON between turns. Mutable —
   * changes are delta-tracked.
   */
  scriptState: string;

  /**
   * Persistent key-value store scoped to this story.
   * Survives across turns. Not delta-tracked — changes are written
   * directly to story.memory and persisted with the story.
   */
  kvMemory: {
    get<T = unknown>(key: string): T | undefined;
    set<T = unknown>(key: string, value: T): void;
    delete(key: string): void;
    all(): Record<string, unknown>;
  };

  /**
   * The resolved configuration for this turn.
   * Read-only — model params cannot be changed mid-turn.
   */
  readonly config: Readonly<ResolvedConfig>;

  /**
   * Run a secondary AI call using the active provider and resolved
   * config. Thinking is always disabled for script-initiated calls.
   * Input can be a plain prompt string or a full messages array.
   */
  ai: { stream: ScriptStream };

  /**
   * Logger to the script debug panel in the UI.
   * Does not write to the browser console.
   */
  console: {
    log:   (...args: unknown[]) => void,
    warn:  (...args: unknown[]) => void,
    error: (...args: unknown[]) => void,
  }

  /**
   * Halts the current turn immediately. No further scripts run,
   * no API call is made (if not yet called), and no message is
   * appended to history. The pending transaction is discarded.
   */
  stop(reason?: string): void;
}

/**
 * Context available in input.js.
 * Runs after the player submits input, before the AI is called.
 */
export interface InputHookContext extends BaseHookContext {
  /** The player's submitted text. Mutate to change what gets sent. */
  input: string;

  /**
   * Injects a system-role message into the request's messages array.
   * The injected message bypasses the normal context composition and
   * is appended after the default system prompt.
   */
  inject(text: string): void;
}

/**
 * A single message entry in the array sent to the API.
 */
export interface ContextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Context available in buildContext.js.
 * Runs after the default messages array is assembled, before the
 * API call. The default builder composes the full history into a
 * single user message — scripts can freely restructure this.
 */
export interface BuildContextHookContext extends BaseHookContext {
  /**
   * The messages array that will be sent to the API.
   * Fully mutable — reorder, replace, add, or remove entries.
   */
  messages: ContextMessage[];

  /**
   * Rough token estimate for the current messages array (chars / 4).
   * Read-only hint for budget decisions. Recalculated by the engine
   * after this script finishes.
   */
  readonly estimatedTokens: number;

  /**
   * Story cards whose trigger keywords matched the recent context.
   * Already injected into messages by the default builder.
   * Read-only — to modify cards use ctx.state.storyCards.
   */
  readonly activeStoryCards: readonly StoryCard[];
}

/**
 * Context available in output.js.
 * Runs after the AI responds, before the message is saved to history.
 * Mutations to ctx.output are delta-tracked.
 */
export interface OutputHookContext extends BaseHookContext {
  /** The AI's response text. Mutate to change what gets saved. */
  output: string;

  /** The original unmodified AI response. Read-only. */
  readonly rawOutput: string;

  /**
   * Adds a story card to the story. The addition is enqueued as a
   * storyCard:add delta inside the current transaction, so it undoes
   * together with the AI response.
   */
  addStoryCard(card: Omit<StoryCard, "id" | "createdAt" | "updatedAt">): void;
}