import { createStore, reconcile } from "solid-js/store";
import {
  getAllPlugins,
  installPlugin,
  uninstallPlugin,
} from "@/services/db";
import type { InstalledPlugin, PluginManifest } from "@/core/types/plugins";

interface PluginsState {
  installed: InstalledPlugin[];
  loading: boolean;
}

const [state, setState] = createStore<PluginsState>({
  installed: [],
  loading: false,
});

async function init(): Promise<void> {
  setState("loading", true);
  const installed = await getAllPlugins();
  setState(reconcile({ installed, loading: false }));
}

async function install(manifest: PluginManifest): Promise<InstalledPlugin> {
  const saved = await installPlugin(manifest);
  setState("installed", (prev) => [
    saved,
    ...prev.filter((p) => p.id !== saved.id),
  ]);
  return saved;
}

async function uninstall(id: string): Promise<void> {
  await uninstallPlugin(id);
  setState("installed", (prev) => prev.filter((p) => p.id !== id));
}

export const pluginsStore = {
  get installed() {
    return state.installed;
  },
  get loading() {
    return state.loading;
  },
  init,
  install,
  uninstall,
};
