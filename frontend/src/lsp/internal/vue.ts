import { nodeHint } from "./install";
import { modulePackage, nearestPackage, type Place } from "./project";
import type { FoundSpec, TypeScriptProgram } from "./spec";
import { absolutePath } from "./uri";

export type TypeScriptRun =
  | { readonly kind: "noPlugins"; readonly program: TypeScriptProgram; readonly version: string }
  | { readonly kind: "plugins" };

const VUE = "vue";
const PLUGIN = "@vue/typescript-plugin";

export const VUE_FILES: readonly string[] = [modulePackage(VUE), modulePackage(PLUGIN)];

export function withVue(
  project: Place,
  typescript: FoundSpec,
  run: TypeScriptRun,
  root: string,
): readonly FoundSpec[] {
  if (nearestPackage(project, VUE) === undefined) {
    return [typescript];
  }
  if (run.kind === "noPlugins") {
    const { program, version } = run;
    return [{ ...typescript, notes: [{ kind: "vueNeedsTypeScript6", program, version }] }];
  }
  if (nearestPackage(project, PLUGIN) !== undefined) {
    const location = absolutePath(root, project.folder);
    return [
      {
        ...typescript,
        fileTypes: [...typescript.fileTypes, VUE],
        initializationOptions: { plugins: [{ name: PLUGIN, location, languages: [VUE] }] },
      },
    ];
  }
  const install = nodeHint(project, { package: PLUGIN, program: PLUGIN }, { kind: "vue" });
  return [typescript, { ...typescript, name: "Vue", fileTypes: [VUE], install, help: null }];
}
