import { db } from "./schema";

export async function saveThumbnail(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await db.thumbnails.add({ id, blob });
  return id;
}

export async function getThumbnailBlob(id: string): Promise<Blob | null> {
  const row = await db.thumbnails.get(id);
  if (!row) return null;
  return row.blob;
}

export async function getThumbnailUrl(id: string): Promise<string | null> {
  const row = await db.thumbnails.get(id);
  if (!row) return null;
  return URL.createObjectURL(row.blob);
}

export async function deleteThumbnail(id: string): Promise<void> {
  await db.thumbnails.delete(id);
}

/**
 * Check if a thumbnail is still referenced by any story or scenario.
 * Only delete if this returns false.
 */
export async function isThumbnailReferenced(thumbnailId: string): Promise<boolean> {
  const storyUsingIt = await db.stories
    .where("thumbnailId")
    .equals(thumbnailId)
    .first();
  
  const scenarioUsingIt = await db.scenarios
    .where("thumbnailId")
    .equals(thumbnailId)
    .first();
  
  return !!storyUsingIt || !!scenarioUsingIt;
}