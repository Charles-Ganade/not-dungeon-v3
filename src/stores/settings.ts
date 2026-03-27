import { createStore, reconcile } from "solid-js/store";
import { getSettings, patchSettings as dbPatch } from "@/services/db";
import type { GlobalSettings } from "@/core/types/settings";
import { DEFAULT_SETTINGS } from "@/core/defaults/settings";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const [settings, setSettings] = createStore<GlobalSettings>(
  structuredClone(DEFAULT_SETTINGS)
);

/**
 * Load settings from IndexedDB into the store.
 * Call once at app startup before rendering.
 */
async function init(): Promise<void> {
  const stored = await getSettings();
  setSettings(reconcile(stored));
}

/**
 * Merges a partial patch into the settings store and persists.
 *
 * @example
 *   await patch({ ui: { theme: "dark" } })
 */
async function patch(update: DeepPartial<GlobalSettings>): Promise<void> {
  const next = await dbPatch(update);
  setSettings(reconcile(next));
}

export const settingsStore = { settings, patch, init };