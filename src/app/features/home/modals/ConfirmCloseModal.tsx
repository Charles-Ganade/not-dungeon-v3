import { Flex, Modal, Text } from "@/app/components";

interface ConfirmCloseModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation shown when closing a story modal with unsaved changes. Shared by
 * the Create and Edit story modals.
 */
export function ConfirmCloseModal(props: ConfirmCloseModalProps) {
  return (
    <Modal
      class="p-0! grid bg-base-200 shadow"
      open={props.open}
      onClose={props.onCancel}
    >
      <Flex direction={"col"} class="p-6 gap-4">
        <Text variant={"h3"} weight={"bold"}>
          Changes will not be saved. Close anyway?
        </Text>
        <Flex class="p-2">
          <button class="btn btn-lg flex-1" onClick={() => props.onCancel()}>
            <Text>Cancel</Text>
          </button>
          <button class="btn btn-error flex-1" onClick={() => props.onConfirm()}>
            <Text>Close</Text>
          </button>
        </Flex>
      </Flex>
    </Modal>
  );
}
