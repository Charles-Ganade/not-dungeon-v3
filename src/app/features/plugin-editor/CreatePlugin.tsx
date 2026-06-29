import { PluginEditorForm } from "./PluginEditorForm";
import { makeDefaultPluginManifest } from "@/core/defaults";

export function CreatePlugin() {
  return <PluginEditorForm initial={makeDefaultPluginManifest()} mode="create" />;
}
