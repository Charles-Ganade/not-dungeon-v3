import { ScriptLogEntry } from "@/core/engine/script_runner";
import { LLMChunk } from "@/services/llm";
import { Accessor, createContext, Setter, useContext } from "solid-js";
import { SetStoreFunction, Store } from "solid-js/store";

export type PlayModes = "next" | "retry" | "continue";

interface PlayContext {
  onLog: (entry: ScriptLogEntry) => void;
  onChunk: (chunk: LLMChunk) => void;
  setDebugLogs: SetStoreFunction<
    {
      level: "error" | "log" | "warn";
      args: unknown[];
      ts: number;
    }[]
  >;
  debugLogs: Store<
    {
      level: "error" | "log" | "warn";
      args: unknown[];
      ts: number;
    }[]
  >;
}

export const PlayContext = createContext<PlayContext>();

export function usePlay() {
  const ctx = useContext(PlayContext);
  if (!ctx) throw new Error("usePlay must be used inside <Home>");
  return ctx;
}
