import { Flex, Text, PluginConfigEditor } from "@/app/components";
import { sessionStore } from "@/store";

export function PluginsPanel() {
  return (
    <Flex direction={"col"} class="gap-3 w-full p-4 overflow-y-auto">
      <Text variant={"h5"} weight={"bold"}>
        Plugins
      </Text>
      <PluginConfigEditor
        enabledPlugins={sessionStore.story?.enabledPlugins ?? []}
        onChange={(next) => sessionStore.setEnabledPlugins(next)}
        emptyHint="No plugins installed. Install one from Settings → Plugins, then enable it here."
      />
    </Flex>
  );
}
