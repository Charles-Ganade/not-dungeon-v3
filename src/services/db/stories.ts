// services/db/stories.ts

import { db } from "./schema";
import type { Story } from "@/core/types/stories";

// ── Read ──────────────────────────────────────────────────────

export async function getStory(id: string): Promise<Story | undefined> {
  return db.stories.get(id);
}

/**
 * All stories sorted by most recently played.
 * Stories never opened (lastPlayedAt === 0) sort to the bottom.
 */
export async function getAllStories(): Promise<Story[]> {
  return db.stories.orderBy("lastPlayedAt").reverse().toArray();
}

export async function getStoriesByScenario(scenarioId: string): Promise<Story[]> {
  return db.stories.where("scenarioId").equals(scenarioId).reverse().sortBy("lastPlayedAt");
}

// ── Write ─────────────────────────────────────────────────────

export async function createStory(story: Story): Promise<Story> {
  await db.stories.add(story);
  return story;
}

/**
 * Persists the full story object. Called by the game store after
 * every committed delta transaction.
 *
 * We use `put` (full replace) rather than `update` (partial patch)
 * because the store always holds the complete authoritative Story
 * in memory — there's no risk of clobbering unknown fields.
 */
export async function saveStory(story: Story): Promise<void> {
  await db.stories.put({ ...story, updatedAt: Date.now() });
}

/**
 * Stamps lastPlayedAt to now. Called when the player opens a story
 * before the full save cycle runs.
 */
export async function touchStory(id: string): Promise<void> {
  await db.stories.update(id, { lastPlayedAt: Date.now() });
}

/**
 * Deletes a story and all its data. Stories are self-contained,
 * so this is a single-table delete with no cascades needed.
 */
export async function deleteStory(id: string): Promise<void> {
  await db.stories.delete(id);
}