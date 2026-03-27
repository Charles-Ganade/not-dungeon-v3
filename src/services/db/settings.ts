import { db } from "./schema";
import type { GlobalSettings } from "@/core/types/settings";

// Imported from core/defaults — you maintain these, not this file.
import { DEFAULT_SETTINGS } from "@/core/defaults/settings";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function deepMerge<T extends object>(base: T, patch: DeepPartial<T>): T {
  const result = { ...base };
  for (const key in patch) {
    const patchVal = patch[key];
    const baseVal = base[key];
    if (
      patchVal !== undefined &&
      typeof patchVal === "object" &&
      !Array.isArray(patchVal) &&
      typeof baseVal === "object" &&
      baseVal !== null
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(baseVal as object, patchVal as DeepPartial<object>);
    } else if (patchVal !== undefined) {
      (result as Record<string, unknown>)[key] = patchVal;
    }
  }
  return result;
}

/**
 * Returns stored global settings, falling back to defaults on
 * first launch. New fields added in future versions automatically
 * receive their default value via the deep merge.
 */
export async function getSettings(): Promise<GlobalSettings> {
  const row = await db.settings.get("global");
  if (!row) return structuredClone(DEFAULT_SETTINGS);
  return deepMerge(DEFAULT_SETTINGS, row.data);
}

export async function saveSettings(settings: GlobalSettings): Promise<void> {
  await db.settings.put({ id: "global", data: settings });
}

/**
 * Merges a partial patch into the current settings and persists.
 * Supports deeply nested partials — you can patch a single field
 * without passing the entire tree.
 *
 * @example
 *   await patchSettings({ ui: { theme: "dark" } })
 */
export async function patchSettings(patch: DeepPartial<GlobalSettings>): Promise<GlobalSettings> {
  const current = await getSettings();
  const next = deepMerge(current, patch);
  await saveSettings(next);
  return next;
}