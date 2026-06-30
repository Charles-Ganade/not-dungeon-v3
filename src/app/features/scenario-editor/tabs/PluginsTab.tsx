import { PluginConfigEditor } from "@/app/components";
import { useScenarioEditor } from "../context";

export function PluginsTab() {
  const { scenario, setScenario } = useScenarioEditor();
  return (
    <div class="tab-content bg-base-200 p-6">
      <PluginConfigEditor
        enabledPlugins={scenario.enabledPlugins ?? []}
        onChange={(next) => setScenario("enabledPlugins", next)}
        emptyHint="No plugins installed. Install one from Settings → Plugins to add it to this scenario."
      />
    </div>
  );
}
