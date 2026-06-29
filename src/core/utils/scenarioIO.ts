import JSZip from "jszip";
import type { Scenario } from "@/core/types";
import type { StoryCard, ScriptBundle, ConfigOverride } from "@/core/types/stories";
import type { EnabledPlugin, PluginManifest } from "@/core/types/plugins";
import { makeDefaultScenario } from "@/core/defaults";
import { getThumbnailBlob } from "@/services/db";
import { isZip, toBytes } from "@/utils";
import { exportPlugin, importPlugin } from "./pluginIO";

const SCENARIO_BUNDLE_VERSION = 1;

const SCRIPT_PHASES: (keyof ScriptBundle)[] = [
  "library",
  "input",
  "buildContext",
  "output",
];

/** The `manifest.json` inside a `.scenario.zip` — metadata + bundled-plugin summary. */
interface ScenarioManifest {
  schemaVersion: 1;
  kind: "scenario";
  exportedAt: number;
  name: string;
  tags: string[];
  thumbnail?: { mime: string };
  plugins: { id: string; name: string; version: string }[];
}

type ScenarioInput = Omit<Scenario, "id" | "createdAt" | "updatedAt">;

function slugify(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "scenario";
}

function splitIfString(value: string[] | string): string[] {
  if (Array.isArray(value)) return value.map((s) => s.trim()).filter(Boolean);
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Serializes a scenario to a `.scenario.zip`: small `manifest.json`, the
 * scenario fields in `scenario.json`, scripts as `scripts/*.js`, story cards in
 * `storyCards.json`, the thumbnail as an image, and each used plugin nested as
 * `plugins/<id>.plugin.zip`. The caller passes the resolved plugin manifests
 * (keeps this module free of store imports).
 */
export async function exportScenario(
  scenario: ScenarioInput,
  plugins: PluginManifest[] = [],
): Promise<File> {
  const zip = new JSZip();

  const { storyCards, scripts, thumbnailId, ...core } = scenario;
  zip.file("scenario.json", JSON.stringify(core, null, 2));

  for (const phase of SCRIPT_PHASES) {
    const code = scripts?.[phase];
    if (code && code.trim()) zip.file(`scripts/${phase}.js`, code);
  }

  zip.file("storyCards.json", JSON.stringify(storyCards ?? [], null, 2));

  let thumbnail: { mime: string } | undefined;
  if (thumbnailId) {
    const blob = await getThumbnailBlob(thumbnailId);
    if (blob) {
      zip.file("thumbnail", blob);
      thumbnail = { mime: blob.type || "image/png" };
    }
  }

  for (const manifest of plugins) {
    const pluginFile = await exportPlugin(manifest);
    zip.file(`plugins/${slugify(manifest.id)}.plugin.zip`, pluginFile);
  }

  const manifest: ScenarioManifest = {
    schemaVersion: SCENARIO_BUNDLE_VERSION,
    kind: "scenario",
    exportedAt: Date.now(),
    name: scenario.name,
    tags: scenario.tags ?? [],
    thumbnail,
    plugins: plugins.map((p) => ({ id: p.id, name: p.name, version: p.version })),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], `${slugify(scenario.name)}.scenario.zip`, {
    type: "application/zip",
  });
}

function migrateScenarioManifest(raw: Record<string, unknown>): void {
  if (raw.schemaVersion !== SCENARIO_BUNDLE_VERSION) {
    throw new Error(`Unsupported scenario bundle version: ${String(raw.schemaVersion)}`);
  }
  if (raw.kind !== "scenario") {
    throw new Error('Invalid bundle — "kind" must be "scenario".');
  }
}

/** Validates the shared scenario fields and normalizes them into overrides. */
function validateCommon(obj: Record<string, unknown>) {
  if (typeof obj.name !== "string" || !obj.name.trim()) {
    throw new Error('Scenario "name" must be a non-empty string.');
  }

  const str = (key: string): string => {
    const v = obj[key];
    if (v !== undefined && typeof v !== "string") {
      throw new Error(`Scenario "${key}" must be a string.`);
    }
    return (v as string) ?? "";
  };

  let tags: string[] = [];
  if (obj.tags !== undefined) {
    if (typeof obj.tags !== "string" && !Array.isArray(obj.tags)) {
      throw new Error('Scenario "tags" must be a string or array of strings.');
    }
    tags = splitIfString(obj.tags as string[] | string);
  }

  let override: ConfigOverride = { prompts: {} };
  if (obj.override !== undefined) {
    if (typeof obj.override !== "object" || obj.override === null) {
      throw new Error('Scenario "override" must be an object.');
    }
    override = obj.override as ConfigOverride;
  }

  let enabledPlugins: EnabledPlugin[] = [];
  if (obj.enabledPlugins !== undefined) {
    if (!Array.isArray(obj.enabledPlugins)) {
      throw new Error('Scenario "enabledPlugins" must be an array.');
    }
    enabledPlugins = obj.enabledPlugins as EnabledPlugin[];
  }

  return {
    name: obj.name.trim(),
    description: str("description"),
    openingPrompt: str("openingPrompt"),
    authorNotes: str("authorNotes"),
    instructions: str("instructions"),
    essentials: str("essentials"),
    tags,
    override,
    enabledPlugins,
  };
}

/**
 * Parses, validates, and normalizes a scenario bundle ready to populate the
 * create form. Accepts the new `.scenario.zip` and the legacy single-JSON
 * bundle (string or bytes). Returns the rebuilt scenario (fresh id, cleared
 * thumbnailId), the decoded thumbnail blob, and any bundled plugin manifests
 * for the caller to install.
 */
export async function importScenario(
  data: ArrayBuffer | Uint8Array | string,
): Promise<{
  scenario: Scenario;
  thumbnailBlob: Blob | null;
  bundledPlugins: PluginManifest[];
}> {
  if (typeof data === "string") return importLegacyScenarioJSON(data);

  const bytes = toBytes(data);
  if (!isZip(bytes)) {
    return importLegacyScenarioJSON(new TextDecoder().decode(bytes));
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error("Invalid scenario file — could not read the archive.");
  }

  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("Invalid scenario bundle — missing manifest.json.");
  }
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(await manifestFile.async("string"));
  } catch {
    throw new Error("Invalid scenario bundle — manifest.json is not valid JSON.");
  }
  migrateScenarioManifest(manifest);

  const scenarioFile = zip.file("scenario.json");
  if (!scenarioFile) {
    throw new Error("Invalid scenario bundle — missing scenario.json.");
  }
  let core: Record<string, unknown>;
  try {
    core = JSON.parse(await scenarioFile.async("string"));
  } catch {
    throw new Error("Invalid scenario bundle — scenario.json is not valid JSON.");
  }
  const common = validateCommon(core);

  const scripts: ScriptBundle = {
    library: "",
    input: "",
    buildContext: "",
    output: "",
  };
  for (const phase of SCRIPT_PHASES) {
    const entry = zip.file(`scripts/${phase}.js`);
    if (entry) scripts[phase] = await entry.async("string");
  }

  let storyCards: StoryCard[] = [];
  const cardsFile = zip.file("storyCards.json");
  if (cardsFile) {
    try {
      storyCards = JSON.parse(await cardsFile.async("string"));
    } catch {
      throw new Error("Invalid scenario bundle — storyCards.json is not valid JSON.");
    }
    if (!Array.isArray(storyCards)) {
      throw new Error("Invalid scenario bundle — storyCards.json must be an array.");
    }
  }

  let thumbnailBlob: Blob | null = null;
  const thumbMeta = manifest.thumbnail as { mime: string } | undefined;
  if (thumbMeta) {
    const entry = zip.file("thumbnail");
    if (entry) {
      const raw = await entry.async("blob");
      thumbnailBlob = new Blob([raw], { type: thumbMeta.mime });
    }
  }

  const bundledPlugins: PluginManifest[] = [];
  for (const entry of zip.file(/^plugins\/[^/]+\.plugin\.zip$/)) {
    const buf = await entry.async("uint8array");
    try {
      bundledPlugins.push(await importPlugin(buf));
    } catch (err) {
      throw new Error(
        `Bundled plugin "${entry.name}" is invalid: ${(err as Error).message}`,
      );
    }
  }

  const scenario = makeDefaultScenario({ ...common, scripts, storyCards });
  scenario.thumbnailId = "";
  return { scenario, thumbnailBlob, bundledPlugins };
}

/** Legacy path: the original single-JSON scenario (scripts/cards inline, no plugins). */
function importLegacyScenarioJSON(json: string): {
  scenario: Scenario;
  thumbnailBlob: Blob | null;
  bundledPlugins: PluginManifest[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON — could not parse the file.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid format — expected a JSON object at the root.");
  }
  const obj = parsed as Record<string, unknown>;

  const common = validateCommon(obj);

  if (!Array.isArray(obj.storyCards)) {
    throw new Error('Scenario "storyCards" must be an array.');
  }
  if (typeof obj.scripts !== "object" || obj.scripts === null) {
    throw new Error('Scenario "scripts" must be an object.');
  }

  const scenario = makeDefaultScenario({
    ...common,
    storyCards: obj.storyCards as StoryCard[],
    scripts: obj.scripts as ScriptBundle,
  });
  return { scenario, thumbnailBlob: null, bundledPlugins: [] };
}
