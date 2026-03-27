import type { Scenario } from "@/core/types";
import type { StoryCard, ScriptBundle, ConfigOverride } from "@/core/types/stories";
import { makeDefaultScenario } from "@/core/defaults";

interface ScenarioJSON {
  name: string;
  description: string;
  openingPrompt: string;
  authorNotes: string;
  instructions: string;
  essentials: string;
  tags: string[] | string;
  storyCards: StoryCard[];
  scripts: ScriptBundle;
  override: ConfigOverride;
}

function splitIfString(value: string[] | string): string[] {
  if (Array.isArray(value)) return value.map((s) => s.trim()).filter(Boolean);
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Parses a JSON string into a Scenario.
 * Throws a descriptive error if the JSON is malformed or any
 * required field is missing or the wrong type.
 */
export function importScenario(json: string): Scenario {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON — could not parse the file.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid format — expected a JSON object at the root.");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.name !== "string" || !obj.name.trim()) {
    throw new Error('"name" must be a non-empty string.');
  }
  if (typeof obj.description !== "string") {
    throw new Error('"description" must be a string.');
  }
  if (typeof obj.openingPrompt !== "string") {
    throw new Error('"openingPrompt" must be a string.');
  }
  if (typeof obj.authorNotes !== "string") {
    throw new Error('"authorNotes" must be a string.');
  }
  if (typeof obj.instructions !== "string") {
    throw new Error('"instructions" must be a string.');
  }
  if (typeof obj.essentials !== "string") {
    throw new Error('"essentials" must be a string.');
  }
  if (
    obj.tags === undefined ||
    (typeof obj.tags !== "string" && !Array.isArray(obj.tags))
  ) {
    throw new Error('"tags" must be a string or array of strings.');
  }
  if (!Array.isArray(obj.storyCards)) {
    throw new Error('"storyCards" must be an array.');
  }
  if (typeof obj.scripts !== "object" || obj.scripts === null) {
    throw new Error('"scripts" must be an object.');
  }
  if (typeof obj.override !== "object" || obj.override === null) {
    throw new Error('"override" must be an object.');
  }
  return makeDefaultScenario({
    name: (obj.name as string).trim(),
    description: (obj.description as string).trim(),
    openingPrompt: obj.openingPrompt as string,
    authorNotes: obj.authorNotes as string,
    instructions: obj.instructions as string,
    essentials: obj.essentials as string,
    tags: splitIfString(obj.tags as string[] | string),
    storyCards: obj.storyCards as StoryCard[],
    scripts: obj.scripts as ScriptBundle,
    override: obj.override as ConfigOverride,
  });
}

/**
 * Serializes a Scenario to a downloadable File.
 * The JSON is formatted with 2-space indentation.
 */
export function exportScenario(scenario: Omit<Scenario, "id" | "createdAt" | "updatedAt">): File {
  const data: ScenarioJSON = {
    name: scenario.name,
    description: scenario.description,
    openingPrompt: scenario.openingPrompt,
    authorNotes: scenario.authorNotes,
    instructions: scenario.instructions,
    essentials: scenario.essentials,
    tags: scenario.tags,
    storyCards: scenario.storyCards,
    scripts: scenario.scripts,
    override: scenario.override,
  };
  const json = JSON.stringify(data, null, 2);
  return new File([json], "scenario.json", { type: "application/json" });
}
