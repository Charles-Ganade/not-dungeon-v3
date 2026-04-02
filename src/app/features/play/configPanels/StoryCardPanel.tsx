import { StoryCardsGrid, Text } from "@/app/components";
import { usePlay } from "../context";
import { FiDownload, FiGrid, FiList, FiSearch, FiUpload } from "solid-icons/fi";
import { createMemo, createSignal } from "solid-js";
import { cn } from "@/utils";
import { BsViewStacked } from "solid-icons/bs";
import { makeDefaultStoryCard } from "@/core/defaults";
import { sessionStore } from "@/store";
import { unwrap } from "solid-js/store";
import { importStoryCards, exportStoryCards } from "@/core/utils/storyCardIO";
import { toast } from "solid-sonner";

export function StoryCardPanel() {
  const {} = usePlay();
  const [search, setSearch] = createSignal("");
  const [viewType, setViewType] = createSignal<"grid" | "stack" | "list">(
    "grid",
  );

  const filteredStoryCards = createMemo(() => {
    const query = search().toLowerCase().trim();
    sessionStore.story?.storyCards.forEach((v) => v);
    const cards = () => [...(unwrap(sessionStore.story?.storyCards) ?? [])];
    const filtered = !query
      ? cards()
      : cards().filter((card) => {
          const inTitle = card.title.toLowerCase().includes(query);
          const inTags = card.tags.some((tag) =>
            tag.toLowerCase().includes(query),
          );

          return inTitle || inTags;
        });

    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const handleImport = (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cards = importStoryCards(reader.result as string);
        sessionStore.addStoryCard(cards);
      } catch (err) {
        toast.error((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const file = exportStoryCards(unwrap(sessionStore.story?.storyCards) ?? []);
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="flex flex-1 flex-col gap-2 p-4 min-h-0">
      <div class="w-full pb-2">
        <Text variant={"h4"} class="leading-none font-bold">
          Story Cards
        </Text>
      </div>
      <div class="flex flex-col gap-4 flex-1">
        <div class="flex gap-2 h-fit w-full">
          <label class="input flex-1">
            <FiSearch />
            <input
              type="text"
              placeholder="Search by card title or card-tags"
              value={search()}
              onInput={({ currentTarget }) => setSearch(currentTarget.value)}
            />
          </label>
          <div class="join">
            <button
              class={cn(
                "join-item btn btn-accent btn-outline",
                viewType() === "grid" && "btn-active",
              )}
              onClick={() => {
                setViewType("grid");
              }}
            >
              <Text class="text-inherit">
                <FiGrid />
              </Text>
            </button>
            <button
              class={cn(
                "join-item btn btn-accent btn-outline",
                viewType() === "stack" && "btn-active",
              )}
              onClick={() => {
                setViewType("stack");
              }}
            >
              <Text class="text-inherit">
                <BsViewStacked />
              </Text>
            </button>
            <button
              class={cn(
                "join-item btn btn-accent btn-outline",
                viewType() === "list" && "btn-active",
              )}
              onClick={() => {
                setViewType("list");
              }}
            >
              <Text class="text-inherit">
                <FiList />
              </Text>
            </button>
          </div>
        </div>
        <div class="flex-1 relative">
          <div class="absolute inset-0 overflow-y-auto flex flex-col gap-4">
            <StoryCardsGrid
              storyCards={filteredStoryCards()}
              viewType={viewType()}
              onDelete={(card) => {
                sessionStore.removeStoryCard(card.id);
              }}
              onSave={(card) => {
                const index = sessionStore.story!.storyCards.findIndex(
                  (item) => item.id === card.id,
                );
                if (index !== -1) {
                  sessionStore.editStoryCard(card.id, card);
                } else sessionStore.addStoryCard(card);
              }}
              onDuplicate={(card) => {
                const { id, ...other } = card;
                sessionStore.addStoryCard(makeDefaultStoryCard(other));
              }}
            />
            <div class="flex gap-2 justify-end mt-2">
              <label class="btn btn-soft btn-error">
                <Text>
                  <FiDownload />
                </Text>
                <Text class="uppercase">Import</Text>
                <input
                  type="file"
                  class="hidden"
                  accept=".json"
                  onInput={handleImport}
                />
              </label>
              <button class="btn btn-soft" onClick={handleExport}>
                <Text>
                  <FiUpload />
                </Text>
                <Text class="uppercase">Export</Text>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
