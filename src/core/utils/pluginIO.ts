import JSZip from "jszip";
import type {
  PluginManifest,
  PluginCapability,
  PluginConfigField,
  EnabledPlugin,
} from "@/core/types/plugins";
import type { ScriptBundle } from "@/core/types/stories";
import { isZip, slugify, toBytes } from "@/utils";

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

const HOOK_PHASES: (keyof ScriptBundle)[] = [
  "library",
  "input",
  "buildContext",
  "output",
];

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

/**
 * Validates a fully-assembled manifest (hooks already inlined as strings).
 * Exported as {@link validatePluginManifest} for the in-app editor — the same
 * validation the import path uses.
 */
export function validateManifest(value: unknown): PluginManifest {
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

/** Parses the bundle wrapper, checking container shape. Returns the manifest object. */
function parseBundleManifest(json: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON — could not parse the plugin manifest.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid format — expected a plugin bundle object.");
  }
  const raw = parsed as Record<string, unknown>;
  if (raw.kind !== "plugin") {
    throw new Error('Invalid bundle — "kind" must be "plugin".');
  }
  if (raw.schemaVersion !== PLUGIN_BUNDLE_VERSION) {
    throw new Error(`Unsupported plugin bundle version: ${String(raw.schemaVersion)}`);
  }
  if (typeof raw.manifest !== "object" || raw.manifest === null) {
    throw new Error('Invalid bundle — "manifest" must be an object.');
  }
  return raw.manifest as Record<string, unknown>;
}

/**
 * Serializes a plugin to a downloadable `.plugin.zip`: `manifest.json`
 * (metadata only) plus each hook as its own `hooks/<phase>.js` file — far
 * easier to read and edit than a giant escaped JSON string.
 */
export async function exportPlugin(manifest: PluginManifest): Promise<File> {
  const zip = new JSZip();

  const hooks = manifest.hooks ?? {};
  for (const phase of HOOK_PHASES) {
    const code = hooks[phase];
    if (code && code.trim()) zip.file(`hooks/${phase}.js`, code);
  }

  const { hooks: _omitted, ...meta } = manifest;
  const bundle = {
    schemaVersion: PLUGIN_BUNDLE_VERSION,
    kind: "plugin",
    manifest: meta,
  };
  zip.file("manifest.json", JSON.stringify(bundle, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], `${slugify(manifest.id, "plugin")}.plugin.zip`, {
    type: "application/zip",
  });
}

/**
 * Parses and validates a plugin bundle into a manifest ready to install.
 * Accepts the new `.plugin.zip` (hooks as files) and the legacy single-JSON
 * bundle (hooks inline, string or bytes). Pure — the caller persists it.
 */
export async function importPlugin(
  data: ArrayBuffer | Uint8Array | string,
): Promise<PluginManifest> {
  if (typeof data === "string") return importLegacyPluginJSON(data);

  const bytes = toBytes(data);
  if (!isZip(bytes)) {
    return importLegacyPluginJSON(new TextDecoder().decode(bytes));
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error("Invalid plugin file — could not read the archive.");
  }

  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("Invalid plugin bundle — missing manifest.json.");
  }
  const meta = parseBundleManifest(await manifestFile.async("string"));

  const hooks: Partial<ScriptBundle> = {};
  for (const phase of HOOK_PHASES) {
    const entry = zip.file(`hooks/${phase}.js`);
    if (entry) hooks[phase] = await entry.async("string");
  }

  return validateManifest({ ...meta, hooks });
}

/** Legacy path: the original single-JSON bundle with hooks inline. */
function importLegacyPluginJSON(json: string): PluginManifest {
  const meta = parseBundleManifest(json);
  return validateManifest(meta);
}

/** Public alias of {@link validateManifest} for the plugin editor. */
export const validatePluginManifest = validateManifest;

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
