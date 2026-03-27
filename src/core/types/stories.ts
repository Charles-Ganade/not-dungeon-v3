import type { ModelParams, PromptSettings } from "./settings";
import type { ScriptBundle } from "./sessions";

/**
 * The subset of global settings that a scenario or story
 * is allowed to override. Never contains endpoint / apiKey /
 * model — those are global-only.
 *
 * Resolution order (last write wins):
 *   GlobalSettings → Scenario.override → Story.override
 */
export interface ConfigOverride {
  /** Replaces the global default system prompt when set. */
  prompts: Partial<PromptSettings>
}

/**
 * A single reasoning block emitted by a model that supports
 * extended thinking (e.g. Claude with thinking enabled).
 * Displayed in the thinking panel, collapsible, linked to the
 * message that produced it.
 */
export interface ThinkingBlock {
  id: string;
  /** ID of the HistoryMessage this thinking block belongs to. */
  messageId: string;
  content: string;
}

/**
 * A single "turn" in the story history as stored internally.
 *
 * IMPORTANT — this does NOT map 1-to-1 with messages sent to
 * the API. By default the context builder composes the entire
 * history (or its summarised memories) into a single user
 * message, and the model simply continues. The role field here
 * is for internal bookkeeping only.
 *
 *   role "user"      — player input or injected system text
 *   role "assistant" — model output
 *   role "system"    — injected by a hook (never sent as-is)
 */
export type MessageRole = "user" | "assistant" | "system";

export interface HistoryMessage {
  id: string;
  role: MessageRole;
  /** The final rendered text after all output hooks have run. */
  text: string;
  thinkingBlocks: ThinkingBlock[];
  /**
   * Unix timestamp (ms). Also used to sort messages and to
   * anchor memories to a point in time.
   */
  createdAt: number;
  /**
   * Set when the message was edited after initial generation.
   * Used to show an "edited" indicator in the UI.
   */
  editedAt?: number;
}

/**
 * A memory is a model-generated summary of a contiguous range
 * of history messages. When building the context for a new
 * request, the context builder substitutes the summarised
 * messages with their memory to stay within the context window.
 *
 * Memories are shown in the memories panel and are editable.
 */
export interface Memory {
  id: string;
  /** Human-readable summary text. Editable by the user. */
  content: string;
  /** ID of the first HistoryMessage this memory covers. */
  fromMessageId: string;
  /** ID of the last HistoryMessage this memory covers (inclusive). */
  toMessageId: string;
  createdAt: number;
  /** Set if the user manually edited the memory content. */
  editedAt?: number;
}

/**
 * A story card is a reusable piece of world information
 * (characters, locations, lore, rules) that is injected into
 * the context when any of its trigger keywords appear in the
 * recent history.
 *
 * Cards are defined on a scenario and can be added/edited/
 * removed per-adventure. All such mutations are tracked as
 * deltas so they can be undone.
 */
export interface StoryCard {
  id: string;
  title: string;
  /** The text injected into context when this card is triggered. */
  content: string;
  /**
   * Case-insensitive keywords. If any appear in the recent
   * context window the card is included in the next request.
   * An empty array means the card is always included.
   */
  triggers: string[];
  /**
   * Free-form tag for grouping cards in the UI.
   * e.g. "character", "location", "lore", "rule"
   */
  tag: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * A Story is a single playthrough of a scenario.
 * It carries its own description, author notes, story card
 * overrides, script overrides, and the full session state.
 */
export interface Story {
  id: string;
  /** The scenario this story was started from. */
  scenarioId?: string;

  name: string;
  thumbnail?: string;

  /**
   * Story-specific description (separate from the scenario's).
   * Shown in the story editing modal.
   */
  description: string;

  /**
   * Story-specific author's notes. Merged with (or replaces,
   * depending on user preference) the scenario's author notes.
   */
  authorNotes: string;

  messages: HistoryMessage[];
  memories: Memory[];
  storyCards: StoryCard[];

  /**
   * Story-level scripts. Each hook function here overrides
   * the corresponding function from the scenario's ScriptBundle.
   * An empty string means "use the scenario's version".
   * The library file is concatenated: scenario.library runs
   * first, then story.library.
   */
  scripts: Partial<ScriptBundle>;

  override: ConfigOverride;

  /**
   * Key-value store available to scripts via ctx.memory.
   * Persisted with the story. Scripts can read and write
   * arbitrary data here.
   */
  memory: Record<string, unknown>;

  createdAt: number;
  updatedAt: number;
  lastPlayedAt: number;
}

/**
 * The fully resolved configuration for a single AI request.
 * Computed by store/config.ts by merging:
 *   GlobalSettings → Scenario.override → Story.override
 *
 * This is what the engine and API client actually use.
 * Never stored — always derived.
 */
export interface ResolvedConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  authorNotes: string;
  params: ModelParams;
  prompts: PromptSettings;
}