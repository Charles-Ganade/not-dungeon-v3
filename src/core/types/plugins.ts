import type { ScriptBundle } from "./stories";

/**
 * Capabilities a plugin may declare. Shown to the user for consent at
 * install time. The hardened worker sandbox already blocks `network`;
 * fine-grained per-plugin enforcement of the others is a future step.
 */
export type PluginCapability =
  | "ai"
  | "kvMemory"
  | "memories"
  | "storyCards"
  | "network";

/** A single configurable field, used to auto-generate the per-story config UI. */
export interface PluginConfigField {
  /** Key under `ctx.pluginConfig` the plugin reads. */
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select";
  /** Default value when the story hasn't set one. */
  default?: string | number | boolean;
  /** Allowed values for `type: "select"`. */
  options?: string[];
  description?: string;
}

/**
 * The installable unit. Hook code mirrors a ScriptBundle but every field is
 * optional — a plugin only provides the phases it cares about.
 */
export interface PluginManifest {
  /** Stable unique id, e.g. "com.author.dice-roller". */
  id: string;
  name: string;
  /** Informational version string (e.g. "1.0.0"). */
  version: string;
  author?: string;
  description?: string;
  permissions: PluginCapability[];
  configSchema?: PluginConfigField[];
  defaultConfig?: Record<string, unknown>;
  hooks: Partial<ScriptBundle>;
}

/** A manifest persisted in the global plugins table. */
export interface InstalledPlugin extends PluginManifest {
  installedAt: number;
}

/**
 * Per-story opt-in record. References an installed plugin by id and carries
 * the story's own config overrides. Not delta-tracked (configuration, not
 * gameplay).
 */
export interface EnabledPlugin {
  pluginId: string;
  version: string;
  enabled: boolean;
  config: Record<string, unknown>;
}
