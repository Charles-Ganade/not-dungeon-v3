import * as Comlink from "comlink";

/**
 * Sandbox lockdown. Runs once when this worker module loads, before any user
 * script can execute. It neutralizes the worker's own network/IO surface on
 * the real global, so even a sandbox escape (e.g.
 * `[].constructor.constructor("return self")()`) resolves to a neutered global.
 *
 * `ctx.ai` is unaffected — it reaches the model through main-thread Comlink
 * callbacks (postMessage), not through any of these APIs. Comlink's own
 * transport (postMessage / addEventListener) is intentionally left intact.
 */
const BLOCKED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
  "indexedDB",
  "caches",
  "Worker",
  "SharedWorker",
] as const;

function lockdownSandbox(): void {
  const g = globalThis as Record<string, unknown>;

  for (const name of BLOCKED_GLOBALS) {
    const blocked = () => {
      throw new Error(`${name} is disabled in the script sandbox`);
    };
    try {
      Object.defineProperty(g, name, {
        configurable: false,
        writable: false,
        value: blocked,
      });
    } catch {
      try {
        g[name] = blocked;
      } catch {
        // Non-writable host binding — already inaccessible, leave as-is.
      }
    }
  }

  // navigator.sendBeacon is a separate exfiltration channel.
  try {
    const nav = g.navigator as { sendBeacon?: unknown } | undefined;
    if (nav && typeof nav.sendBeacon === "function") {
      Object.defineProperty(nav, "sendBeacon", {
        configurable: false,
        writable: false,
        value: () => {
          throw new Error("navigator.sendBeacon is disabled in the script sandbox");
        },
      });
    }
  } catch {
    // Ignore — navigator or sendBeacon unavailable.
  }
}

lockdownSandbox();

/**
 * Identifiers shadowed as `undefined` parameters when compiling user code, so
 * a bare reference (e.g. `fetch(...)`, `self`) can't reach the already-neutered
 * real global. Defense in depth on top of lockdownSandbox().
 */
const SHADOWED_GLOBALS = [
  "window",
  "document",
  "globalThis",
  "self",
  ...BLOCKED_GLOBALS,
] as const;

export interface SandboxCallbacks {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  stop: (reason?: string) => void;
  cancel: (reason?: string) => void;
  startStream: (input: any) => Promise<string>;
  streamNext: (id: string) => Promise<any>;
}

const runnerApi = {
  async execute(library: string, hookScript: string, ctxData: any, callbacks: SandboxCallbacks) {
    if (!hookScript.trim()) return ctxData;

    const memoriesOperations = { add: [] as any[], edit: [] as any[], delete: [] as any[] };
    const storyCardOperations = { add: [] as any[], edit: [] as any[], delete: [] as any[] };

    const ctx = {
      ...ctxData,
      console: {
        log: (...args: any[]) => callbacks.log(...args),
        warn: (...args: any[]) => callbacks.warn(...args),
        error: (...args: any[]) => callbacks.error(...args),
      },
      addMemory: (mem: any) => { memoriesOperations.add.push(mem); },
      editMemory: (id: string, content: any) => {
        if (memoriesOperations.delete.some(m => m.id === id)) return;
        const pendingEdit = memoriesOperations.edit.find(e => e.id === id);
        let baseContent = pendingEdit ? pendingEdit.next : ctxData.state.memories?.find((m: any) => m.id === id)?.content;
        if (baseContent === undefined) return;
        const nextContent = typeof content === "function" ? content(baseContent) : content;
        
        if (pendingEdit) {
          pendingEdit.next = nextContent;
        } else {
          const prevMemory = ctxData.state.memories.find((m: any) => m.id === id)!;
          memoriesOperations.edit.push({ id, prev: prevMemory.content, next: nextContent });
        }
      },
      removeMemory: (id: string) => {
        const prevMemory = ctxData.state.memories?.find((m: any) => m.id === id);
        if (prevMemory) memoriesOperations.delete.push(prevMemory);
      },
      addStoryCard: (card: any) => { storyCardOperations.add.push(card); },
      editStoryCard: (id: string, card: any) => {
        if (storyCardOperations.delete.some(m => m.id === id)) return;
        const pendingEdit = storyCardOperations.edit.find(e => e.id === id);
        let baseContent = pendingEdit ? pendingEdit.next : ctxData.state.storyCards?.find((c: any) => c.id === id);
        if (!baseContent) return;
        const nextContent = typeof card === "function" ? card(baseContent) : card;
        
        if (pendingEdit) {
          pendingEdit.next = nextContent;
        } else {
          const prevCard = ctxData.state.storyCards.find((c: any) => c.id === id)!;
          storyCardOperations.edit.push({ id, prev: prevCard, next: nextContent });
        }
      },
      removeStoryCard: (id: string) => {
        const prevCard = ctxData.state.storyCards?.find((c: any) => c.id === id);
        if (prevCard) storyCardOperations.delete.push(prevCard);
      },
      stop: (reason?: string) => callbacks.stop(reason),
      cancel: (reason?: string) => callbacks.cancel(reason),
      kvMemory: {
        get: (k: string) => ctxData.kvMemoryData[k],
        set: (k: string, v: any) => { ctxData.kvMemoryData[k] = v; },
        delete: (k: string) => { delete ctxData.kvMemoryData[k]; },
        all: () => ({ ...ctxData.kvMemoryData })
      },
      ai: {
        stream: async function* (input: any) {
          const id = await callbacks.startStream(input);
          while (true) {
            const res = await callbacks.streamNext(id);
            if (res.done) break;
            yield res.value;
          }
        }
      },
      inject: (text: string) => {
        if (!ctx._injected) ctx._injected = [];
        ctx._injected.push({ role: "system", content: text });
      },
      // Read-only resolved config for the running plugin ({} for
      // scenario/story scripts, which aren't plugins).
      pluginConfig: Object.freeze(ctxData.pluginConfig ?? {}),
    };

    // Freeze the capability surfaces so scripts can't swap them out to
    // intercept other hooks' calls. `ctx` itself stays mutable — scripts
    // assign ctx.input / ctx.output / ctx.essentials / etc.
    Object.freeze(ctx.console);
    Object.freeze(ctx.ai);
    Object.freeze(ctx.kvMemory);

    const code = [library, hookScript].filter(Boolean).join("\n\n");
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    
    let fn;
    try {
      fn = new AsyncFunction(
        "ctx", ...SHADOWED_GLOBALS,
        `"use strict";\n${code}`
      );
    } catch (err) {
      callbacks.error(`[Script Compilation Error] ${(err as Error).message}`);
      return { memoriesOperations, storyCardOperations };
    }

    try {
      await fn(ctx, ...SHADOWED_GLOBALS.map(() => undefined));
    } catch (err) {
      callbacks.error(`[Script Runtime Error] ${(err as Error).message}`);
    }

    return {
      essentials: ctx.essentials,
      scriptState: ctx.scriptState,
      input: ctx.input,
      output: ctx.output,
      messages: ctx.messages,
      kvMemoryData: ctxData.kvMemoryData,
      suppressDefaultSummarizer: ctx.suppressDefaultSummarizer,
      _injected: ctx._injected,
      memoriesOperations,
      storyCardOperations
    };
  }
};

Comlink.expose(runnerApi);
export type RunnerApi = typeof runnerApi;