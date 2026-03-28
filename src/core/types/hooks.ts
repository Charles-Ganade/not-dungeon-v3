import { HistoryMessage, Memory, ResolvedConfig, StoryCard } from "./stories";

/**
 * Fields available to every hook function.
 */
interface BaseHookContext {
  /**
   * Read-only snapshot of the adventure's persistent memory bag.
   * Mutate via ctx.memory.set() / ctx.memory.get() below.
   */
  readonly state: {
    readonly messages: readonly HistoryMessage[];
    readonly memories: readonly Memory[];
    readonly storyCards: readonly StoryCard[];
  };

  /** Persistent key-value store scoped to this adventure. */
  memory: {
    get<T = unknown>(key: string): T | undefined;
    set<T = unknown>(key: string, value: T): void;
    delete(key: string): void;
    all(): Record<string, unknown>;
  };

  /**
   * Resolved configuration for the current request.
   * Read-only — changing model params mid-turn is not supported.
   */
  readonly config: Readonly<ResolvedConfig>;

  /**
   * Logging function. Output is piped to the in-UI debug panel,
   * not the browser console.
   */
  log(...args: unknown[]): void;

  /**
   * Halts the current turn immediately. No further hooks run,
   * no API call is made (if called before), and no message is
   * appended. The pending delta transaction is discarded.
   */
  stop(reason?: string): void;
}

/**
 * Context passed to the function defined in input.js.
 *
 * Called after the player submits text but before the context
 * is built or the API is called. Use this to sanitise, augment,
 * or redirect input.
 */
export interface InputHookContext extends BaseHookContext {
  /** The raw text the player submitted. Mutate to change what gets used. */
  input: string;

  /**
   * Injects a system-role message directly into the next
   * request's messages array (bypasses the normal composition).
   * Useful for injecting one-shot instructions.
   */
  inject(text: string): void;
}

/**
 * A single entry in the messages array as seen by buildContext.
 * Matches the OpenAI chat completion message shape.
 */
export interface ContextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Context passed to the function defined in buildContext.js.
 *
 * Called after the engine has assembled the default messages
 * array (history composition, memory substitution, story card
 * injection, author notes) but before it is sent to the API.
 *
 * The default builder composes the full history into one user
 * message. Scripts can replace this with any structure they want,
 * including true alternating-role conversations.
 */
export interface BuildContextHookContext extends BaseHookContext {
  /**
   * The messages array that will be sent to the API.
   * Fully mutable — reorder, add, remove, or replace entries.
   */
  messages: ContextMessage[];

  /**
   * Estimated token count of the current messages array.
   * Recalculated by the engine after this hook returns.
   * Available here as a read-only hint for budget decisions.
   */
  readonly estimatedTokens: number;

  /**
   * Active story cards (those whose triggers matched the recent
   * context). Available for inspection; already injected into
   * messages by the default builder.
   */
  readonly activeStoryCards: readonly StoryCard[];
}

/**
 * Context passed to the function defined in output.js.
 *
 * Called after the API responds and the raw text has been
 * extracted from the stream, but before the message is appended
 * to the history or committed to the delta transaction.
 *
 * Mutations here ARE tracked as deltas (the committed message
 * contains the post-hook text, and the delta records the
 * difference).
 */
export interface OutputHookContext extends BaseHookContext {
  /**
   * The model's response text. Mutate to change what gets
   * appended to the story history.
   */
  output: string;

  /**
   * The raw text before any hook modifications.
   * Read-only — useful for diffing against ctx.output.
   */
  readonly rawOutput: string;

  /**
   * Convenience: append a story card to the adventure.
   * Tracked as a storyCard:add delta inside the current
   * transaction, so it undoes together with the AI response.
   */
  addStoryCard(card: Omit<StoryCard, "id" | "createdAt" | "updatedAt">): void;
}

export type OnInputFn = (ctx: InputHookContext) => void | Promise<void>;
export type BuildContextFn = (ctx: BuildContextHookContext) => void | Promise<void>;
export type OnOutputFn = (ctx: OutputHookContext) => void | Promise<void>;

/**
 * The three hook functions the sandbox extracts after evaluating
 * all four script files. The engine calls these in order each turn.
 */
export interface ResolvedHooks {
  onInput: OnInputFn;
  buildContext: BuildContextFn;
  onOutput: OnOutputFn;
}