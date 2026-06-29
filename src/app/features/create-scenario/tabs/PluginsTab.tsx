import { PluginConfigEditor } from "@/app/components";
import { useCreateScenario } from "../context";

export function PluginsTab() {
  const { newScenario, setNewScenario } = useCreateScenario();
  return (
    <div class="tab-content bg-base-200 p-6">
      <PluginConfigEditor
        enabledPlugins={newScenario.enabledPlugins ?? []}
        onChange={(next) => setNewScenario("enabledPlugins", next)}
        emptyHint="No plugins installed. Install one from Settings → Plugins to add it to this scenario."
      />
    </div>
  );
}
