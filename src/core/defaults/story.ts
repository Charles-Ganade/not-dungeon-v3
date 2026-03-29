import type { Story } from "@/core/types/stories";
import type { Scenario } from "@/core/types/scenarios";

export function makeDefaultStory(
  overrides: Pick<Story, "name"> & Partial<Story>
): Story {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    scenarioId: undefined,
    thumbnail: undefined,
    description: "",
    authorNotes: "",
    instructions: "",
    essentials: "",
    scriptState: "",
    messages: [],
    currentLeafId: null,
    memories: [],
    storyCards: [],
    scripts: {},
    override: { prompts: {} },
    memory: {},
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: 0,
    ...overrides,
  };
}

export function makeDefaultScenario(
  overrides: Pick<Scenario, "name"> & Partial<Scenario>
): Scenario {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    thumbnail: "",
    description: "",
    authorNotes: "",
    instructions: "",
    essentials: "",
    tags: [],
    storyCards: [],
    scripts: {
      library: "",
      input: "",
      buildContext: "",
      output: "",
    },
    override: { prompts: {} },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}