import {
  createDefaultMapFromCDN,
  createSystem,
  createVirtualTypeScriptEnvironment,
} from "@typescript/vfs";
import ts from "typescript";
import * as Comlink from "comlink";
import { createWorker } from "@valtown/codemirror-ts/worker";

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  lib: [
    "es2022",
  ],
  allowJs: true,
  checkJs: true,
  strict: false,
  noImplicitAny: false,
};

Comlink.expose(
  createWorker(async () => {
    const fsMap = await createDefaultMapFromCDN(
      compilerOptions,
      ts.version,
      false,
      ts,
    );
    const system = createSystem(fsMap);
    return createVirtualTypeScriptEnvironment(system, [], ts, compilerOptions);
  }),
);