import type { LLMProvider } from "./types";
import { LLMError } from "./errors";
import { LLMErrorCode } from "./types";

const _registry = new Map<string, LLMProvider>();

export function register(provider: LLMProvider): void {
  _registry.set(provider.id, provider);
}

export function get(id: string): LLMProvider {
  const provider = _registry.get(id);
  if (!provider) {
    throw new LLMError(
      LLMErrorCode.UnknownProvider,
      `No LLM provider registered with id "${id}". ` +
      `Available: ${[..._registry.keys()].join(", ") || "none"}`
    );
  }
  return provider;
}

/** All registered provider ids and labels — for the settings UI dropdown. */
export function list(): Array<{ id: string; label: string }> {
  return [..._registry.values()].map((p) => ({ id: p.id, label: p.label }));
}