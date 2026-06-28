import type { HistoryMessage, Story } from "@/core/types/stories";
import { getThumbnailBlob } from "@/services/db";
import { blobToDataURL, dataURLToBlob } from "@/utils";

const STORY_BUNDLE_VERSION = 1;

/**
 * A portable, self-describing snapshot of a single story (with progress).
 *
 *   - `story`      the full Story: branch tree, currentLeafId, thinkingBlocks,
 *                  memories, storyCards, kvMemory, scriptState, scripts, override.
 *   - `thumbnails` referenced thumbnail blobs, base64-encoded by id.
 *
 * The linked scenario is intentionally NOT bundled — a dangling `scenarioId`
 * is tolerated by the library and the engine.
 */
export interface StoryBundleV1 {
  schemaVersion: 1;
  kind: "story";
  exportedAt: number;
  app?: string;
  story: Story;
  thumbnails: Record<string, string>;
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "story";
}

/**
 * Serializes a story to a downloadable bundle File. Async because the
 * thumbnail blob is read from IndexedDB and base64-encoded inline.
 */
export async function exportStoryBundle(story: Story): Promise<File> {
  const thumbnails: Record<string, string> = {};
  if (story.thumbnailId) {
    const blob = await getThumbnailBlob(story.thumbnailId);
    if (blob) thumbnails[story.thumbnailId] = await blobToDataURL(blob);
  }

  const bundle: StoryBundleV1 = {
    schemaVersion: STORY_BUNDLE_VERSION,
    kind: "story",
    exportedAt: Date.now(),
    story,
    thumbnails,
  };

  const json = JSON.stringify(bundle, null, 2);
  return new File([json], `${slugify(story.name)}.story.json`, {
    type: "application/json",
  });
}

/**
 * Upgrades an older bundle to the current schema. v1 is current; future
 * versions add upgrade steps here before validation runs.
 */
function migrateStoryBundle(raw: Record<string, unknown>): StoryBundleV1 {
  if (raw.schemaVersion === STORY_BUNDLE_VERSION) {
    return raw as unknown as StoryBundleV1;
  }
  throw new Error(`Unsupported story bundle version: ${String(raw.schemaVersion)}`);
}

/**
 * Validates the message tree: every parentId resolves, currentLeafId resolves,
 * and the active branch has no cycles.
 */
function validateMessageTree(
  messages: HistoryMessage[],
  currentLeafId: string | null,
): void {
  const byId = new Map<string, HistoryMessage>();
  for (const m of messages) {
    if (!m || typeof m.id !== "string") {
      throw new Error("Story contains a message with no id.");
    }
    byId.set(m.id, m);
  }

  for (const m of messages) {
    if (m.parentId != null && !byId.has(m.parentId)) {
      throw new Error(
        `Story message ${m.id} references a missing parent ${m.parentId}.`,
      );
    }
  }

  if (currentLeafId !== null && !byId.has(currentLeafId)) {
    throw new Error(
      `Story currentLeafId ${currentLeafId} does not resolve to a message.`,
    );
  }

  if (currentLeafId !== null) {
    const seen = new Set<string>();
    let cursor: HistoryMessage | undefined = byId.get(currentLeafId);
    while (cursor) {
      if (seen.has(cursor.id)) {
        throw new Error("Story message tree contains a cycle.");
      }
      seen.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }
}

function validateStory(value: unknown): Story {
  if (typeof value !== "object" || value === null) {
    throw new Error('Invalid bundle — "story" must be an object.');
  }
  const s = value as Record<string, unknown>;

  if (typeof s.name !== "string" || !s.name.trim()) {
    throw new Error('Story "name" must be a non-empty string.');
  }
  if (!Array.isArray(s.messages)) {
    throw new Error('Story "messages" must be an array.');
  }
  if (!Array.isArray(s.memories)) {
    throw new Error('Story "memories" must be an array.');
  }
  if (!Array.isArray(s.storyCards)) {
    throw new Error('Story "storyCards" must be an array.');
  }
  if (typeof s.kvMemory !== "object" || s.kvMemory === null) {
    throw new Error('Story "kvMemory" must be an object.');
  }
  if (typeof s.scriptState !== "string") {
    throw new Error('Story "scriptState" must be a string.');
  }
  if (typeof s.scripts !== "object" || s.scripts === null) {
    throw new Error('Story "scripts" must be an object.');
  }
  if (typeof s.override !== "object" || s.override === null) {
    throw new Error('Story "override" must be an object.');
  }
  if (s.currentLeafId !== null && typeof s.currentLeafId !== "string") {
    throw new Error('Story "currentLeafId" must be a string or null.');
  }

  validateMessageTree(
    s.messages as HistoryMessage[],
    s.currentLeafId as string | null,
  );

  return value as Story;
}

/**
 * Regenerates every id so the imported story is an independent copy that can
 * never collide with existing data (importing the same file twice yields two
 * distinct playthroughs). Rewrites all cross-references: parentId,
 * currentLeafId, memory.messageIds, and thinkingBlock ids.
 *
 * `scenarioId` is preserved (relinks if that scenario exists, otherwise a
 * tolerated dangling reference). `thumbnailId` is left for the caller to set
 * after re-saving the blob.
 */
export function remapStoryIds(input: Story): Story {
  const story = structuredClone(input);
  const newId = () => crypto.randomUUID();

  const msgMap = new Map<string, string>();
  for (const m of story.messages) msgMap.set(m.id, newId());
  const memMap = new Map<string, string>();
  for (const mem of story.memories) memMap.set(mem.id, newId());
  const cardMap = new Map<string, string>();
  for (const c of story.storyCards) cardMap.set(c.id, newId());

  story.id = newId();

  story.messages = story.messages.map((m) => ({
    ...m,
    id: msgMap.get(m.id)!,
    parentId: m.parentId ? msgMap.get(m.parentId) ?? null : null,
    thinkingBlocks: (m.thinkingBlocks ?? []).map((tb) => ({
      ...tb,
      id: newId(),
      messageId: msgMap.get(tb.messageId) ?? msgMap.get(m.id)!,
    })),
  }));

  story.currentLeafId = story.currentLeafId
    ? msgMap.get(story.currentLeafId) ?? null
    : null;

  story.memories = story.memories
    .map((mem) => ({
      ...mem,
      id: memMap.get(mem.id)!,
      messageIds: mem.messageIds
        .map((id) => msgMap.get(id))
        .filter((id): id is string => Boolean(id)),
    }))
    .filter((mem) => mem.messageIds.length > 0);

  story.storyCards = story.storyCards.map((c) => ({
    ...c,
    id: cardMap.get(c.id)!,
  }));

  const now = Date.now();
  story.createdAt = now;
  story.updatedAt = now;
  story.lastPlayedAt = now;

  return story;
}

/**
 * Parses, validates, and normalizes a story bundle into a ready-to-persist
 * payload. Pure with respect to the database — the caller saves the result
 * (e.g. via `libraryStore.addStory(story, thumbnailBlob)`), mirroring
 * `importScenario`. The returned story has `thumbnailId` cleared; pass the
 * blob to the store so it can re-save it under a fresh id.
 */
export async function importStoryBundle(
  json: string,
): Promise<{ story: Story; thumbnailBlob: Blob | null }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON — could not parse the file.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid format — expected a story bundle object.");
  }

  const raw = parsed as Record<string, unknown>;
  if (raw.kind !== "story") {
    throw new Error('Invalid bundle — "kind" must be "story".');
  }

  const bundle = migrateStoryBundle(raw);
  const story = validateStory(bundle.story);

  let thumbnailBlob: Blob | null = null;
  const originalThumbId = story.thumbnailId;
  if (originalThumbId && bundle.thumbnails?.[originalThumbId]) {
    thumbnailBlob = await dataURLToBlob(bundle.thumbnails[originalThumbId]);
  }

  const remapped = remapStoryIds(story);
  remapped.thumbnailId = undefined;

  return { story: remapped, thumbnailBlob };
}
