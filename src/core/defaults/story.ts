import type { Story, StoryCard } from "@/core/types/stories";
import type { Scenario } from "@/core/types/scenarios";
import { DEFAULT_SCRIPT_BUILD_CONTEXT, DEFAULT_SCRIPT_INPUT, DEFAULT_SCRIPT_LIBRARY, DEFAULT_SCRIPT_OUTPUT } from "./scripts";

export function makeDefaultStory(
  overrides: Pick<Story, "name"> & Partial<Story>
): Story {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    scenarioId: undefined,
    thumbnailId: undefined,
    description: "",
    openingPrompt: "",
    authorNotes: "",
    instructions: "",
    essentials: "",
    scriptState: "",
    kvMemory:{},
    messages: [],
    currentLeafId: null,
    memories: [],
    storyCards: [],
    scripts:  {},
    override: { prompts: {} },
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
    thumbnailId: "",
    description: "",
    openingPrompt: "",
    authorNotes: "",
    instructions: "",
    essentials: "",
    tags: [],
    storyCards: [],
    scripts: {
      library: DEFAULT_SCRIPT_LIBRARY,
      input: DEFAULT_SCRIPT_INPUT,
      buildContext: DEFAULT_SCRIPT_BUILD_CONTEXT,
      output: DEFAULT_SCRIPT_OUTPUT,
    },
    override: { prompts: {} },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeDefaultStoryCard(overrides: Pick<StoryCard, "title"> & Partial<StoryCard>):StoryCard {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    content: "",
    triggers: [],
    tags: [],
    enabled: false,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

export function makeStoryFromScenario(
  scenario: Scenario,
  overrides: Pick<Story, "name"> & Partial<Story>
): Story {
  return {
    ...makeDefaultStory(overrides),
    scenarioId: scenario.id,
    thumbnailId: scenario.thumbnailId,
    essentials: scenario.essentials,
    instructions: scenario.instructions,
    authorNotes: scenario.authorNotes,
    openingPrompt: scenario.openingPrompt,
    override: structuredClone(scenario.override),
    storyCards: structuredClone(scenario.storyCards),
    scripts: structuredClone(scenario.scripts)
  };
}