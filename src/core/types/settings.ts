export type Theme = "system" | "light" | "dark";
 
export interface UISettings {
  theme: Theme;
  /** Multiplier applied to the entire UI. Default: 1.0 */
  uiScale: number;
  /** Base font size in px. Default: 16 */
  fontSize: number;
}
 
export interface APISettings {
  providerId: string;
  /** Base URL of any OpenAI-compatible endpoint. e.g. "https://api.openai.com/v1" */
  endpoint: string;
  apiKey: string;
  model: string;
}
 
export interface ModelParams {
  /**
   * Total context window the model supports (in tokens).
   * Used by the context builder to budget history vs. memories.
   */
  contextWindow: number;
 
  /** Hard cap on tokens the model may generate per response. */
  maxOutputTokens: number;
 
  /** Sampling temperature. Range: [0, 2]. Default: 1.0 */
  temperature: number;
 
  /** Nucleus sampling. Range: [0, 1]. Default: 1.0 */
  topP: number;
 
  /**
   * Penalises tokens proportional to how many times they've
   * already appeared. Range: [-2, 2]. Default: 0
   */
  frequencyPenalty: number;
 
  /**
   * Penalises tokens that have appeared at all so far.
   * Range: [-2, 2]. Default: 0
   */
  presencePenalty: number;
 
  /** Stop sequences. The model halts generation at any of these. */
  stop: string[];
 
  /**
   * Whether the model supports extended thinking / reasoning.
   * When true, thinking blocks in responses are captured and
   * displayed in the thinking panel.
   */
  thinkingEnabled: boolean;
}
 
export interface PromptSettings {
  /**
   * Injected at the top of every request as the system prompt.
   * Can be overridden per-scenario or per-adventure.
   */
  defaultSystemPrompt: string;
 
  /**
   * Prompt sent to the model when auto-generating a story card
   * from selected text or a user description.
   */
  storyCardGeneratorPrompt: string;

  /**
   * Prompt sent to the model when summarizing a set of
   * messages.
   */
  memoryGeneratorPrompt: string;
 
  /**
   * Prompt sent to the model when auto-generating a new
   * scenario from a user description.
   */
  scenarioGeneratorPrompt: string;
}
 
export interface GlobalSettings {
  UI: UISettings;
  API: APISettings;
  Parameters: ModelParams;
  Prompts: PromptSettings;
}