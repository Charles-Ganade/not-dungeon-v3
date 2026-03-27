import { Scenario, Story, StoryCard } from "@/core/types";
import { Modal, Text, useStoryCardsGrid } from "../components";
import { createStore } from "solid-js/store";
import { BsThreeDots } from "solid-icons/bs";
import { FiCopy, FiDelete, FiSave, FiX } from "solid-icons/fi";
import { makeDefaultStoryCard } from "@/core/defaults";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { isEqual } from "lodash";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";
import { HiOutlineSparkles, HiSolidSparkles } from "solid-icons/hi";
import { generateStoryCard } from "@/core/engine/story_card_generator";
import { configStore, sessionStore, settingsStore } from "@/store";
import { toast } from "solid-sonner";
interface EditStoryCardModalProps {
  open: boolean;
  onClose: () => void;
  card?: StoryCard;
  base?: Scenario | Story;
}
const defaultCard = {
  title: "New Card",
  content: "",
  tags: [],
  triggers: [],
  enabled: true,
};
export function EditStoryCardModal(props: EditStoryCardModalProps) {
  const { onDelete, onDuplicate, onSave, scenario } = useStoryCardsGrid();
  const [openDelete, setOpenDelete] = createSignal(false);
  const [card, setCard] = createStore<
    | (Pick<StoryCard, "title" | "content" | "tags" | "enabled" | "triggers"> &
        Partial<StoryCard>)
    | StoryCard
  >(props.card ? { ...props.card } : { ...defaultCard });
  const [tags, setTags] = createSignal("");
  const [triggers, setTriggers] = createSignal("");
  const [isDisabled, setDisabled] = createSignal(false);

  createEffect(() => {
    const isOpen = props.open;
    const incomingCard = props.card;

    if (!isOpen) return;

    if (incomingCard) {
      setCard({ ...incomingCard });
    } else {
      reset();
    }
  });

  const isEdited = createMemo(() =>
    !props.card ? true : !isEqual(props.card, card),
  );

  const isSaveDisabled = createMemo(() =>
    [
      card.content.trim() !== "",
      card.title.trim() !== "",
      card.triggers.length > 0,
      isEdited(),
    ].some((v) => v === false),
  );

  const reset = () => {
    setCard({ ...defaultCard });
    setTags("");
    setTriggers("");
  };

  const handleSave = () => {
    props.onClose();
    onSave(makeDefaultStoryCard({ ...card, updatedAt: Date.now() }));
    reset();
  };

  const handleClose = () => {
    reset();
    props.onClose();
  };

  const handleDelete = () => {
    if (props.card) return onDelete(props.card);
    handleClose();
  };

  const handleDuplicate = () => {
    if (props.card) {
      onDuplicate(makeDefaultStoryCard(card));
      handleClose();
    }
  };

  const handleGenerateCard = async () => {
    try {
      setDisabled(true);
      const config = configStore.config ?? {
        ...settingsStore.settings.API,
        params: settingsStore.settings.Parameters,
        prompts: settingsStore.settings.Prompts,
        authorNotes: "",
      };
      let prom;
      if (scenario) {
        prom = generateStoryCard({
          targetTitle: card.title,
          config: config,
          context: {
            type: "scenario",
            scenario,
          },
        });
      } else {
        if (!sessionStore.story) throw new Error("No session in play.");
        prom = generateStoryCard({
          targetTitle: card.title,
          config: configStore.config!,
          context: {
            type: "session",
            story: sessionStore.story,
            activeMemories: sessionStore.activeMemories,
            activePath: sessionStore.activePath,
          },
        });
      }
      const newCard = await prom;
      setCard(newCard);
    } catch (error) {
      toast.error(
        `Error: ${(error as any).code ?? ""} ${(error as any).message as string}`,
      );
    } finally {
      setDisabled(false);
    }
  };

  return (
    <Modal
      open={props.open}
      onClose={handleClose}
      class="p-0! flex flex-col bg-base-200 border-2 border-base-100 shadow"
      size={"md"}
    >
      <div class="flex flex-col">
        <div class="flex items-center justify-between p-4 border-b-2 border-base-100">
          <div
            class="dropdown dropdown-start"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <button
              tabIndex={0}
              role="button"
              class="btn btn-circle items-center justify-center"
              disabled={!props.card}
            >
              <BsThreeDots />
            </button>
            <ul
              tabindex={-1}
              class="dropdown-content menu bg-base-300 z-1 w-52 p-1 shadow-sm rounded-box"
            >
              <li>
                <a onClick={handleDuplicate} class="flex gap-1 items-center">
                  <Text as="span" class="text-inherit">
                    <FiCopy />
                  </Text>
                  <Text class="text-inherit">Duplicate</Text>
                </a>
              </li>
              <li>
                <a
                  onClick={() => {
                    if (props.card) setOpenDelete(true);
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
          <Text>{card.title}</Text>
          <button
            class="btn btn-primary btn-circle"
            disabled={isSaveDisabled()}
            onClick={handleSave}
          >
            <Text class="text-inherit">
              <FiSave />
            </Text>
          </button>
        </div>
        <div class="flex flex-col p-4 gap-4">
          <div class="flex flex-col gap-1">
            <Text weight={"semibold"} color={"muted"} variant={"bodySm"}>
              Title
            </Text>
            <label class="input w-full">
              <input
                type="text"
                value={card.title}
                disabled={isDisabled()}
                onInput={({ currentTarget }) => {
                  setCard("title", currentTarget.value);
                }}
              />
              <Show when={card.title.trim()}>
                <button
                  class="btn btn-ghost btn-sm btn-circle tooltip tooltip-left"
                  data-tip="Use AI to generate a story card."
                  onClick={handleGenerateCard}
                  disabled={isDisabled()}
                >
                  <Text>
                    <HiOutlineSparkles></HiOutlineSparkles>
                  </Text>
                </button>
              </Show>
            </label>
          </div>
          <div class="flex flex-col gap-1">
            <Text weight={"semibold"} color={"muted"} variant={"bodySm"}>
              Content
            </Text>
            <TextareaAutosize
              class="textarea w-full h-48 resize-none"
              disabled={isDisabled()}
              value={card.content}
              // @ts-ignore
              onInput={({ currentTarget }) => {
                setCard("content", currentTarget.value);
              }}
              maxRows={5}
            />
          </div>
          <div class="flex flex-col gap-1">
            <Text weight={"semibold"} color={"muted"} variant={"bodySm"}>
              Triggers
            </Text>
            <label class="input w-full">
              <input
                type="text"
                disabled={isDisabled()}
                value={triggers()}
                onInput={(e) => setTriggers(e.currentTarget.value)}
                placeholder="Comma separated triggers"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const value = triggers().trim().toLowerCase();
                    if (!value) return;
                    if (!card.triggers.includes(value))
                      setCard("triggers", card.triggers.length, value);
                    setTriggers("");
                  }
                }}
              />
            </label>
          </div>
          <Show when={card.triggers.length > 0}>
            <div class="flex-1 flex flex-wrap items-center gap-2">
              <For each={card.triggers}>
                {(tag) => (
                  <button
                    class="btn btn-primary btn-xs rounded-full"
                    onClick={() => {
                      setCard("triggers", (ts) => ts.filter((t) => t !== tag));
                    }}
                  >
                    <div class="flex items-center gap-1">
                      <Text variant={"bodySm"}>
                        <FiX />
                      </Text>
                      <Text variant={"bodySm"}>{tag}</Text>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <div class="flex flex-col gap-1">
            <Text weight={"semibold"} color={"muted"} variant={"bodySm"}>
              Tags
            </Text>
            <label class="input w-full">
              <input
                type="text"
                placeholder="Comma separated. ex. character, human, pet, french, etc."
                disabled={isDisabled()}
                value={tags()}
                onInput={({ currentTarget }) => {
                  setTags(currentTarget.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    let value = tags().trim();
                    if (value.startsWith("#")) {
                      value = value.replace("#", "");
                    }
                    if (!value) return;
                    if (!card.tags.includes(value))
                      setCard("tags", card.tags.length, value);
                    setTags("");
                  }
                }}
              />
            </label>
          </div>
          <Show when={card.tags.length > 0}>
            <div class="flex-1 flex flex-wrap items-center gap-2">
              <For each={card.tags}>
                {(tag) => (
                  <button
                    class="btn btn-primary btn-xs rounded-full"
                    onClick={() => {
                      setCard("tags", (ts) => ts.filter((t) => t !== tag));
                    }}
                  >
                    <div class="flex items-center gap-1">
                      <Text variant={"bodySm"}>
                        <FiX />
                      </Text>
                      <Text variant={"bodySm"}>{tag}</Text>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <div class="flex gap-1">
            <label class="flex gap-2 md-2">
              <Text color={"subtle"}>Enable Card</Text>
              <input
                class="checkbox checked:checkbox-primary duration-75"
                type="checkbox"
                disabled={isDisabled()}
                checked={card.enabled}
                onChange={({ currentTarget }) =>
                  setCard("enabled", currentTarget.checked)
                }
              />
            </label>
          </div>
        </div>
      </div>
      <Modal
        open={openDelete()}
        onClose={() => setOpenDelete(false)}
        class="p-0! flex flex-col bg-base-200 shadow"
        onClick={(e) => e.stopPropagation()}
        size={"sm"}
      >
        <div class="flex flex-col gap-4 p-6">
          <Text variant={"h4"} weight={"bold"}>
            Delete {card.title}?
          </Text>
          <div class="flex w-full gap-2">
            <button class="btn flex-1" onClick={() => setOpenDelete(false)}>
              <Text class="text-inherit">Cancel</Text>
            </button>
            <button class="btn btn-error flex-1" onClick={handleDelete}>
              <Text class="text-inherit">Delete</Text>
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
