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