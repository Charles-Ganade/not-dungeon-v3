import { Text } from "@/app/components";
import { createMemo, createSignal, For, Show } from "solid-js";
import { FiDownload, FiEdit, FiX } from "solid-icons/fi";
import { useCreateScenario } from "../context";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";
import { makeDefaultScenario } from "@/core/defaults";
import { importScenario } from "@/core/utils/scenarioIO";
import { toast } from "solid-sonner";

export function DetailsTab() {
  const { newScenario, setNewScenario, thumbBlob, setThumbBlob } =
    useCreateScenario();
  const [newTag, setNewTag] = createSignal("");

  const thumbUrl = createMemo(() =>
    thumbBlob() ? URL.createObjectURL(thumbBlob()!) : null,
  );

  const handleFile = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files;

    if (!files || files.length === 0) return;

    const file = files[0];
    setThumbBlob(file);
  };

  const handleImport = (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const scenario = importScenario(reader.result as string);
        setNewScenario(makeDefaultScenario(scenario));
      } catch (err) {
        toast.error((err as Error).message);
      }
    };
    reader.readAsText(file);
  };
  return (
    <div class="tab-content bg-base-100">
      <figure class="group w-full h-64 relative overflow-hidden bg-secondary  ">
        <Show when={thumbUrl()}>
          <img src={thumbUrl()!} class="w-full h-full object-cover" />
        </Show>
        <div class="absolute inset-0 bg-base-300/20 flex items-center justify-center gap-2">
          <label
            class="btn btn-lg btn-circle btn-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <Text>
              <FiEdit />
            </Text>
            <input
              type="file"
              class="hidden"
              onInput={handleFile}
              accept="image/*"
            />
          </label>
        </div>
      </figure>

      <div class="flex flex-col gap-4 p-6 bg-base-200">
        <div class="w-full flex flex-col gap-1">
          <Text variant={"bodySm"} weight={"bold"}>
            Name
          </Text>
          <input
            type="text"
            class="input w-full"
            placeholder="Scenario Name"
            value={newScenario.name}
            onInput={({ currentTarget }) =>
              setNewScenario("name", currentTarget.value)
            }
          />
        </div>
        <div class="w-full flex flex-col gap-1">
          <Text variant={"bodySm"} weight={"bold"}>
            Description
          </Text>
          <TextareaAutosize
            class="textarea w-full h-32 resize-none"
            value={newScenario.description}
            // @ts-ignore
            onInput={({ currentTarget }) => {
              setNewScenario("description", currentTarget.value);
            }}
          />
        </div>
        <div class="w-full flex flex-col gap-1">
          <Text variant={"bodySm"} weight={"bold"}>
            Tags
          </Text>
          <div class="join">
            <input
              type="text"
              class="input w-full join-item"
              placeholder="Use Comma or Enter to separate tags"
              value={newTag()}
              onInput={({ currentTarget }) => setNewTag(currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  const value = newTag().trim();
                  if (!value) return;
                  setNewScenario(
                    "tags",
                    newScenario.tags.length,
                    newTag().toLowerCase(),
                  );
                  setNewTag("");
                }
              }}
            />
          </div>
        </div>
        <Show when={newScenario.tags.length > 0}>
          <div class="w-full flex flex-wrap gap-1">
            <For each={newScenario.tags}>
              {(tag) => (
                <span class="badge badge-lg badge-accent rounded-full">
                  <button
                    class="cursor-pointer"
                    onClick={() => {
                      setNewScenario("tags", (tags) =>
                        tags.filter((t) => t !== tag),
                      );
                    }}
                  >
                    <FiX />
                  </button>
                  {tag}
                </span>
              )}
            </For>
          </div>
        </Show>
        <div class="w-full flex justify-end">
          <label class="btn btn-primary btn-large">
            <input
              type="file"
              accept=".json"
              class="hidden"
              onChange={handleImport}
            />
            <Text>
              <FiDownload />
            </Text>
            <Text>Import</Text>
          </label>
        </div>
      </div>
    </div>
  );
}
