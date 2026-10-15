import { joined, PACKAGE_JSON, type Ecosystem } from "./ecosystems";
import {
  LOCK_FILES,
  packageManager,
  PYTHON_LOCK_FILES,
  PYTHON_LOCK_MANAGER,
} from "./packageManager";
import { jsonField, nearest, type Place, type Wanted } from "./project";
import type { InstallHint } from "./spec";
import type { Look, Recipe } from "./tool";

export type NodeHint = Extract<InstallHint, { kind: "node" }>;

const NOTHING_READ: Wanted = { here: [], up: [] };

export const HINT_FILES: Readonly<Record<Ecosystem, Wanted>> = {
  node: { here: [PACKAGE_JSON], up: LOCK_FILES },
  python: { here: [], up: PYTHON_LOCK_FILES },
  rust: NOTHING_READ,
  go: NOTHING_READ,
  php: NOTHING_READ,
  clang: NOTHING_READ,
};

export function nodeHint(
  project: Place,
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

function recipeHint(project: Place, recipe: Recipe, program: string): InstallHint {
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

export function serverHint(
  place: Place,
  look: Extract<Look, { kind: "used" | "eslint" }>,
): InstallHint {
  switch (look.kind) {
    case "used":
      return recipeHint(place, look.recipe, look.command.program);
    case "eslint": {
      const { command, package: name } = look.server;
      return nodeHint(place, { package: name, program: command.program }, { kind: "eslint" });
    }
  }
}
