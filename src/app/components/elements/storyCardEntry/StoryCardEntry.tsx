import { EditStoryCardModal } from "@/app/shared/EditStoryCardModal";
import { StoryCard } from "@/core/types";
import { cn } from "@/utils";
import { BsThreeDots } from "solid-icons/bs";
import { FiEdit, FiCopy, FiDelete } from "solid-icons/fi";
import { createSignal, For } from "solid-js";
import { Text } from "../../primitives/Text";
import { useStoryCardsGrid } from "../storyCardsGrid";
import { Modal } from "../modal";

interface StoryCardEntryProps {
  viewType: "grid" | "stack" | "list";
  card: StoryCard;
}
export function StoryCardEntry(props: StoryCardEntryProps) {
  const { onDelete, onDuplicate, onSave } = useStoryCardsGrid();
  const [openEdit, setOpenEdit] = createSignal(false);
  const [openDelete, setOpenDelete] = createSignal(false);
  return (
    <div
      class="group bg-base-200 hover:bg-base-100 border-base-100 border-2  shadow hover:shadow-xl transition-shadow duration-75 ease-linear card"
      role="button"
      onClick={() => {
        setOpenEdit(true);
      }}
    >
      <div
        class={cn(
          "card-body h-full",
          props.viewType === "list" && "flex-row justify-between",
        )}
      >
        <Text variant={"h3"} weight={"bold"} class="card-title">
          {props.card.title}
        </Text>
        <Text
          class={cn(
            "flex-1 overflow-hidden relative",
            "after:content-[''] after:pointer-events-none after:absolute after:left-0 after:bottom-0",
            "after:w-full after:h-2/3 after:bg-linear-to-t after:from-base-200 after:to-transparent",
            "after:bg-linear-to-t group-hover:after:from-base-100",
            props.viewType === "list" && "hidden",
          )}
        >
          {props.card.content}
        </Text>
        <div class="card-actions items-center">
          <div class="flex-1 flex flex-wrap items-center gap-2">
            <For each={props.card.tags}>
              {(tag) => (
                <span class="badge badge-soft badge-primary">{tag}</span>
              )}
            </For>
          </div>
          <div
            class="dropdown dropdown-end"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div
              tabIndex={0}
              role="button"
              class="btn btn-circle items-center justify-center"
            >
              <BsThreeDots />
            </div>
            <ul
              tabindex={-1}
              class="dropdown-content menu bg-base-300 z-1 w-52 p-1 shadow-sm rounded-box"
            >
              <li>
                <a
                  onClick={() => {
                    setOpenEdit(true);
                  }}
                  class="flex gap-1 items-center"
                >
                  <Text as="span" class="text-inherit">
                    <FiEdit />
                  </Text>
                  <Text class="text-inherit">Edit </Text>
                </a>
              </li>
              <li>
                <a
                  onClick={() => {
                    onDuplicate(props.card);
                  }}
                  class="flex gap-1 items-center"
                >
                  <Text as="span" class="text-inherit">
                    <FiCopy />
                  </Text>
                  <Text class="text-inherit">Duplicate</Text>
                </a>
              </li>
              <li>
                <a
                  onClick={() => {
                    setOpenDelete(true);
                  }}
                  class="flex gap-1 items-center text-error"
                >
                  <Text as="span" class="text-inherit">
                    <FiDelete />
                  </Text>
                  <Text class="text-inherit">Delete</Text>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <EditStoryCardModal
        card={props.card}
        open={openEdit()}
        onClose={() => {
          setOpenEdit(false);
        }}
      />
      <Modal
        open={openDelete()}
        onClose={() => setOpenDelete(false)}
        class="p-0! flex flex-col bg-base-200 shadow"
        onClick={(e) => e.stopPropagation()}
        size={"sm"}
      >
        <div class="p-6 flex flex-col gap-4">
          <Text variant={"h4"} weight={"bold"}>
            Delete {props.card.title}?
          </Text>
          <div class="flex w-full gap-2">
            <button class="btn flex-1" onClick={() => setOpenDelete(false)}>
              <Text class="text-inherit">Cancel</Text>
            </button>
            <button
              class="btn btn-error flex-1"
              onClick={() => onDelete(props.card)}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
