import { Flex, Text } from "@/app/components";
import { For, Show } from "solid-js";
import { pluginsStore, sessionStore } from "@/store";
import type {
  EnabledPlugin,
  InstalledPlugin,
  PluginConfigField,
} from "@/core/types/plugins";

function getEnabled(pluginId: string): EnabledPlugin | undefined {
  return sessionStore.story?.enabledPlugins?.find((e) => e.pluginId === pluginId);
}

/** Inserts or updates a story's opt-in record for a plugin, then persists. */
function upsertEnabled(
  plugin: InstalledPlugin,
  patch: Partial<EnabledPlugin>,
): void {
  const story = sessionStore.story;
  if (!story) return;

  const list = [...(story.enabledPlugins ?? [])];
  const idx = list.findIndex((e) => e.pluginId === plugin.id);
  const base: EnabledPlugin =
    idx >= 0
      ? list[idx]
      : { pluginId: plugin.id, version: plugin.version, enabled: false, config: {} };

  const next: EnabledPlugin = {
    ...base,
    ...patch,
    config: { ...base.config, ...(patch.config ?? {}) },
  };

  if (idx >= 0) list[idx] = next;
  else list.push(next);

  sessionStore.setEnabledPlugins(list);
}

function ConfigFieldInput(props: {
  plugin: InstalledPlugin;
  field: PluginConfigField;
}) {
  const value = () => {
    const stored = getEnabled(props.plugin.id)?.config?.[props.field.key];
    return stored !== undefined ? stored : props.field.default;
  };
  const set = (v: unknown) =>
    upsertEnabled(props.plugin, { config: { [props.field.key]: v } });

  return (
    <label class="flex items-center justify-between gap-4">
      <Text variant={"bodySm"} class="flex flex-col">
        <span>{props.field.label}</span>
        <Show when={props.field.description}>
          <Text as="span" variant={"caption"} color={"subtle"}>
            {props.field.description}
          </Text>
        </Show>
      </Text>

      <Show when={props.field.type === "string"}>
        <input
          type="text"
          class="input input-sm w-48"
          value={String(value() ?? "")}
          onInput={(e) => set(e.currentTarget.value)}
        />
      </Show>
      <Show when={props.field.type === "number"}>
        <input
          type="number"
          class="input input-sm w-28"
          value={Number(value() ?? 0)}
          onInput={(e) => set(Number(e.currentTarget.value))}
        />
      </Show>
      <Show when={props.field.type === "boolean"}>
        <input
          type="checkbox"
          class="checkbox checkbox-sm checkbox-primary"
          checked={Boolean(value())}
          onChange={(e) => set(e.currentTarget.checked)}
        />
      </Show>
      <Show when={props.field.type === "select"}>
        <select
          class="select select-sm w-48"
          value={String(value() ?? "")}
          onChange={(e) => set(e.currentTarget.value)}
        >
          <For each={props.field.options ?? []}>
            {(opt) => <option value={opt}>{opt}</option>}
          </For>
        </select>
      </Show>
    </label>
  );
}

export function PluginsPanel() {
  return (
    <Flex direction={"col"} class="gap-3 w-full p-4 overflow-y-auto">
      <Text variant={"h5"} weight={"bold"}>
        Plugins
      </Text>

      <Show
        when={pluginsStore.installed.length > 0}
        fallback={
          <Text variant={"bodySm"} color={"subtle"}>
            No plugins installed. Install one from Settings → Plugins, then enable
            it here.
          </Text>
        }
      >
        <For each={pluginsStore.installed}>
          {(plugin) => (
            <div class="rounded-lg border border-base-300 bg-base-100 p-4">
              <label class="flex items-start justify-between gap-3 cursor-pointer">
                <div class="min-w-0">
                  <Text weight={"bold"} truncate>
                    {plugin.name}{" "}
                    <Text as="span" color={"subtle"} variant={"caption"}>
                      v{plugin.version}
                    </Text>
                  </Text>
                  <Show when={plugin.description}>
                    <Text variant={"bodySm"} color={"muted"} clamp={2}>
                      {plugin.description}
                    </Text>
                  </Show>
                </div>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  checked={getEnabled(plugin.id)?.enabled ?? false}
                  onChange={(e) =>
                    upsertEnabled(plugin, { enabled: e.currentTarget.checked })
                  }
                />
              </label>

              <Show
                when={
                  (getEnabled(plugin.id)?.enabled ?? false) &&
                  (plugin.configSchema?.length ?? 0) > 0
                }
              >
                <Flex direction={"col"} class="gap-2 mt-3 pt-3 border-t border-base-300">
                  <For each={plugin.configSchema}>
                    {(field) => (
                      <ConfigFieldInput plugin={plugin} field={field} />
                    )}
                  </For>
                </Flex>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </Flex>
  );
}
