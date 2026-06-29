import { PluginConfigEditor } from "@/app/components";
import { useEditScenario } from "../context";

export function PluginsTab() {
  const { currentScenario, setCurrentScenario } = useEditScenario();
  return (
    <div class="tab-content bg-base-200 p-6">
      <PluginConfigEditor
        enabledPlugins={currentScenario.enabledPlugins ?? []}
        onChange={(next) => setCurrentScenario("enabledPlugins", next)}
        emptyHint="No plugins installed. Install one from Settings → Plugins to add it to this scenario."
      />
    </div>
  );
}
