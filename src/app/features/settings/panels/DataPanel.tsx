import { Flex, Text, Modal } from "@/app/components";
import { PanelLabel } from "../PanelLabel";
import { createSignal } from "solid-js";
import { toast } from "solid-sonner";
import { exportBackup, importBackup } from "@/services/db";
import { libraryStore, settingsStore, pluginsStore } from "@/store";

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

async function readSelectedFile(input: HTMLInputElement): Promise<string | null> {
  const file = input.files?.[0] ?? null;
  input.value = "";
  return file ? file.text() : null;
}

export function DataPanel() {
  const [confirmReplaceOpen, setConfirmReplaceOpen] = createSignal(false);

  const handleExportBackup = async () => {
    try {
      download(await exportBackup());
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleImportBackup =
    (mode: "merge" | "replace") =>
    async (e: { currentTarget: HTMLInputElement }) => {
      const text = await readSelectedFile(e.currentTarget);
      if (!text) return;
      try {
        await importBackup(text, mode);
        await Promise.all([
          libraryStore.init(),
          settingsStore.init(),
          pluginsStore.init(),
        ]);
        toast.success(
          mode === "replace"
            ? "Library restored from backup."
            : "Backup merged into library.",
        );
      } catch (err) {
        toast.error((err as Error).message);
      }
    };

  return (
    <Flex direction={"col"} class="gap-2 w-full">
      <PanelLabel>Data</PanelLabel>
      <Flex direction={"col"} class="px-4 gap-6 max-w-xl">
        <Flex direction={"col"} class="gap-2">
          <Text weight={"bold"}>Full Backup</Text>
          <Text variant={"bodySm"} color={"muted"}>
            Export every scenario, story, and setting into a single file, or
            restore one. Merge adds to your library; Replace wipes it first.
          </Text>
          <Flex class="gap-2 flex-wrap">
            <button class="btn btn-primary" onClick={handleExportBackup}>
              <Text class="text-primary-content">Export Backup</Text>
            </button>
            <label class="btn">
              <Text>Import (Merge)…</Text>
              <input
                type="file"
                class="hidden"
                accept="application/json,.json"
                onChange={handleImportBackup("merge")}
              />
            </label>
            <button
              class="btn btn-error"
              onClick={() => setConfirmReplaceOpen(true)}
            >
              <Text class="text-error-content">Restore (Replace)…</Text>
            </button>
          </Flex>
        </Flex>
      </Flex>

      <Modal
        class="p-0! grid bg-base-200 shadow"
        open={confirmReplaceOpen()}
        onClose={() => setConfirmReplaceOpen(false)}
      >
        <Flex direction={"col"} class="p-6 gap-4">
          <Text variant={"h3"} weight={"bold"}>
            Replace your entire library?
          </Text>
          <Text color={"muted"}>
            This permanently deletes all current scenarios, stories, and
            settings, then loads the backup in their place. This cannot be
            undone.
          </Text>
          <Flex class="p-2 gap-2">
            <button
              class="btn btn-lg flex-1"
              onClick={() => setConfirmReplaceOpen(false)}
            >
              <Text>Cancel</Text>
            </button>
            <label class="btn btn-lg btn-error flex-1">
              <Text class="text-error-content">Choose backup…</Text>
              <input
                type="file"
                class="hidden"
                accept="application/json,.json"
                onChange={async (e) => {
                  await handleImportBackup("replace")(e);
                  setConfirmReplaceOpen(false);
                }}
              />
            </label>
          </Flex>
        </Flex>
      </Modal>
    </Flex>
  );
}
