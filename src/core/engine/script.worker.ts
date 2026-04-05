import * as Comlink from "comlink";

export interface SandboxCallbacks {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  stop: (reason?: string) => void;
  startStream: (input: any) => Promise<string>;
  streamNext: (id: string) => Promise<any>;
}

const runnerApi = {
  async execute(library: string, hookScript: string, ctxData: any, callbacks: SandboxCallbacks) {
    if (!hookScript.trim()) return ctxData;

    // Track operations locally inside the worker to prevent async race conditions
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
      }
    };

    const code = [library, hookScript].filter(Boolean).join("\n\n");
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    
    let fn;
    try {
      fn = new AsyncFunction(
        "ctx", "window", "document", "globalThis", "self", "fetch", "XMLHttpRequest", "indexedDB", "Worker", "WebSocket", "caches",
        `"use strict";\n${code}`
      );
    } catch (err) {
      callbacks.error(`[Script Compilation Error] ${(err as Error).message}`);
      return { memoriesOperations, storyCardOperations }; // Fail gracefully
    }

    try {
      await fn(ctx, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
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
      memoriesOperations, // Return the batched operations!
      storyCardOperations // Return the batched operations!
    };
  }
};

Comlink.expose(runnerApi);
export type RunnerApi = typeof runnerApi;