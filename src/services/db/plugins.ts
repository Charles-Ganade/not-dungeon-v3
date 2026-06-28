import { db } from "./schema";
import type { InstalledPlugin } from "@/core/types/plugins";
import type { PluginManifest } from "@/core/types/plugins";

export async function getAllPlugins(): Promise<InstalledPlugin[]> {
  return db.plugins.orderBy("installedAt").reverse().toArray();
}

export async function getPlugin(id: string): Promise<InstalledPlugin | undefined> {
  return db.plugins.get(id);
}

/**
 * Installs (or upgrades, by id) a plugin. `put` is idempotent — installing a
 * manifest whose id already exists replaces it with the newer one.
 */
export async function installPlugin(
  manifest: PluginManifest,
): Promise<InstalledPlugin> {
  const row: InstalledPlugin = { ...manifest, installedAt: Date.now() };
  await db.plugins.put(row);
  return row;
}

export async function uninstallPlugin(id: string): Promise<void> {
  await db.plugins.delete(id);
}
