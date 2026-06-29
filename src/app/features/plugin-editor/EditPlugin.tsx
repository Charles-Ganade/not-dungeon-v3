import { Navigate, useParams } from "@solidjs/router";
import { createMemo, Show } from "solid-js";
import { pluginsStore } from "@/store";
import { PluginEditorForm } from "./PluginEditorForm";

export function EditPlugin() {
  const params = useParams();
  const manifest = createMemo(() =>
    pluginsStore.installed.find((p) => p.id === params.id),
  );

  return (
    <Show when={manifest()} fallback={<Navigate href="/" />}>
      {(m) => <PluginEditorForm initial={m()} mode="edit" />}
    </Show>
  );
}
