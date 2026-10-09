import base from "../../fixtures/sample/base.ts.txt?raw";
import local from "../../fixtures/sample/local.ts.txt?raw";
import remote from "../../fixtures/sample/remote.ts.txt?raw";
import type { MergeTexts } from "./useMergeController";

export const SAMPLE = {
  path: "src/cart.ts",
  texts: { local, base, remote, language: "typescript" },
} satisfies { path: string; texts: MergeTexts };
