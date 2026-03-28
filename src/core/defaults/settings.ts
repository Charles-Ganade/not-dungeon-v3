// core/defaults/settings.ts

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
    maxOutputTokens: 2_048,
    temperature: 1.0,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stop: [],
    thinkingEnabled: false,
  },

  Prompts: {
    defaultSystemPrompt:
      "You are a collaborative fiction engine. Continue the story naturally, " +
      "matching the established tone and style. Do not break character or " +
      "add meta-commentary. Do not summarize what happened — simply continue.",

    storyCardGeneratorPrompt:
      "Generate a concise story card for the following concept. " +
      "Respond only with a JSON object — no markdown, no explanation. Shape: " +
      '{ "title": string, "content": string, "triggers": string[], "tag": string }',

    scenarioGeneratorPrompt:
      "Generate a scenario template for the following premise. " +
      "Respond only with a JSON object — no markdown, no explanation. Shape: " +
      '{ "name": string, "description": string, "authorNotes": string, "tags": string[] }',

    memoryGeneratorPrompt:
      "Summarize the following story segment as a concise, third-person narrative summary. " +
      "Preserve names, key events, and outcomes. Omit dialogue verbatim. " +
      "Respond with only the summary text — no preamble, no explanation.",
  },
};