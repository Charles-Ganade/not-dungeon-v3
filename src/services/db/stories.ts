// services/db/stories.ts

import { db } from "./schema";
import type { Story } from "@/core/types/stories";
import { deleteThumbnail, isThumbnailReferenced, saveThumbnail } from "./thumbnails";

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

export async function createStory(
  story: Story,
  thumbnail?: Blob
): Promise<Story> {
  const row: Story = { ...story };
 
  if (thumbnail) {
    row.thumbnailId = await saveThumbnail(thumbnail);
  }
 
  await db.stories.add(row);
  return row;
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
  const existing = await getStory(story.id);
 
  if (existing?.thumbnailId && existing.thumbnailId !== story.thumbnailId) {
    // Old thumbnail is no longer referenced — clean it up
    await deleteThumbnail(existing.thumbnailId);
  }
 
  await db.stories.put({ ...story, updatedAt: Date.now() });
}

/**
 * Stamps lastPlayedAt to now. Called when the player opens a story
 * before the full save cycle runs.
 */
export async function touchStory(id: string): Promise<void> {
  await db.stories.update(id, { lastPlayedAt: Date.now() });
}

type EditableStoryFields = Pick<Story,
  "name" | "description" | "authorNotes" | "essentials" | "instructions" | "thumbnailId"
>;
 
/**
 * Updates editable story metadata fields. Thumbnail lifecycle:
 *   - `thumbnail` blob provided → delete old blob, save new, update thumbnailId
 *   - `patch.thumbnailId === undefined` explicitly → delete old blob, clear thumbnailId
 *   - neither → leave existing thumbnailId untouched
 */
export async function updateStory(
  id: string,
  patch: Partial<EditableStoryFields>,
  thumbnail?: Blob
): Promise<Story> {
  const existing = await db.stories.get(id);
  if (!existing) throw new Error(`Story ${id} not found`);
 
  const updates: Partial<Story> = { ...patch, updatedAt: Date.now() };
 
  if (thumbnail) {
    if (existing.thumbnailId) await deleteThumbnail(existing.thumbnailId);
    updates.thumbnailId = await saveThumbnail(thumbnail);
  } else if ("thumbnailId" in patch && patch.thumbnailId === undefined) {
    if (existing.thumbnailId) await deleteThumbnail(existing.thumbnailId);
    updates.thumbnailId = undefined;
  }
 
  await db.stories.update(id, updates);
  const updated = await db.stories.get(id);
  if (!updated) throw new Error(`Story ${id} not found after update`);
  return updated;
}

/**
 * Deletes a story and all its data. Stories are self-contained,
 * so this is a single-table delete with no cascades needed.
 */
export async function deleteStory(id: string): Promise<void> {
  const story = await getStory(id);
  if (story?.thumbnailId && !(await isThumbnailReferenced(story.thumbnailId))) {
    await deleteThumbnail(story.thumbnailId);
  }
  await db.stories.delete(id);
}