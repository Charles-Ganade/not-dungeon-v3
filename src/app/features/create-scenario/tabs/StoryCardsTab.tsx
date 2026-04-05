import { StoryCardsGrid, Text } from "@/app/components";
import { cn } from "@/utils";
import { BsViewStacked } from "solid-icons/bs";
import { FiDownload, FiGrid, FiList, FiSearch, FiUpload } from "solid-icons/fi";
import { createMemo, createSignal } from "solid-js";
import { useCreateScenario } from "../context";
import { makeDefaultStoryCard } from "@/core/defaults";
import { importStoryCards, exportStoryCards } from "@/core/utils/storyCardIO";
import { toast } from "solid-sonner";
import { unwrap } from "solid-js/store";

export function StoryCardsTab() {
  const { newScenario, setNewScenario } = useCreateScenario();
  const [search, setSearch] = createSignal("");
  const [viewType, setViewType] = createSignal<"grid" | "stack" | "list">(
    "grid",
  );

  const filteredStoryCards = createMemo(() => {
    const query = search().toLowerCase().trim();
    const cards = () => [...newScenario.storyCards];
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
        setNewScenario("storyCards", (c) => [...c, ...cards]);
      } catch (err) {
        toast.error((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const file = exportStoryCards(unwrap(newScenario.storyCards));
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="tab-content bg-base-200 p-2 lg:p-6">
      <div class="flex flex-col gap-4 px-2 lg:px-8">
        <div class="flex gap-2 h-fit">
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
        <StoryCardsGrid
          storyCards={filteredStoryCards()}
          viewType={viewType()}
          onDelete={(card) =>
            setNewScenario("storyCards", (cards) =>
              cards.filter((c) => c.id !== card.id),
            )
          }
          onSave={(card) => {
            const index = newScenario.storyCards.findIndex(
              (item) => item.id === card.id,
            );
            if (index !== -1) {
              setNewScenario("storyCards", index, card);
            } else
              setNewScenario("storyCards", newScenario.storyCards.length, card);
          }}
          onDuplicate={(card) => {
            const { id, ...other } = card;
            setNewScenario(
              "storyCards",
              newScenario.storyCards.length,
              makeDefaultStoryCard(other),
            );
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
  );
}
