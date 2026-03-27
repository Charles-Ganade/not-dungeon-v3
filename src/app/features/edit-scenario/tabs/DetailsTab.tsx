import { Text } from "@/app/components";
import { createMemo, createSignal, For, Show } from "solid-js";
import { FiEdit, FiUpload, FiX } from "solid-icons/fi";
import { useEditScenario } from "../context";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";
import { exportScenario } from "@/core/utils/scenarioIO";
import { unwrap } from "solid-js/store";

export function DetailsTab() {
  const { currentScenario, setCurrentScenario, thumbBlob, setThumbBlob } =
    useEditScenario();
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

  const handleExport = () => {
    const file = exportScenario(unwrap(currentScenario));
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
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
            value={currentScenario.name}
            onInput={({ currentTarget }) =>
              setCurrentScenario("name", currentTarget.value)
            }
          />
        </div>
        <div class="w-full flex flex-col gap-1">
          <Text variant={"bodySm"} weight={"bold"}>
            Description
          </Text>
          <TextareaAutosize
            class="textarea w-full h-32 resize-none"
            value={currentScenario.description}
            // @ts-ignore
            onInput={({ currentTarget }) => {
              setCurrentScenario("description", currentTarget.value);
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
                  setCurrentScenario(
                    "tags",
                    currentScenario.tags.length,
                    newTag().toLowerCase(),
                  );
                  setNewTag("");
                }
              }}
            />
          </div>
        </div>
        <Show when={currentScenario.tags?.length > 0}>
          <div class="w-full flex flex-wrap gap-1">
            <For each={currentScenario.tags}>
              {(tag) => (
                <span class="badge badge-lg badge-accent rounded-full">
                  <button
                    class="cursor-pointer"
                    onClick={() => {
                      setCurrentScenario("tags", (tags) =>
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
          <button class="btn btn-primary btn-large" onClick={handleExport}>
            <Text>
              <FiUpload />
            </Text>
            <Text>Export</Text>
          </button>
        </div>
      </div>
    </div>
  );
}
