import type { PluginManifest } from "@/core/types/plugins";

/** A blank plugin manifest for the authoring editor's "create" flow. */
export function makeDefaultPluginManifest(
  overrides: Partial<PluginManifest> = {},
): PluginManifest {
  return {
    id: "",
    name: "",
    version: "1.0.0",
    author: "",
    description: "",
    permissions: [],
    configSchema: [],
    defaultConfig: {},
    hooks: { library: "", input: "", buildContext: "", output: "" },
    ...overrides,
  };
}
