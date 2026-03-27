import Dexie, { type Table } from "dexie";
import type { GlobalSettings } from "@/core/types/settings";
import type { Scenario } from "@/core/types/scenarios";
import type { Story } from "@/core/types/stories";

interface SettingsRow {
  id: "global";
  data: GlobalSettings;
}

interface ThumbnailRow {
  id: string;
  blob: Blob;
}

class AppDatabase extends Dexie {
  settings!: Table<SettingsRow, "global">;
  scenarios!: Table<Scenario, string>;
  stories!: Table<Story, string>;
  thumbnails!: Table<ThumbnailRow, string>;

  constructor() {
    super("not-dungeon");

    this.version(2).stores({
      settings: "id",
      scenarios: "id, *tags, createdAt, updatedAt, thumbnailId",
      stories: "id, scenarioId, lastPlayedAt, createdAt, thumbnailId",
      thumbnails: "id",
    });
  }
}

export const db = new AppDatabase();