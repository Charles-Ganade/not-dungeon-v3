import Dexie, { type Table } from "dexie";
import type { GlobalSettings } from "@/core/types/settings";
import type { Scenario } from "@/core/types/scenarios";
import type { Story } from "@/core/types/stories";

interface SettingsRow {
  id: "global";
  data: GlobalSettings;
}

class AppDatabase extends Dexie {
  settings!: Table<SettingsRow, "global">;
  scenarios!: Table<Scenario, string>;
  stories!: Table<Story, string>;

  constructor() {
    super("not-dungeon");

    this.version(1).stores({
      // Single-row table, always queried with id === "global".
      settings: "id",

      // *tags — multi-entry index: each tag gets its own entry,
      // enabling: db.scenarios.where("tags").equals("fantasy")
      scenarios: "id, *tags, createdAt, updatedAt",

      // scenarioId is optional — "?" allows undefined in the index.
      stories: "id, scenarioId, lastPlayedAt, createdAt",
    });
  }
}

export const db = new AppDatabase();