import type { ProgramFolders, ProjectFile } from "../../ipc";

export type Ecosystem = "node" | "python" | "rust" | "go" | "php" | "clang";

export type Files = ReadonlyMap<string, ProjectFile>;

type Manifest = { readonly path: string; readonly holding: RegExp | null };

type EcosystemFacts = {
  readonly rules: readonly (readonly Manifest[])[];
  readonly folders: ProgramFolders;
};

function manifests(...paths: string[]): readonly Manifest[] {
  return paths.map((path) => ({ path, holding: null }));
}

const VENV_FOLDERS = [".venv/bin", ".venv/Scripts", "venv/bin", "venv/Scripts"];

export const PACKAGE_JSON = "package.json";

export const ECOSYSTEMS: Readonly<Record<Ecosystem, EcosystemFacts>> = {
  node: {
    rules: [manifests(PACKAGE_JSON)],
    folders: { project: ["node_modules/.bin"], home: [] },
  },
  python: {
    rules: [manifests("pyproject.toml", "setup.py", "setup.cfg", "requirements.txt")],
    folders: { project: VENV_FOLDERS, home: [".local/bin"] },
  },
  rust: {
    rules: [[{ path: "Cargo.toml", holding: /^[ \t]*\[workspace[\].]/m }], manifests("Cargo.toml")],
    folders: { project: [], home: [".cargo/bin"] },
  },
  go: {
    rules: [manifests("go.work"), manifests("go.mod")],
    folders: { project: [], home: ["go/bin"] },
  },
  php: {
    rules: [manifests("composer.json")],
    folders: {
      project: ["vendor/bin"],
      home: [".config/composer/vendor/bin", ".composer/vendor/bin", ".local/bin"],
    },
  },
  clang: {
    rules: [
      manifests(
        "compile_commands.json",
        "build/compile_commands.json",
        "compile_flags.txt",
        ".clangd",
      ),
    ],
    folders: { project: [], home: [] },
  },
};

export function joined(folder: string, name: string): string {
  return folder === "" ? name : `${folder}/${name}`;
}

export function parentOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf("/"), 0));
}

export function foldersUp(folder: string): readonly string[] {
  return folder === "" ? [""] : [folder, ...foldersUp(parentOf(folder))];
}

export function present(file: ProjectFile | undefined): file is ProjectFile {
  return file !== undefined && file.kind !== "Missing" && file.kind !== "Folder";
}

export function manifestPaths(ecosystem: Ecosystem, folder: string): readonly string[] {
  return ECOSYSTEMS[ecosystem].rules.flatMap((rule) =>
    foldersUp(folder).flatMap((at) => rule.map((manifest) => joined(at, manifest.path))),
  );
}

function holds(files: Files, folder: string, manifest: Manifest): boolean {
  const file = files.get(joined(folder, manifest.path));
  if (manifest.holding === null) {
    return present(file);
  }
  return file?.kind === "Text" && manifest.holding.test(file.text);
}

export function projectOf(ecosystem: Ecosystem, folder: string, files: Files): string | null {
  for (const rule of ECOSYSTEMS[ecosystem].rules) {
    const found = foldersUp(folder).find((at) =>
      rule.some((manifest) => holds(files, at, manifest)),
    );
    if (found !== undefined) {
      return found;
    }
  }
  return null;
}
