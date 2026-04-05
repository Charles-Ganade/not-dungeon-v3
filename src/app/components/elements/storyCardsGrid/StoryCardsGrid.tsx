import { EditStoryCardModal } from "@/app/shared/EditStoryCardModal";
import { makeDefaultStoryCard } from "@/core/defaults";
import { StoryCard } from "@/core/types";
import { cn } from "@/utils";
import { FiPlus } from "solid-icons/fi";
import { createSignal, For, splitProps } from "solid-js";
import { Text } from "../../primitives/Text";
import { StoryCardEntry } from "../storyCardEntry";
import { StoryCardsGridContext } from "./StoryCardsGridContext";

interface StoryCardsGridProps {
  viewType: "grid" | "stack" | "list";
  onDelete: (card: StoryCard) => void;
  onDuplicate: (card: StoryCard) => void;
  onSave: (card: StoryCard) => void;
  storyCards: StoryCard[];
}

export function StoryCardsGrid(props: StoryCardsGridProps) {
  const [createModalOpen, setCreateModalOpen] = createSignal(false);
  const [_, other] = splitProps(props, ["storyCards"]);
  return (
    <StoryCardsGridContext.Provider value={other}>
      <div
        class={cn(
          "grid w-full gap-2",
          props.viewType === "grid"
            ? "grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] auto-rows-[16rem]"
            : props.viewType === "stack"
              ? "auto-rows-[12rem]"
              : "auto-rows-[6rem]",
        )}
      >
        <button
          class="btn btn-soft btn-accent btn-block btn-xl h-full items-center justify-center flex-col"
          onClick={() => {
            setCreateModalOpen(true);
          }}
        >
          <Text variant={"h1"} weight={"bold"} class="h-fit text-inherit">
            <FiPlus />
          </Text>
          <Text
            variant={"h5"}
            weight={"semibold"}
            class="text-inherit h-fit flex-none"
          >
            Add Story Card
          </Text>
        </button>
        <For each={props.storyCards.sort((a, b) => b.updatedAt - a.updatedAt)}>
          {(card) => <StoryCardEntry viewType={props.viewType} card={card} />}
        </For>
      </div>
      <EditStoryCardModal
        open={createModalOpen()}
        onClose={() => {
          setCreateModalOpen(false);
        }}
      />
    </StoryCardsGridContext.Provider>
  );
}
