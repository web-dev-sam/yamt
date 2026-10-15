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

export function tomlTable(name: string): RegExp {
  return new RegExp(`^[ \\t]*\\[${name.replaceAll(".", "\\.")}[\\].]`, "m");
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
    rules: [[{ path: "Cargo.toml", holding: tomlTable("workspace") }], manifests("Cargo.toml")],
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

function everyEntry(pick: (folders: ProgramFolders) => readonly string[]): string[] {
  return [...new Set(Object.values(ECOSYSTEMS).flatMap(({ folders }) => pick(folders)))];
}

export const EVERY_ECOSYSTEM_FOLDERS: ProgramFolders = {
  project: everyEntry(({ project }) => project),
  home: everyEntry(({ home }) => home),
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

export function fileHolds(file: ProjectFile | undefined, pattern: RegExp): boolean {
  return file?.kind === "Text" && pattern.test(file.text);
}

export function manifestPaths(ecosystem: Ecosystem, folder: string): readonly string[] {
  return ECOSYSTEMS[ecosystem].rules.flatMap((rule) =>
    foldersUp(folder).flatMap((at) => rule.map((manifest) => joined(at, manifest.path))),
  );
}

function holds(files: Files, folder: string, manifest: Manifest): boolean {
  const file = files.get(joined(folder, manifest.path));
  return manifest.holding === null ? present(file) : fileHolds(file, manifest.holding);
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
