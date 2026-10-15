import { nodeHint } from "./install";
import { modulePackage, nearestPackage, type Place } from "./project";
import type { ServerSpec } from "./spec";

export type TypeScriptRun = { readonly version: string; readonly runsPlugins: boolean };

const VUE = "vue";
const PLUGIN = "@vue/typescript-plugin";

export const VUE_FILES: readonly string[] = [modulePackage(VUE), modulePackage(PLUGIN)];

function absoluteFolder(root: string, folder: string): string {
  const separator = root.includes("\\") ? "\\" : "/";
  return folder === "" ? root : [root, ...folder.split("/")].join(separator);
}

export function withVue(
  project: Place,
  typescript: ServerSpec,
  run: TypeScriptRun,
  root: string,
): readonly ServerSpec[] {
  if (nearestPackage(project, VUE) === undefined) {
    return [typescript];
  }
  if (!run.runsPlugins) {
    return [{ ...typescript, notes: [{ kind: "vueNeedsTypeScript6", version: run.version }] }];
  }
  if (nearestPackage(project, PLUGIN) !== undefined) {
    const location = absoluteFolder(root, project.folder);
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
