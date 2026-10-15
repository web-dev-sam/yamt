import { joined, PACKAGE_JSON } from "./ecosystems";
import {
  LOCK_FILES,
  packageManager,
  PYTHON_LOCK_FILES,
  PYTHON_LOCK_MANAGER,
} from "./packageManager";
import type { Recipe } from "./presets";
import { jsonField, nearest, type Project } from "./project";
import type { InstallHint } from "./spec";

export type NodeHint = Extract<InstallHint, { kind: "node" }>;

export function nodeHint(
  project: Project,
  { package: name, program }: Pick<NodeHint, "package" | "program">,
  reason: NodeHint["reason"],
): NodeHint {
  const manifest = project.files.get(joined(project.folder, PACKAGE_JSON));
  const manager = packageManager(
    jsonField(manifest, "packageManager"),
    nearest(project, LOCK_FILES),
  );
  return { kind: "node", package: name, program, folder: project.folder, manager, reason };
}

export function recipeHint(project: Project, recipe: Recipe, program: string): InstallHint {
  switch (recipe.kind) {
    case "python": {
      const lock = nearest(project, PYTHON_LOCK_FILES);
      const manager = lock === null ? null : PYTHON_LOCK_MANAGER[lock];
      return { kind: "python", package: recipe.package, program, folder: project.folder, manager };
    }
    case "rustup":
      return { kind: "rustup", component: recipe.component, program };
    case "go":
      return { kind: "go", module: recipe.module, program };
    case "download":
      return { kind: "download", program, command: recipe.command, needs: recipe.needs };
    case "system":
      return { kind: "system", program };
  }
}
