import { Text } from "@/app/components";
import { usePlay } from "../context";
import { createMemo, For } from "solid-js";
import { sessionStore } from "@/store";
import { unwrap } from "solid-js/store";
import { JsonStateEditor } from "./JsonStateEditor";

const formatDebugArg = (arg: unknown): string => {
  if (arg === undefined) return "undefined";
  if (arg === null) return "null";
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
  if (typeof arg === "function")
    return `[Function: ${arg.name || "anonymous"}]`;
  if (typeof arg === "symbol") return arg.toString();
  if (typeof arg === "bigint") return `${arg.toString()}n`;
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}\n${arg.stack || ""}`;
  }
  const seen = new WeakSet();
  try {
    return JSON.stringify(
      arg,
      (key, value) => {
        if (typeof value === "function")
          return `[Function: ${value.name || "anonymous"}]`;
        if (typeof value === "symbol") return value.toString();
        if (typeof value === "bigint") return `${value.toString()}n`;
        if (value instanceof Error) return `[${value.name}: ${value.message}]`;
        if (value instanceof Map) return { "[Map]": Object.fromEntries(value) };
        if (value instanceof Set) return { "[Set]": Array.from(value) };
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular Reference]";
          seen.add(value);
        }
        return value;
      },
      2,
    );
  } catch (err) {
    return `[Unserializable Object: ${err}]`;
  }
};

export function DebugPanel() {
  const { debugLogs, setDebugLogs } = usePlay();

  const kvMemory = createMemo(() => unwrap(sessionStore.story?.kvMemory));
  const scriptState = createMemo(() => unwrap(sessionStore.story?.scriptState));

  return (
    <div class="flex flex-1 flex-col gap-2 p-4 min-h-0">
      <div class="w-full pb-2 flex items-center justify-between shrink-0">
        <Text variant={"h4"} class="leading-none font-bold">
          Debug
        </Text>
      </div>
      <div class="tabs tabs-lift flex-1 min-h-0">
        <label class="tab">
          <input type="radio" name="debug-tab" checked />
          <div class="flex items-center gap-2">
            <Text class="text-inherit">Console</Text>
          </div>
        </label>
        <div class="tab-content bg-base-100 border-base-300 border-t-0 relative">
          <div class="w-f h-full flex flex-col">
            <div class="flex items-center justify-between w-full p-2 pl-6 bg-base-100 shrink-0">
              <Text>Logs</Text>
              <button
                class="btn btn-info btn-soft"
                onClick={() => setDebugLogs([])}
              >
                <Text>Clear</Text>
              </button>
            </div>
            <div class="relative flex-1">
              <div class="absolute inset-0 overflow-y-auto p-2 font-mono">
                <For
                  each={debugLogs}
                  fallback={
                    <div class="flex h-full items-center justify-center opacity-40 italic text-sm">
                      <Text>Waiting for logs...</Text>
                    </div>
                  }
                >
                  {(log) => (
                    <div
                      class="flex items-start gap-3 px-3 py-2 border-b border-base-content/5 last:border-0 hover:bg-base-content/5 transition-colors text-sm"
                      classList={{
                        "text-error bg-error/5": log.level === "error",
                        "text-warning bg-warning/5": log.level === "warn",
                      }}
                    >
                      <span class="opacity-50 shrink-0 text-xs mt-0.5">
                        <Text variant={"caption"}>
                          {new Date(log.ts).toLocaleTimeString([], {
                            hour12: false,
                          })}
                        </Text>
                      </span>

                      <span
                        class="font-bold uppercase w-12 shrink-0 text-xs mt-0.5"
                        classList={{
                          "text-error": log.level === "error",
                          "text-warning": log.level === "warn",
                          "text-info": log.level === "log",
                        }}
                      >
                        <Text>{log.level}</Text>
                      </span>

                      <div class="flex-1 break-all whitespace-pre-wrap text-base-content/80">
                        <For each={log.args}>
                          {(arg) => (
                            <span class="mr-2">
                              {typeof arg === "object" && arg !== null ? (
                                <code class="block bg-base-100 rounded px-2 py-1 mt-1 border border-base-content/10">
                                  <Text>{formatDebugArg(arg)}</Text>
                                </code>
                              ) : (
                                <Text>{formatDebugArg(arg)}</Text>
                              )}
                            </span>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
        <label class="tab">
          <input type="radio" name="debug-tab" />
          <div class="flex items-center gap-2">
            <Text class="text-inherit">Inspector</Text>
          </div>
        </label>
        <div class="tab-content bg-base-100 border-base-300 border-t-0 relative">
          <div class="absolute inset-0 overflow-y-auto p-4">
            <div class="w-full h-full flex flex-col gap-6">
              <JsonStateEditor
                label="Key-Value Memory"
                value={kvMemory}
                onSave={sessionStore.editKvMemory}
              />
              <JsonStateEditor
                label="Script State"
                value={scriptState}
                onSave={sessionStore.editScriptState}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
