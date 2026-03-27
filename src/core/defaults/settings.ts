import { GlobalSettings, ModelParams, PromptSettings, UISettings } from "../types";

export const DEFAULT_MODEL_PARAMS: ModelParams = {
  contextWindow: 128_000,
  maxOutputTokens: 2_048,
  temperature: 1.0,
  topP: 1.0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stop: [],
  thinkingEnabled: false,
};
 
export const DEFAULT_UI_SETTINGS: UISettings = {
  theme: "system",
  uiScale: 1.0,
  fontSize: 16,
};
 
export const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
  defaultSystemPrompt:
    "You are a collaborative fiction engine. Continue the story naturally, " +
    "matching the established tone and style. Do not break character or " +
    "add meta-commentary.",
  storyCardGeneratorPrompt:
    "Generate a concise story card entry for the following concept. " +
    "Return a JSON object with fields: title, content, triggers (string[]), tag.",
  scenarioGeneratorPrompt:
    "Generate a scenario template for the following premise. " +
    "Return a JSON object with fields: name, description, systemPromptSuggestion.",
  memoryGeneratorPrompt: "Summarize the emphasized segment of the story below."
};

export const DEFAULT_SETTINGS: GlobalSettings = {
  ui: DEFAULT_UI_SETTINGS,
  api: {
    endpoint: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o",
  },
  modelParams: DEFAULT_MODEL_PARAMS,
  prompts: DEFAULT_PROMPT_SETTINGS,
};