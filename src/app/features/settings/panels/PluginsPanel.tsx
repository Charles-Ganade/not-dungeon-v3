import { Flex, Text } from "@/app/components";
import { PanelLabel } from "../PanelLabel";
import { For, Show } from "solid-js";
import { toast } from "solid-sonner";
import { pluginsStore } from "@/store";
import { importPlugin, exportPlugin } from "@/core/utils/pluginIO";
import type { InstalledPlugin } from "@/core/types/plugins";
import { FiTrash2, FiDownload } from "solid-icons/fi";

export function PluginsPanel() {
  const handleInstall = async (e: { currentTarget: HTMLInputElement }) => {
    const input = e.currentTarget;
    const file = input.files?.[0] ?? null;
    input.value = "";
    if (!file) return;
    try {
      const manifest = await importPlugin(await file.arrayBuffer());
      await pluginsStore.install(manifest);
      const perms = manifest.permissions.length
        ? manifest.permissions.join(", ")
        : "none";
      toast.success(`Installed "${manifest.name}". Requested access: ${perms}.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleExport = async (manifest: InstalledPlugin) => {
    try {
      const file = await exportPlugin(manifest);
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleUninstall = async (manifest: InstalledPlugin) => {
    try {
      await pluginsStore.uninstall(manifest.id);
      toast.success(`Uninstalled "${manifest.name}".`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Flex direction={"col"} class="gap-2 w-full overflow-y-auto">
      <PanelLabel>Plugins</PanelLabel>
      <Flex direction={"col"} class="px-4 gap-4">
        <Flex direction={"col"} class="gap-2">
          <Text variant={"bodySm"} color={"muted"}>
            Install a plugin bundle (.plugin.json). Installed plugins can be
            enabled and configured per story from the in-game Plugins panel.
          </Text>
          <label class="btn btn-primary w-fit">
            <Text class="text-primary-content">Install Plugin…</Text>
            <input
              type="file"
              class="hidden"
              accept=".zip,.json,application/zip,application/json"
              onChange={handleInstall}
            />
          </label>
        </Flex>

        <div class="divider my-0" />

        <Show
          when={pluginsStore.installed.length > 0}
          fallback={
            <Text variant={"bodySm"} color={"subtle"}>
              No plugins installed yet.
            </Text>
          }
        >
          <Flex direction={"col"} class="gap-3">
            <For each={pluginsStore.installed}>
              {(plugin) => (
                <div class="rounded-lg border border-base-300 bg-base-100 p-4">
                  <Flex class="items-start justify-between gap-2">
                    <div class="min-w-0">
                      <Text weight={"bold"} truncate>
                        {plugin.name}{" "}
                        <Text as="span" color={"subtle"} variant={"caption"}>
                          v{plugin.version}
                          {plugin.author ? ` · ${plugin.author}` : ""}
                        </Text>
                      </Text>
                      <Show when={plugin.description}>
                        <Text variant={"bodySm"} color={"muted"} clamp={2}>
                          {plugin.description}
                        </Text>
                      </Show>
                    </div>
                    <Flex class="gap-1 shrink-0">
                      <button
                        class="btn btn-ghost btn-sm btn-square"
                        title="Export"
                        onClick={() => handleExport(plugin)}
                      >
                        <FiDownload />
                      </button>
                      <button
                        class="btn btn-ghost btn-sm btn-square text-error"
                        title="Uninstall"
                        onClick={() => handleUninstall(plugin)}
                      >
                        <FiTrash2 />
                      </button>
                    </Flex>
                  </Flex>
                  <Show when={plugin.permissions.length > 0}>
                    <Flex class="gap-1 flex-wrap mt-2">
                      <For each={plugin.permissions}>
                        {(perm) => (
                          <span class="badge badge-sm badge-ghost">{perm}</span>
                        )}
                      </For>
                    </Flex>
                  </Show>
                </div>
              )}
            </For>
          </Flex>
        </Show>
      </Flex>
    </Flex>
  );
}
