import { settingsStore } from "./settings";
import { libraryStore } from "./library";
import { sessionStore } from "./session";
import { configStore } from "./config";
import { pluginsStore } from "./plugins";

/**
 * Initializes all stores that require async DB reads.
 * Call once at app startup before rendering the UI.
 *
 * @example
 *   // In your root App component or entry point:
 *   await initStores();
 *   render(() => <App />, document.getElementById("root")!);
 */
export async function initStores(): Promise<void> {
  await Promise.all([
    settingsStore.init(),
    libraryStore.init(),
    pluginsStore.init(),
  ]);
}

export { sessionStore, libraryStore, settingsStore, configStore, pluginsStore };