import { createStore, reconcile } from "solid-js/store";
import { createMemo } from "solid-js";
import {
  getAllScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  getAllStories,
  createStory,
  deleteStory,
} from "@/services/db";
import type { Scenario } from "@/core/types/scenarios";
import type { Story } from "@/core/types/stories";
import type { LibraryItem } from "@/core/types/scenarios";
import { updateStory } from "@/services/db/stories";

interface LibraryState {
  scenarios: Scenario[];
  stories: Story[];
  loading: boolean;
}

const [state, setState] = createStore<LibraryState>({
  scenarios: [],
  stories: [],
  loading: false,
});

/**
 * Flat list of all library items sorted by recency.
 * Scenarios sort by updatedAt; stories sort by lastPlayedAt.
 * Stories with no matching scenario still appear (scenario is undefined).
 */
const items = createMemo<LibraryItem[]>(() => {
  const scenarioMap = new Map(state.scenarios.map((s) => [s.id, s]));

  const storyItems: LibraryItem[] = state.stories.map((story) => ({
    kind: "story" as const,
    data: story,
    scenario: story.scenarioId ? scenarioMap.get(story.scenarioId) : undefined,
  }));

  const scenarioItems: LibraryItem[] = state.scenarios.map((scenario) => ({
    kind: "scenario" as const,
    data: scenario,
  }));

  return [...storyItems, ...scenarioItems].sort((a, b) => {
    const aTime = a.kind === "story" ? a.data.lastPlayedAt : a.data.updatedAt;
    const bTime = b.kind === "story" ? b.data.lastPlayedAt : b.data.updatedAt;
    return aTime - bTime;
  });
});

/**
 * Group the scenarios and stories in memory. All stories with
 * no scenarios are grouped under `undefined`
 */
const grouped = createMemo(() => {
  const scenarioMap = new Map(state.scenarios.map((s) => [s.id, s]));
  const groups = new Map<string | undefined, Story[]>();

  for (const story of state.stories) {
    const key = story.scenarioId;
    const bucket = groups.get(key) ?? [];
    bucket.push(story);
    groups.set(key, bucket);
  }

  return groups;
});

async function init(): Promise<void> {
  setState("loading", true);
  const [scenarios, stories] = await Promise.all([
    getAllScenarios(),
    getAllStories(),
  ]);
  setState(reconcile({ scenarios, stories, loading: false }));
}

async function addScenario(
  scenario: Scenario,
  thumbnail?: Blob,
): Promise<Scenario> {
  const saved = await createScenario(scenario, thumbnail);
  setState("scenarios", (prev) => [saved, ...prev]);
  return scenario;
}

async function editScenario(
  id: string,
  patch: Partial<Omit<Scenario, "id" | "createdAt">>,
  thumbnail?: Blob,
): Promise<void> {
  const updated = await updateScenario(id, patch, thumbnail);
  setState("scenarios", (prev) => prev.map((s) => (s.id === id ? updated : s)));
}

async function removeScenario(id: string): Promise<void> {
  await deleteScenario(id);
  setState("scenarios", (prev) => prev.filter((s) => s.id !== id));
}

async function addStory(story: Story, thumbnail?: Blob): Promise<Story> {
  const saved = await createStory(story, thumbnail);
  setState("stories", (prev) => [saved, ...prev]);
  return saved;
}

/**
 * Reflects a story update already persisted by the session store.
 * The session store owns persistence for active stories; this just
 * keeps the library list in sync.
 */
function syncStory(story: Story): void {
  setState("stories", (prev) =>
    prev.map((s) => (s.id === story.id ? story : s)),
  );
}

type EditableStoryFields = Pick<
  Story,
  | "name"
  | "description"
  | "authorNotes"
  | "essentials"
  | "instructions"
  | "thumbnailId"
>;

async function editStory(
  id: string,
  patch: Partial<EditableStoryFields>,
  thumbnail?: Blob,
): Promise<Story> {
  const updated = await updateStory(id, patch, thumbnail);
  setState("stories", (prev) => prev.map((s) => (s.id === id ? updated : s)));
  return updated;
}

async function removeStory(id: string): Promise<void> {
  await deleteStory(id);
  setState("stories", (prev) => prev.filter((s) => s.id !== id));
}

export const libraryStore = {
  get scenarios() {
    return state.scenarios;
  },
  get stories() {
    return state.stories;
  },
  get loading() {
    return state.loading;
  },
  get items() {
    return items();
  },

  init,
  addScenario,
  editScenario,
  removeScenario,
  addStory,
  syncStory,
  editStory,
  removeStory,
  grouped,
};
