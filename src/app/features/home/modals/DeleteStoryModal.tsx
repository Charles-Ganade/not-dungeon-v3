import { Modal, Flex, Text } from "@/app/components";
import type { Story } from "@/core/types";
import { libraryStore } from "@/store";

interface DeleteStoryModalProps {
  open: boolean;
  onClose: () => void;
  story: Story;
}
export function DeleteStoryModal(props: DeleteStoryModalProps) {
  const deleteStory = async () => {
    await libraryStore.removeStory(props.story.id);
    props.onClose();
  };
  return (
    <Modal
      class="p-0! grid bg-base-200 shadow"
      open={props.open}
      onClose={props.onClose}
    >
      <Flex direction={"col"} class="p-6 gap-4">
        <Text variant={"h3"} weight={"bold"}>
          Are you sure you want to delete {props.story.name}?
        </Text>
        <Flex class="p-2">
          <button class="btn btn-lg flex-1" onClick={props.onClose}>
            <Text>Cancel</Text>
          </button>
          <button class="btn btn-error flex-1" onClick={deleteStory}>
            <Text>Delete</Text>
          </button>
        </Flex>
      </Flex>
    </Modal>
  );
}
