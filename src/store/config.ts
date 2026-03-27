import { createMemo } from "solid-js";
import { settingsStore } from "./settings";
import { sessionStore } from "./session";
import { libraryStore } from "./library";
import type { ResolvedConfig } from "@/core/types/stories";
import type { PromptSettings } from "@/core/types/settings";

const resolvedConfig = createMemo<ResolvedConfig | null>(() => {
  const story = sessionStore.story;
  const settings = settingsStore.settings;
  if (!story) return null;

  const scenario = story.scenarioId
    ? libraryStore.scenarios.find((s) => s.id === story.scenarioId)
    : undefined;

  const prompts: PromptSettings = {
    ...settings.Prompts,
    ...(scenario?.override.prompts ?? {}),
    ...(story.override.prompts ?? {}),
  };

  const authorNotes = [scenario?.authorNotes, story.authorNotes]
    .filter(Boolean)
    .join("\n\n");

  return {
    providerId: settings.API.providerId,
    endpoint: settings.API.endpoint,
    apiKey: settings.API.apiKey,
    model: settings.API.model,
    params: settings.Parameters,
    prompts,
    authorNotes,
  };
});

export const configStore = {
  get config() { return resolvedConfig(); },
};