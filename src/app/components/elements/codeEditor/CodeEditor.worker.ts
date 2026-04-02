import { type WorkerShape } from "@valtown/codemirror-ts/worker";
import { wrap } from "comlink";

const innerWorker = new Worker(
  new URL("./tsWorker.ts", import.meta.url),
  { type: "module" },
);

export const tsWorker = wrap<WorkerShape>(innerWorker);
export const tsWorkerReady: Promise<void> = tsWorker.initialize();