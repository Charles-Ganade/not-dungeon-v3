import { StoryCardsGrid, Text } from "@/app/components";
import { cn } from "@/utils";
import { BsViewStacked } from "solid-icons/bs";
import { FiGrid, FiList, FiSearch } from "solid-icons/fi";
import { createMemo, createSignal } from "solid-js";
import { makeDefaultStoryCard } from "@/core/defaults";
import { useEditScenario } from "../context";

export function StoryCardsTab() {
  const { currentScenario, setCurrentScenario } = useEditScenario();
  const [search, setSearch] = createSignal("");
  const [viewType, setViewType] = createSignal<"grid" | "stack" | "list">(
    "grid",
  );

  const filteredStoryCards = createMemo(() => {
    const query = search().toLowerCase().trim();
    const cards = () => [...currentScenario.storyCards];
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
  return (
    <div class="tab-content bg-base-200 p-6">
      <div class="flex flex-col gap-4 px-8">
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
            setCurrentScenario("storyCards", (cards) =>
              cards.filter((c) => c.id !== card.id),
            )
          }
          onSave={(card) => {
            const index = currentScenario.storyCards.findIndex(
              (item) => item.id === card.id,
            );
            if (index !== -1) {
              setCurrentScenario("storyCards", index, card);
            } else
              setCurrentScenario(
                "storyCards",
                currentScenario.storyCards.length,
                card,
              );
          }}
          onDuplicate={(card) => {
            const { id, ...other } = card;
            setCurrentScenario(
              "storyCards",
              currentScenario.storyCards.length,
              makeDefaultStoryCard(other),
            );
          }}
        />
      </div>
    </div>
  );
}
