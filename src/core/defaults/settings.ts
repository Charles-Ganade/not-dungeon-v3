import type { GlobalSettings } from "@/core/types/settings";

export const DEFAULT_SETTINGS: GlobalSettings = {
  UI: {
    theme: "system",
    uiScale: 1.0,
    fontSize: 16,
  },

  API: {
    providerId: "openai",
    endpoint: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o",
  },

  Parameters: {
    contextWindow: 128_000,
    maxOutputTokens: 200,
    temperature: 1.0,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stop: [],
    thinkingEnabled: false,
  },

  Prompts: {
    defaultSystemPrompt:
      "You are the narrator of an interactive text adventure. Continue the story " +
      "naturally, matching the established tone and world state. Write strictly in the " +
      "second person ('You'). DO NOT write dialogue or take actions on behalf of the player. " +
      "Describe the environment's reaction to the player's last action, then stop immediately " +
      "to let the player decide what happens next. Do not summarize or add meta-commentary.",

    storyCardGeneratorPrompt:
      "Generate a concise story card for the following concept. " +
      "The 'keys' array should contain 3-5 keywords that activate the card. " +
      "The type array should contain 3-5 words that categorize the card (eg. character, human, location, etc). " +
      "Output ONLY a raw, valid JSON object. Do not wrap it in markdown blocks. " +
      "Do not include any preamble or explanation. Use this exact shape: " +
      '{ "title": string, "value": string, "keys": string[], "type": string[] }',

    scenarioGeneratorPrompt:
      "Generate a scenario template for the following premise. Make the 'description' " +
      "engaging and atmospheric. Output ONLY a raw, valid JSON object. " +
      "Do not wrap it in markdown blocks. Do not include any preamble or explanation. " +
      "Use this exact shape: " +
      '{ "name": string, "description": string, "authorNotes": string, "tags": string[] }',

    memoryGeneratorPrompt:
      "Summarize the following story segment as a concise, third-person factual record. " +
      "Preserve specific names, locations, and permanent changes to the world state or inventory. " +
      "Omit conversational filler and verbatim dialogue. " +
      "Respond with only the summary text — no preamble, no commentary, no markdown.",
  }
};