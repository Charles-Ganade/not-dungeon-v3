import { Text } from "@/app/components";
import { createMemo, createSignal, Show } from "solid-js";
// @ts-ignore
import TextareaAutosize from "solid-textarea-autosize";
import { debounce } from "lodash";
import { toast } from "solid-sonner";

interface JsonStateEditorProps {
  label: string;
  /** The current object value (reactive accessor). */
  value: () => Record<string, unknown> | undefined;
  /** Persist a parsed object. Called debounced while the user edits. */
  onSave: (next: Record<string, unknown>) => void;
}

/**
 * Read/edit view for one persistent object store (Script State or KV Memory).
 * Shows pretty-printed JSON; toggling "Enable Editing" swaps in a textarea that
 * parses on change, rejecting anything that isn't a JSON object.
 */
export function JsonStateEditor(props: JsonStateEditorProps) {
  const [editable, setEditable] = createSignal(false);
  const save = debounce(
    (next: Record<string, unknown>) => props.onSave(next),
    1000,
  );

  const json = createMemo(() => {
    try {
      return JSON.stringify(props.value() ?? {}, null, 2);
    } catch {
      return "{}";
    }
  });

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <Text variant={"overline"} color={"muted"} weight={"bold"}>
          {props.label}
        </Text>
        <div class="flex gap-2 items-center">
          <Text variant={"bodySm"} color={"muted"} weight={"bold"}>
            Enable Editing?
          </Text>
          <input
            type="checkbox"
            class="checkbox checked:checkbox-accent"
            checked={editable()}
            onChange={() => setEditable((v) => !v)}
          />
        </div>
      </div>

      <Show
        when={editable()}
        fallback={
          <code class="block font-mono text-sm bg-base-100 rounded px-2 py-1 mt-1 border border-base-content/10 whitespace-pre-wrap">
            {json()}
          </code>
        }
      >
        <TextareaAutosize
          value={json()}
          // @ts-ignore
          onChange={({ currentTarget }) => {
            let parsed: unknown;
            try {
              parsed = JSON.parse(currentTarget.value);
            } catch {
              toast.error(`Invalid JSON in ${props.label}.`);
              return;
            }
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              toast.error(`${props.label} must be a JSON object.`);
              return;
            }
            save(parsed as Record<string, unknown>);
          }}
          class="textarea font-mono text-sm resize-none w-full block bg-base-100 rounded px-2 py-1 mt-1 border border-base-content/10 whitespace-pre-wrap"
          minRows={3}
        />
      </Show>
    </div>
  );
}
