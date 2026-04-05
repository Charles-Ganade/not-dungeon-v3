import type { StoryCard } from "@/core/types/stories";
import { makeDefaultStoryCard } from "@/core/defaults";

interface StoryCardJSON {
  title: string;
  value: string;
  keys: string[] | string;
  type: string[] | string;
  enabled?: boolean;
}

function splitIfString(value: string[] | string): string[] {
  if (Array.isArray(value)) return value.map((s) => s.trim()).filter(Boolean);
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Parses a JSON string into an array of StoryCards.
 * Throws a descriptive error if the JSON is malformed or any
 * required field is missing or the wrong type.
 */
export function importStoryCards(json: string): StoryCard[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON — could not parse the file.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid format — expected a JSON array at the root.");
  }
  return parsed.map((item, index) => {
    const prefix = `Item at index ${index}`;
    if (typeof item !== "object" || item === null) {
      throw new Error(`${prefix}: expected an object, got ${typeof item}.`);
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.title !== "string" || !obj.title.trim()) {
      throw new Error(`${prefix}: "title" must be a non-empty string.`);
    }
    if (typeof obj.value !== "string") {
      throw new Error(`${prefix}: "value" must be a string.`);
    }
    if (
      obj.keys === undefined ||
      (typeof obj.keys !== "string" && !Array.isArray(obj.keys))
    ) {
      throw new Error(`${prefix}: "keys" must be a string or array of strings.`);
    }
    if (
      obj.type === undefined ||
      (typeof obj.type !== "string" && !Array.isArray(obj.type))
    ) {
      throw new Error(`${prefix}: "type" must be a string or array of strings.`);
    }
    if (obj.enabled !== undefined && typeof obj.enabled !== "boolean") {
      throw new Error(`${prefix}: "enabled" must be a boolean if provided.`);
    }
    return makeDefaultStoryCard({
      title: (obj.title as string).trim(),
      content: obj.value as string,
      triggers: splitIfString(obj.keys as string[] | string),
      tags: splitIfString(obj.type as string[] | string),
      enabled: obj.enabled ?? true,
    });
  });
}

/**
 * Serializes an array of StoryCards to a downloadable File.
 * The JSON is formatted with 2-space indentation.
 */
export function exportStoryCards(cards: StoryCard[]): File {
  const data: StoryCardJSON[] = cards.map((card) => ({
    title: card.title,
    value: card.content,
    keys: card.triggers,
    type: card.tags,
    enabled: card.enabled,
  }));
  const json = JSON.stringify(data, null, 2);
  return new File([json], "story-cards.json", { type: "application/json" });
}