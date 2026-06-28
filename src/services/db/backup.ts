import { db } from "./schema";
import type { GlobalSettings } from "@/core/types/settings";
import type { Scenario } from "@/core/types/scenarios";
import type { Story } from "@/core/types/stories";
import type { InstalledPlugin } from "@/core/types/plugins";
import { blobToDataURL, dataURLToBlob } from "@/utils";

const BACKUP_VERSION = 1;

interface SettingsRow {
  id: "global";
  data: GlobalSettings;
}

interface ThumbnailRow {
  id: string;
  blob: Blob;
}

/**
 * A full-library snapshot: every Dexie table, with thumbnail blobs
 * base64-encoded inline. Used for backup/restore and device migration.
 */
export interface BackupV1 {
  schemaVersion: 1;
  kind: "backup";
  exportedAt: number;
  settings: SettingsRow[];
  scenarios: Scenario[];
  stories: Story[];
  plugins: InstalledPlugin[];
  thumbnails: Record<string, string>;
}

/** Dumps every table into a single downloadable backup File. */
export async function exportBackup(): Promise<File> {
  const [settings, scenarios, stories, plugins, thumbnailRows] =
    await Promise.all([
      db.settings.toArray(),
      db.scenarios.toArray(),
      db.stories.toArray(),
      db.plugins.toArray(),
      db.thumbnails.toArray(),
    ]);

  const thumbnails: Record<string, string> = {};
  for (const row of thumbnailRows) {
    thumbnails[row.id] = await blobToDataURL(row.blob);
  }

  const backup: BackupV1 = {
    schemaVersion: BACKUP_VERSION,
    kind: "backup",
    exportedAt: Date.now(),
    settings: settings as SettingsRow[],
    scenarios,
    stories,
    plugins,
    thumbnails,
  };

  const json = JSON.stringify(backup);
  const stamp = new Date().toISOString().slice(0, 10);
  return new File([json], `not-dungeon-backup-${stamp}.json`, {
    type: "application/json",
  });
}

/**
 * Restores a backup.
 *   - "replace": wipes all tables first, then writes the backup (full restore).
 *   - "merge":   writes the backup over existing rows by id (additive).
 *
 * Thumbnails are decoded before the transaction (fetch can't run inside a
 * Dexie transaction). The caller should refresh the in-memory stores
 * afterwards (`libraryStore.init()`, `settingsStore.init()`).
 */
export async function importBackup(
  json: string,
  mode: "merge" | "replace",
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON — could not parse the backup file.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid format — expected a backup object.");
  }

  const raw = parsed as Record<string, unknown>;
  if (raw.kind !== "backup") {
    throw new Error('Invalid backup — "kind" must be "backup".');
  }
  if (raw.schemaVersion !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${String(raw.schemaVersion)}`);
  }

  const backup = raw as unknown as BackupV1;

  const thumbnailRows: ThumbnailRow[] = [];
  for (const [id, dataURL] of Object.entries(backup.thumbnails ?? {})) {
    thumbnailRows.push({ id, blob: await dataURLToBlob(dataURL) });
  }

  await db.transaction(
    "rw",
    db.settings,
    db.scenarios,
    db.stories,
    db.plugins,
    db.thumbnails,
    async () => {
      if (mode === "replace") {
        await Promise.all([
          db.settings.clear(),
          db.scenarios.clear(),
          db.stories.clear(),
          db.plugins.clear(),
          db.thumbnails.clear(),
        ]);
      }
      await Promise.all([
        db.settings.bulkPut(backup.settings ?? []),
        db.scenarios.bulkPut(backup.scenarios ?? []),
        db.stories.bulkPut(backup.stories ?? []),
        db.plugins.bulkPut(backup.plugins ?? []),
        db.thumbnails.bulkPut(thumbnailRows),
      ]);
    },
  );
}
