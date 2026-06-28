import type {
  PluginManifest,
  PluginCapability,
  PluginConfigField,
  EnabledPlugin,
} from "@/core/types/plugins";

const PLUGIN_BUNDLE_VERSION = 1;

const CAPABILITIES: PluginCapability[] = [
  "ai",
  "kvMemory",
  "memories",
  "storyCards",
  "network",
];

const FIELD_TYPES: PluginConfigField["type"][] = [
  "string",
  "number",
  "boolean",
  "select",
];

export interface PluginBundleV1 {
  schemaVersion: 1;
  kind: "plugin";
  manifest: PluginManifest;
}

function slugify(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "plugin";
}

/** Upgrades an older bundle to the current schema before validation. */
function migratePluginBundle(raw: Record<string, unknown>): PluginBundleV1 {
  if (raw.schemaVersion === PLUGIN_BUNDLE_VERSION) {
    return raw as unknown as PluginBundleV1;
  }
  throw new Error(`Unsupported plugin bundle version: ${String(raw.schemaVersion)}`);
}

function validateConfigSchema(value: unknown): PluginConfigField[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error('"configSchema" must be an array.');
  }
  return value.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`configSchema[${i}] must be an object.`);
    }
    const f = item as Record<string, unknown>;
    if (typeof f.key !== "string" || !f.key.trim()) {
      throw new Error(`configSchema[${i}].key must be a non-empty string.`);
    }
    if (typeof f.label !== "string" || !f.label.trim()) {
      throw new Error(`configSchema[${i}].label must be a non-empty string.`);
    }
    if (!FIELD_TYPES.includes(f.type as PluginConfigField["type"])) {
      throw new Error(
        `configSchema[${i}].type must be one of: ${FIELD_TYPES.join(", ")}.`,
      );
    }
    if (f.type === "select" && !Array.isArray(f.options)) {
      throw new Error(`configSchema[${i}].options must be an array for a select field.`);
    }
    return f as unknown as PluginConfigField;
  });
}

function validateManifest(value: unknown): PluginManifest {
  if (typeof value !== "object" || value === null) {
    throw new Error('Invalid bundle — "manifest" must be an object.');
  }
  const m = value as Record<string, unknown>;

  if (typeof m.id !== "string" || !m.id.trim()) {
    throw new Error('Plugin "id" must be a non-empty string.');
  }
  if (typeof m.name !== "string" || !m.name.trim()) {
    throw new Error('Plugin "name" must be a non-empty string.');
  }
  if (typeof m.version !== "string" || !m.version.trim()) {
    throw new Error('Plugin "version" must be a non-empty string.');
  }
  if (!Array.isArray(m.permissions)) {
    throw new Error('Plugin "permissions" must be an array.');
  }
  for (const p of m.permissions) {
    if (!CAPABILITIES.includes(p as PluginCapability)) {
      throw new Error(`Unknown permission "${String(p)}".`);
    }
  }
  if (typeof m.hooks !== "object" || m.hooks === null) {
    throw new Error('Plugin "hooks" must be an object.');
  }
  for (const [phase, code] of Object.entries(m.hooks as Record<string, unknown>)) {
    if (code !== undefined && typeof code !== "string") {
      throw new Error(`Plugin hook "${phase}" must be a string.`);
    }
  }
  if (m.defaultConfig !== undefined && (typeof m.defaultConfig !== "object" || m.defaultConfig === null)) {
    throw new Error('Plugin "defaultConfig" must be an object.');
  }

  const configSchema = validateConfigSchema(m.configSchema);

  return {
    id: m.id.trim(),
    name: m.name.trim(),
    version: m.version.trim(),
    author: typeof m.author === "string" ? m.author : undefined,
    description: typeof m.description === "string" ? m.description : undefined,
    permissions: m.permissions as PluginCapability[],
    configSchema,
    defaultConfig: (m.defaultConfig as Record<string, unknown>) ?? undefined,
    hooks: m.hooks as PluginManifest["hooks"],
  };
}

/**
 * Parses and validates a `.plugin.json` bundle into a manifest, ready to
 * install. Pure — the caller persists it (mirrors `importScenario`).
 */
export function importPlugin(json: string): PluginManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON — could not parse the file.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid format — expected a plugin bundle object.");
  }
  const raw = parsed as Record<string, unknown>;
  if (raw.kind !== "plugin") {
    throw new Error('Invalid bundle — "kind" must be "plugin".');
  }
  const bundle = migratePluginBundle(raw);
  return validateManifest(bundle.manifest);
}

/** Serializes a manifest to a downloadable `.plugin.json` bundle. */
export function exportPlugin(manifest: PluginManifest): File {
  const bundle: PluginBundleV1 = {
    schemaVersion: PLUGIN_BUNDLE_VERSION,
    kind: "plugin",
    manifest,
  };
  const json = JSON.stringify(bundle, null, 2);
  return new File([json], `${slugify(manifest.id)}.plugin.json`, {
    type: "application/json",
  });
}

/**
 * Resolves the config a plugin sees at runtime:
 *   schema defaults  ⊕  manifest.defaultConfig  ⊕  the story's overrides.
 */
export function resolvePluginConfig(
  manifest: PluginManifest,
  enabled: EnabledPlugin | undefined,
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of manifest.configSchema ?? []) {
    if (field.default !== undefined) config[field.key] = field.default;
  }
  Object.assign(config, manifest.defaultConfig ?? {});
  Object.assign(config, enabled?.config ?? {});
  return config;
}
