import JSZip from "jszip";
import type { HistoryMessage, Story } from "@/core/types/stories";
import { getThumbnailBlob } from "@/services/db";
import { dataURLToBlob } from "@/utils";

const STORY_BUNDLE_VERSION = 1;

/**
 * The `manifest.json` inside a `.story.zip` — just metadata. The full story
 * lives in `story.json`; the thumbnail rides along as a real image file
 * ("thumbnail" entry), with `thumbnail.mime` recording its type.
 *
 * Zip layout:
 *   manifest.json   this metadata
 *   story.json      the full Story object
 *   thumbnail       the thumbnail image bytes (optional)
 */
interface StoryManifest {
  schemaVersion: 1;
  kind: "story";
  exportedAt: number;
  app?: string;
  /** Story name — lets you identify a bundle without opening story.json. */
  name: string;
  thumbnail?: { mime: string };
}

/** The legacy single-JSON bundle (thumbnails base64-embedded). Still imported. */
interface LegacyStoryBundle {
  schemaVersion: 1;
  kind: "story";
  story: Story;
  thumbnails?: Record<string, string>;
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "story";
}

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/** ZIP local-file-header magic ("PK\x03\x04"). */
function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/**
 * Serializes a story to a downloadable `.story.zip`: a small `manifest.json`,
 * the full story in `story.json`, and the thumbnail as a real image file.
 * Async (reads the thumbnail blob + zips).
 */
export async function exportStoryBundle(story: Story): Promise<File> {
  const zip = new JSZip();

  zip.file("story.json", JSON.stringify(story, null, 2));

  let thumbnail: { mime: string } | undefined;
  if (story.thumbnailId) {
    const blob = await getThumbnailBlob(story.thumbnailId);
    if (blob) {
      zip.file("thumbnail", blob);
      thumbnail = { mime: blob.type || "image/png" };
    }
  }

  const manifest: StoryManifest = {
    schemaVersion: STORY_BUNDLE_VERSION,
    kind: "story",
    exportedAt: Date.now(),
    name: story.name,
    thumbnail,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], `${slugify(story.name)}.story.zip`, {
    type: "application/zip",
  });
}

/** Upgrades an older manifest/bundle to the current schema before validation. */
function migrateStoryManifest(raw: Record<string, unknown>): void {
  if (raw.schemaVersion !== STORY_BUNDLE_VERSION) {
    throw new Error(`Unsupported story bundle version: ${String(raw.schemaVersion)}`);
  }
  if (raw.kind !== "story") {
    throw new Error('Invalid bundle — "kind" must be "story".');
  }
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
 * never collide with existing data. Rewrites all cross-references: parentId,
 * currentLeafId, memory.messageIds, and thinkingBlock ids. `scenarioId` is
 * preserved (relinks if that scenario exists). `thumbnailId` is left for the
 * caller to set after re-saving the blob.
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
 * payload (the caller saves it, e.g. via `libraryStore.addStory`). Accepts the
 * new `.story.zip` and the legacy single-JSON bundle (string or bytes). The
 * returned story has `thumbnailId` cleared; pass the blob to the store so it
 * re-saves it under a fresh id.
 */
export async function importStoryBundle(
  data: ArrayBuffer | Uint8Array | string,
): Promise<{ story: Story; thumbnailBlob: Blob | null }> {
  if (typeof data === "string") return importLegacyStoryJSON(data);

  const bytes = toBytes(data);
  if (!isZip(bytes)) {
    return importLegacyStoryJSON(new TextDecoder().decode(bytes));
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error("Invalid story file — could not read the archive.");
  }

  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("Invalid story bundle — missing manifest.json.");
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(await manifestFile.async("string"));
  } catch {
    throw new Error("Invalid story bundle — manifest.json is not valid JSON.");
  }
  migrateStoryManifest(manifest);

  // The story lives in story.json; fall back to an inline `story` for the
  // earlier zip layout that embedded it in the manifest.
  let storyRaw: unknown;
  const storyFile = zip.file("story.json");
  if (storyFile) {
    try {
      storyRaw = JSON.parse(await storyFile.async("string"));
    } catch {
      throw new Error("Invalid story bundle — story.json is not valid JSON.");
    }
  } else if (manifest.story !== undefined) {
    storyRaw = manifest.story;
  } else {
    throw new Error("Invalid story bundle — missing story.json.");
  }

  const story = validateStory(storyRaw);

  const thumbnailMeta = manifest.thumbnail as { mime: string } | undefined;
  let thumbnailBlob: Blob | null = null;
  if (thumbnailMeta) {
    const entry = zip.file("thumbnail");
    if (entry) {
      // Re-wrap with the recorded mime — JSZip's blob output has no type.
      const raw = await entry.async("blob");
      thumbnailBlob = new Blob([raw], { type: thumbnailMeta.mime });
    }
  }

  const remapped = remapStoryIds(story);
  remapped.thumbnailId = undefined;
  return { story: remapped, thumbnailBlob };
}

/** Legacy path: the original single-JSON bundle with a base64-embedded thumbnail. */
async function importLegacyStoryJSON(
  json: string,
): Promise<{ story: Story; thumbnailBlob: Blob | null }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON — could not parse the file.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid format — expected a story bundle.");
  }
  const raw = parsed as Record<string, unknown>;
  migrateStoryManifest(raw);

  const bundle = raw as unknown as LegacyStoryBundle;
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
