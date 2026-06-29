import { For, Show } from "solid-js";
import { Flex } from "@/app/components/primitives/Stack";
import { Text } from "@/app/components/primitives/Text";
import { pluginsStore } from "@/store";
import type {
  EnabledPlugin,
  InstalledPlugin,
  PluginConfigField,
} from "@/core/types/plugins";

interface PluginConfigEditorProps {
  /** The current opt-in records (per story or per scenario). */
  enabledPlugins: EnabledPlugin[];
  /** Called with the full replacement list whenever something changes. */
  onChange: (next: EnabledPlugin[]) => void;
  /** Shown when no plugins are installed. */
  emptyHint?: string;
}

/**
 * Reusable list of installed plugins with an enable toggle and config inputs
 * auto-generated from each plugin's `configSchema`. Stateless — it reads the
 * current `enabledPlugins` and emits a full replacement via `onChange`, so it
 * works against any store (the play session or a scenario form).
 */
export function PluginConfigEditor(props: PluginConfigEditorProps) {
  const getEnabled = (pluginId: string): EnabledPlugin | undefined =>
    props.enabledPlugins.find((e) => e.pluginId === pluginId);

  const upsert = (plugin: InstalledPlugin, patch: Partial<EnabledPlugin>) => {
    const list = [...props.enabledPlugins];
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
    props.onChange(list);
  };

  const ConfigField = (fieldProps: {
    plugin: InstalledPlugin;
    field: PluginConfigField;
  }) => {
    const value = () => {
      const stored = getEnabled(fieldProps.plugin.id)?.config?.[fieldProps.field.key];
      return stored !== undefined ? stored : fieldProps.field.default;
    };
    const set = (v: unknown) =>
      upsert(fieldProps.plugin, { config: { [fieldProps.field.key]: v } });

    return (
      <label class="flex items-center justify-between gap-4">
        <Text variant={"bodySm"} class="flex flex-col">
          <span>{fieldProps.field.label}</span>
          <Show when={fieldProps.field.description}>
            <Text as="span" variant={"caption"} color={"subtle"}>
              {fieldProps.field.description}
            </Text>
          </Show>
        </Text>

        <Show when={fieldProps.field.type === "string"}>
          <input
            type="text"
            class="input input-sm w-48"
            value={String(value() ?? "")}
            onInput={(e) => set(e.currentTarget.value)}
          />
        </Show>
        <Show when={fieldProps.field.type === "number"}>
          <input
            type="number"
            class="input input-sm w-28"
            value={Number(value() ?? 0)}
            onInput={(e) => set(Number(e.currentTarget.value))}
          />
        </Show>
        <Show when={fieldProps.field.type === "boolean"}>
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary"
            checked={Boolean(value())}
            onChange={(e) => set(e.currentTarget.checked)}
          />
        </Show>
        <Show when={fieldProps.field.type === "select"}>
          <select
            class="select select-sm w-48"
            value={String(value() ?? "")}
            onChange={(e) => set(e.currentTarget.value)}
          >
            <For each={fieldProps.field.options ?? []}>
              {(opt) => <option value={opt}>{opt}</option>}
            </For>
          </select>
        </Show>
      </label>
    );
  };

  return (
    <Show
      when={pluginsStore.installed.length > 0}
      fallback={
        <Text variant={"bodySm"} color={"subtle"}>
          {props.emptyHint ??
            "No plugins installed. Install one from Settings → Plugins."}
        </Text>
      }
    >
      <Flex direction={"col"} class="gap-3">
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
                    upsert(plugin, { enabled: e.currentTarget.checked })
                  }
                />
              </label>

              <Show
                when={
                  (getEnabled(plugin.id)?.enabled ?? false) &&
                  (plugin.configSchema?.length ?? 0) > 0
                }
              >
                <Flex
                  direction={"col"}
                  class="gap-2 mt-3 pt-3 border-t border-base-300"
                >
                  <For each={plugin.configSchema}>
                    {(field) => <ConfigField plugin={plugin} field={field} />}
                  </For>
                </Flex>
              </Show>
            </div>
          )}
        </For>
      </Flex>
    </Show>
  );
}
