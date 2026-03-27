import { db } from "./schema";
import type { Scenario } from "@/core/types/scenarios";

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

  // Dexie multi-entry indexes support anyOf but not allOf natively,
  // so we fetch by any matching tag then filter client-side.
  const candidates = await db.scenarios.where("tags").anyOf(tags).distinct().toArray();
  return candidates.filter((s) => tags.every((t) => s.tags.includes(t)));
}

// ── Write ─────────────────────────────────────────────────────

export async function createScenario(scenario: Scenario): Promise<Scenario> {
  await db.scenarios.add(scenario);
  return scenario;
}

export async function updateScenario(
  id: string,
  patch: Partial<Omit<Scenario, "id" | "createdAt">>
): Promise<Scenario> {
  await db.scenarios.update(id, { ...patch, updatedAt: Date.now() });
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
  await db.scenarios.delete(id);
}