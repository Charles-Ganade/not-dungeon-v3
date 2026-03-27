import { db } from "./schema";
import type { Scenario } from "@/core/types/scenarios";
import { deleteThumbnail, isThumbnailReferenced, saveThumbnail } from "./thumbnails";
import { DEFAULT_SETTINGS, makeDefaultScenario } from "@/core/defaults";

// ── Read ──────────────────────────────────────────────────────

export async function getScenario(id: string): Promise<Scenario | undefined> {
  return db.scenarios.get(id);
}

export async function getAllScenarios(): Promise<Scenario[]> {
  return db.scenarios.orderBy("createdAt").reverse().toArray();
}

/**
 * Returns scenarios that have ALL of the given tags.
 * An empty array returns all scenarios.
 */
export async function getScenariosByTags(tags: string[]): Promise<Scenario[]> {
  if (tags.length === 0) return getAllScenarios();

 
 
  const candidates = await db.scenarios.where("tags").anyOf(tags).distinct().toArray();
  return candidates.filter((s) => tags.every((t) => s.tags.includes(t)));
}

// ── Write ─────────────────────────────────────────────────────

export async function createScenario(
  scenario: Scenario,
  thumbnail?: Blob
): Promise<Scenario> {
  const row: Scenario = { ...scenario };
 
  if (thumbnail) {
    row.thumbnailId = await saveThumbnail(thumbnail);
  }
 
  await db.scenarios.add(row);
  return row;
}

export async function updateScenario(
  id: string,
  patch: Partial<Omit<Scenario, "id" | "createdAt">>,
  thumbnail?: Blob
): Promise<Scenario> {
  const existing = await getScenario(id);
  if (!existing) throw new Error(`Scenario ${id} not found`);
 
  const updates: Partial<Scenario> = { ...patch, updatedAt: Date.now() };
  const oldThumbnailId = existing.thumbnailId;
 
  if (thumbnail) {
    updates.thumbnailId = await saveThumbnail(thumbnail);
  } else if ("thumbnailId" in patch && (patch.thumbnailId === undefined || patch.thumbnailId === "")) {
    updates.thumbnailId = undefined;
  }
 
  await db.scenarios.update(id, updates);
  
  if (oldThumbnailId && oldThumbnailId !== updates.thumbnailId) {
    if (!(await isThumbnailReferenced(oldThumbnailId))) {
      await deleteThumbnail(oldThumbnailId);
    }
  }

  const updated = await db.scenarios.get(id);
  if (!updated) throw new Error(`Scenario ${id} not found after update`);
  return updated;
}

/**
 * Deletes a scenario. Stories that were started from this scenario
 * keep their data — their scenarioId becomes a dangling reference,
 * which the library view handles gracefully via the optional
 * scenario field on LibraryItem.
 */
export async function deleteScenario(id: string): Promise<void> {
  const scenario = await getScenario(id);
  if (!scenario) return;
  await db.scenarios.delete(id);
  if (scenario.thumbnailId) {
    if (!(await isThumbnailReferenced(scenario.thumbnailId))) {
      await deleteThumbnail(scenario.thumbnailId);
    }
  }
}

export async function seedStarterScenarioIfNeeded() {
  const count = await db.scenarios.count();
  const isSet = localStorage.getItem("initialized")
  if (count > 0 || isSet) return;

  localStorage.setItem("initialized", "true");

  const starterScenario = makeDefaultScenario({
    tags: ["Dark Fantasy", "Showcase", "Scripted"],
    authorNotes: "Maintain a dark fantasy tone. Emphasize atmospheric descriptions, creeping shadows, and a sense of ancient mystery.",
    description: "A dark fantasy starter scenario that demonstrates the Story Arc Engine. As you play, the engine will autonomously call the AI in the background every 35 turns to plan out the next 11 major plot events, guiding the narrator.",
    name: "The Obsidian Citadel (Powered by SAE)",
    essentials:  `[World State]
- Setting: The Obsidian Citadel, a vast, ruined fortress consumed by living, unnatural darkness.
- Atmosphere: Tense, freezing cold, claustrophobic, and eerily quiet. 
- Goal: The player must navigate the Citadel to find a mythical reality-altering artifact and escape. The main gates are permanently sealed behind them.
- Inventory: The player holds the "Lumina Crystal". It emits a blue light that repels the darkness. Its light is finite and slowly dimming.
- Threats: "Shadow Watchers" roam the unlit areas. They are blind, heat-draining entities that hunt purely by sound and sudden movement. They are repelled by the Lumina Crystal.`,
    openingPrompt: `The iron-wrought gates of the Obsidian Citadel loom before you, \$\{What's your name?\}, piercing the storm clouds above. Legend claims an artifact of unimaginable power lies hidden in its depths, but the silence of the courtyard is unnatural. In your hand, the Lumina Crystal pulses with a faint, warm blue glow—the only thing keeping the unnaturally thick shadows at bay.

    As you step across the threshold, the massive gates groan shut behind you, the sound echoing through the empty halls. The air instantly grows freezing cold. You must find the artifact and a way out before the crystal's light dies completely.

    You stand in the grand entrance hall. Two heavy wooden doors lead to the East and West, and a ruined staircase spirals up into total darkness.`,
  })

  await db.scenarios.add(starterScenario);
  console.log("Seeded starter scenario with fully integrated Story Arc Engine.");
}