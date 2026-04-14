import {
  createDefaultMapFromCDN,
  createSystem,
  createVirtualTypeScriptEnvironment,
} from "@typescript/vfs";
import ts from "typescript";
import * as Comlink from "comlink";
import { createWorker } from "@valtown/codemirror-ts/worker";

const IGNORED_DIAGNOSTICS = [
  1375,
  1378,
];

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
    const env = createVirtualTypeScriptEnvironment(system, [], ts, compilerOptions);

    const originalGetSemanticDiagnostics = env.languageService.getSemanticDiagnostics;
    env.languageService.getSemanticDiagnostics = (fileName) => {
      const diagnostics = originalGetSemanticDiagnostics(fileName);
      return diagnostics.filter((d) => !IGNORED_DIAGNOSTICS.includes(d.code));
    };

    const originalGetSyntacticDiagnostics = env.languageService.getSyntacticDiagnostics;
    env.languageService.getSyntacticDiagnostics = (fileName) => {
      const diagnostics = originalGetSyntacticDiagnostics(fileName);
      return diagnostics.filter((d) => !IGNORED_DIAGNOSTICS.includes(d.code));
    };

    return env;
  }),
);