import { Flex, Text, CodeEditor } from "@/app/components";
import { createStore, unwrap } from "solid-js/store";
import { createMemo, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { toast } from "solid-sonner";
import { pluginsStore } from "@/store";
import { validatePluginManifest } from "@/core/utils/pluginIO";
import {
  inputHookContext,
  buildContextHookContext,
  outputHookContext,
} from "@/core/types";
import type {
  PluginManifest,
  PluginCapability,
  PluginConfigField,
} from "@/core/types/plugins";
import { FiArrowLeft, FiSave, FiTrash2, FiPlus } from "solid-icons/fi";

const CAPABILITIES: PluginCapability[] = [
  "ai",
  "kvMemory",
  "memories",
  "storyCards",
  "network",
];

const FIELD_TYPES: PluginConfigField["type"][] = [
  "string",
  "number",
  "boolean",
  "select",
];

interface PluginEditorFormProps {
  initial: PluginManifest;
  mode: "create" | "edit";
}

export function PluginEditorForm(props: PluginEditorFormProps) {
  const navigate = useNavigate();
  const [manifest, setManifest] = createStore<PluginManifest>(
    structuredClone(unwrap(props.initial)),
  );

  const canSave = createMemo(
    () =>
      manifest.id.trim() !== "" &&
      manifest.name.trim() !== "" &&
      manifest.version.trim() !== "",
  );

  const togglePermission = (cap: PluginCapability, on: boolean) =>
    setManifest("permissions", (prev) =>
      on ? [...new Set([...prev, cap])] : prev.filter((p) => p !== cap),
    );

  const addField = () =>
    setManifest("configSchema", (prev) => [
      ...(prev ?? []),
      { key: "", label: "", type: "string" } as PluginConfigField,
    ]);

  const removeField = (index: number) =>
    setManifest("configSchema", (prev) =>
      (prev ?? []).filter((_, i) => i !== index),
    );

  const setField = (index: number, patch: Partial<PluginConfigField>) =>
    setManifest("configSchema", index, (prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    try {
      const validated = validatePluginManifest(unwrap(manifest));
      if (
        props.mode === "create" &&
        pluginsStore.installed.some((p) => p.id === validated.id)
      ) {
        toast.error(`A plugin with id "${validated.id}" already exists.`);
        return;
      }
      await pluginsStore.install(validated);
      toast.success(`Saved plugin "${validated.name}".`);
      navigate(-1);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Flex justify={"center"} class="flex-1 grow gap-0 overflow-x-hidden min-h-0">
      <Flex
        direction={"col"}
        class="w-full max-w-4xl gap-4 p-6 overflow-y-auto min-h-0"
      >
        <Flex align={"center"} justify={"between"} class="border-b py-2">
          <div class="flex items-center gap-4">
            <button class="btn" onClick={() => navigate(-1)}>
              <Text variant={"h5"} class="text-inherit">
                <FiArrowLeft />
              </Text>
            </button>
            <Text variant={"h3"}>
              {props.mode === "edit" ? "Edit Plugin" : "Create Plugin"}
            </Text>
          </div>
          <button
            class="btn btn-primary"
            disabled={!canSave()}
            onClick={handleSave}
          >
            <Text variant={"h5"} class="text-inherit">
              <FiSave />
            </Text>
            <Text class="text-inherit">Save</Text>
          </button>
        </Flex>

        {/* Metadata */}
        <Flex direction={"col"} class="gap-3">
          <Text weight={"bold"}>Manifest</Text>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1">
              <Text variant={"bodySm"} color={"muted"}>
                ID (unique, e.g. com.author.dice)
              </Text>
              <input
                type="text"
                class="input w-full"
                disabled={props.mode === "edit"}
                value={manifest.id}
                onInput={(e) => setManifest("id", e.currentTarget.value)}
              />
            </label>
            <label class="flex flex-col gap-1">
              <Text variant={"bodySm"} color={"muted"}>
                Name
              </Text>
              <input
                type="text"
                class="input w-full"
                value={manifest.name}
                onInput={(e) => setManifest("name", e.currentTarget.value)}
              />
            </label>
            <label class="flex flex-col gap-1">
              <Text variant={"bodySm"} color={"muted"}>
                Version
              </Text>
              <input
                type="text"
                class="input w-full"
                value={manifest.version}
                onInput={(e) => setManifest("version", e.currentTarget.value)}
              />
            </label>
            <label class="flex flex-col gap-1">
              <Text variant={"bodySm"} color={"muted"}>
                Author
              </Text>
              <input
                type="text"
                class="input w-full"
                value={manifest.author ?? ""}
                onInput={(e) => setManifest("author", e.currentTarget.value)}
              />
            </label>
          </div>
          <label class="flex flex-col gap-1">
            <Text variant={"bodySm"} color={"muted"}>
              Description
            </Text>
            <textarea
              class="textarea w-full h-20 resize-none"
              value={manifest.description ?? ""}
              onInput={(e) => setManifest("description", e.currentTarget.value)}
            />
          </label>
        </Flex>

        {/* Permissions */}
        <Flex direction={"col"} class="gap-2">
          <Text weight={"bold"}>Permissions</Text>
          <Text variant={"caption"} color={"subtle"}>
            Capabilities this plugin requests; shown to users at install.
          </Text>
          <Flex class="gap-4 flex-wrap">
            <For each={CAPABILITIES}>
              {(cap) => (
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm checkbox-primary"
                    checked={manifest.permissions.includes(cap)}
                    onChange={(e) => togglePermission(cap, e.currentTarget.checked)}
                  />
                  <Text variant={"bodySm"}>{cap}</Text>
                </label>
              )}
            </For>
          </Flex>
        </Flex>

        {/* Config schema */}
        <Flex direction={"col"} class="gap-2">
          <Flex align={"center"} justify={"between"}>
            <Text weight={"bold"}>Config fields</Text>
            <button class="btn btn-sm" onClick={addField}>
              <FiPlus /> <Text variant={"bodySm"}>Add field</Text>
            </button>
          </Flex>
          <For each={manifest.configSchema}>
            {(field, i) => (
              <div class="rounded-lg border border-base-300 p-3 flex flex-col gap-2">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    class="input input-sm"
                    placeholder="key"
                    value={field.key}
                    onInput={(e) => setField(i(), { key: e.currentTarget.value })}
                  />
                  <input
                    type="text"
                    class="input input-sm"
                    placeholder="label"
                    value={field.label}
                    onInput={(e) => setField(i(), { label: e.currentTarget.value })}
                  />
                  <select
                    class="select select-sm"
                    value={field.type}
                    onChange={(e) =>
                      setField(i(), {
                        type: e.currentTarget.value as PluginConfigField["type"],
                        default: undefined,
                      })
                    }
                  >
                    <For each={FIELD_TYPES}>
                      {(t) => <option value={t}>{t}</option>}
                    </For>
                  </select>
                  <button
                    class="btn btn-sm btn-ghost btn-square text-error self-center"
                    title="Remove field"
                    onClick={() => removeField(i())}
                  >
                    <FiTrash2 />
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  {/* type-aware default */}
                  <label class="flex items-center gap-2">
                    <Text variant={"caption"} color={"subtle"} class="w-16">
                      default
                    </Text>
                    <Show when={field.type === "boolean"}>
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        checked={Boolean(field.default)}
                        onChange={(e) =>
                          setField(i(), { default: e.currentTarget.checked })
                        }
                      />
                    </Show>
                    <Show when={field.type === "number"}>
                      <input
                        type="number"
                        class="input input-sm w-full"
                        value={Number(field.default ?? 0)}
                        onInput={(e) =>
                          setField(i(), { default: Number(e.currentTarget.value) })
                        }
                      />
                    </Show>
                    <Show when={field.type === "string" || field.type === "select"}>
                      <input
                        type="text"
                        class="input input-sm w-full"
                        value={String(field.default ?? "")}
                        onInput={(e) =>
                          setField(i(), { default: e.currentTarget.value })
                        }
                      />
                    </Show>
                  </label>

                  <Show
                    when={field.type === "select"}
                    fallback={
                      <input
                        type="text"
                        class="input input-sm"
                        placeholder="description (optional)"
                        value={field.description ?? ""}
                        onInput={(e) =>
                          setField(i(), { description: e.currentTarget.value })
                        }
                      />
                    }
                  >
                    <input
                      type="text"
                      class="input input-sm"
                      placeholder="options (comma separated)"
                      value={(field.options ?? []).join(",")}
                      onInput={(e) =>
                        setField(i(), {
                          options: e.currentTarget.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Show>
                </div>
              </div>
            )}
          </For>
        </Flex>

        {/* Hooks */}
        <Flex direction={"col"} class="gap-2">
          <Text weight={"bold"}>Hooks</Text>
          <div class="tabs tabs-lift">
            <label class="tab">
              <input type="radio" name="plugin-hooks-tab" checked />
              <Text class="text-inherit">input.js</Text>
            </label>
            <div class="tab-content bg-base-100 border-base-300 border-t-0 p-4">
              <CodeEditor
                name="input"
                value={manifest.hooks.input}
                onChange={(v) => setManifest("hooks", "input", v)}
                sharedLib={manifest.hooks.library}
                sharedLibPath="library.js"
                ambientTypes={inputHookContext}
                class="w-full min-h-96"
              />
            </div>

            <label class="tab">
              <input type="radio" name="plugin-hooks-tab" />
              <Text class="text-inherit">buildContext.js</Text>
            </label>
            <div class="tab-content bg-base-100 border-base-300 border-t-0 p-4">
              <CodeEditor
                name="buildContext"
                value={manifest.hooks.buildContext}
                onChange={(v) => setManifest("hooks", "buildContext", v)}
                sharedLib={manifest.hooks.library}
                sharedLibPath="library.js"
                ambientTypes={buildContextHookContext}
                class="w-full min-h-96"
              />
            </div>

            <label class="tab">
              <input type="radio" name="plugin-hooks-tab" />
              <Text class="text-inherit">output.js</Text>
            </label>
            <div class="tab-content bg-base-100 border-base-300 border-t-0 p-4">
              <CodeEditor
                name="output"
                value={manifest.hooks.output}
                onChange={(v) => setManifest("hooks", "output", v)}
                sharedLib={manifest.hooks.library}
                sharedLibPath="library.js"
                ambientTypes={outputHookContext}
                class="w-full min-h-96"
              />
            </div>

            <label class="tab">
              <input type="radio" name="plugin-hooks-tab" />
              <Text class="text-inherit">library.js</Text>
            </label>
            <div class="tab-content bg-base-100 border-base-300 border-t-0 p-4">
              <CodeEditor
                name="library"
                value={manifest.hooks.library}
                onChange={(v) => setManifest("hooks", "library", v)}
                class="w-full min-h-96"
              />
            </div>
          </div>
        </Flex>
      </Flex>
    </Flex>
  );
}
