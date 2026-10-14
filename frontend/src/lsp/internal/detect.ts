import type { ProgramFound, ProjectFile, ServerHost } from "../../ipc";
import { projectUri, type ProjectAt } from "./handshake";
import { sectionOf } from "./json";
import { LOCK_FILES, packageManager } from "./packageManager";
import { PRESETS, type Look, type Preset } from "./presets";
import type { InstallHint, PackageManager, ServerSpec } from "./spec";

export type ProjectLookups = Pick<ServerHost, "findProgram" | "projectFiles">;

type Files = ReadonlyMap<string, ProjectFile>;

type Project = {
  readonly folder: string;
  readonly files: Files;
  readonly lookups: ProjectLookups;
  readonly manager: PackageManager | null;
};

type Detected = { readonly command: ServerSpec["command"]; readonly install: InstallHint | null };

type ServerLook = Extract<Look, { kind: "typescript" | "eslint" }>;

const PACKAGE_JSON = "package.json";
const ROOT_LABEL = "repository root";

function joined(folder: string, name: string): string {
  return folder === "" ? name : `${folder}/${name}`;
}

function parentOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf("/"), 0));
}

function foldersUp(folder: string): readonly string[] {
  return folder === "" ? [""] : [folder, ...foldersUp(parentOf(folder))];
}

function modulePackage(folder: string, name: string): string {
  return joined(folder, `node_modules/${name}/${PACKAGE_JSON}`);
}

function present(file: ProjectFile | undefined): file is ProjectFile {
  return file !== undefined && file.kind !== "Missing" && file.kind !== "Folder";
}

function jsonField(file: ProjectFile | undefined, field: string): string | null {
  if (file?.kind !== "Text") {
    return null;
  }
  try {
    const value = sectionOf(JSON.parse(file.text), field);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

async function readFiles(lookups: ProjectLookups, paths: readonly string[]): Promise<Files> {
  const unique = [...new Set(paths)];
  const answers = await lookups.projectFiles(unique).catch((): readonly ProjectFile[] => []);
  return new Map(
    unique.map((path, index): [string, ProjectFile] => [
      path,
      answers[index] ?? { kind: "Missing" },
    ]),
  );
}

function findProgram(project: Project, program: string): Promise<ProgramFound> {
  return project.lookups
    .findProgram(program, project.folder)
    .catch((): ProgramFound => ({ kind: "NotFound", searched: [] }));
}

async function inProject(project: Project, program: string): Promise<boolean> {
  const found = await findProgram(project, program);
  return found.kind === "Found" && found.place === "Project";
}

async function projectFolders(
  lookups: ProjectLookups,
  paths: readonly string[],
): Promise<readonly string[]> {
  const chains = paths.map((path) => foldersUp(parentOf(path)));
  const manifests = chains.flat().map((folder) => joined(folder, PACKAGE_JSON));
  const files = await readFiles(lookups, manifests);
  const projects = chains.flatMap(
    (chain) => chain.find((folder) => present(files.get(joined(folder, PACKAGE_JSON)))) ?? [],
  );
  return [...new Set(projects)].sort();
}

function lookedFor(look: Look): { configs: readonly string[]; packages: readonly string[] } {
  switch (look.kind) {
    case "projectProgram":
      return { configs: [], packages: [] };
    case "typescript":
      return { configs: look.configs, packages: [look.package] };
    case "eslint":
      return { configs: look.configs, packages: [look.package] };
  }
}

function candidates(folder: string): readonly string[] {
  const wanted = PRESETS.map((preset) => lookedFor(preset.look));
  return [
    joined(folder, PACKAGE_JSON),
    ...wanted.flatMap(({ configs }) => configs.map((config) => joined(folder, config))),
    ...foldersUp(folder).flatMap((at) => [
      ...wanted.flatMap(({ packages }) => packages.map((name) => modulePackage(at, name))),
      ...LOCK_FILES.map((lock) => joined(at, lock)),
    ]),
  ];
}

function nearestPackage(project: Project, name: string): ProjectFile | undefined {
  return foldersUp(project.folder)
    .map((at) => project.files.get(modulePackage(at, name)))
    .find(present);
}

function hasConfig(project: Project, configs: readonly string[]): boolean {
  return configs.some((config) => present(project.files.get(joined(project.folder, config))));
}

async function serverOf(
  project: Project,
  server: ServerLook["server"],
  reason: InstallHint["reason"],
): Promise<Detected> {
  const found = await findProgram(project, server.command.program);
  const install = {
    package: server.package,
    program: server.command.program,
    folder: project.folder,
    manager: project.manager,
    reason,
  };
  return { command: server.command, install: found.kind === "Found" ? null : install };
}

async function typescript(
  project: Project,
  look: Extract<Look, { kind: "typescript" }>,
): Promise<Detected | null> {
  const version = jsonField(nearestPackage(project, look.package), "version");
  const major = /^\d+/.exec(version ?? "")?.[0];
  if (version === null || major === undefined || !hasConfig(project, look.configs)) {
    return null;
  }
  if (Number(major) >= look.firstLspMajor) {
    return { command: look.compiler, install: null };
  }
  if (await inProject(project, look.nativePreview.program)) {
    return { command: look.nativePreview, install: null };
  }
  return serverOf(project, look.server, { kind: "typescript", version });
}

async function lookIn(project: Project, look: Look): Promise<Detected | null> {
  switch (look.kind) {
    case "projectProgram":
      return (await inProject(project, look.command.program))
        ? { command: look.command, install: null }
        : null;
    case "typescript":
      return typescript(project, look);
    case "eslint": {
      const used = hasConfig(project, look.configs);
      return used && nearestPackage(project, look.package) !== undefined
        ? serverOf(project, look.server, { kind: "eslint" })
        : null;
    }
  }
}

function specOf(preset: Preset, detected: Detected, at: ProjectAt): ServerSpec {
  return {
    name: preset.name,
    command: detected.command,
    project: at.folder,
    fileTypes: preset.fileTypes,
    formats: preset.formats,
    settings: preset.settings,
    initializationOptions: preset.initializationOptions?.(projectUri(at)) ?? null,
    install: detected.install,
  };
}

async function detectIn(lookups: ProjectLookups, at: ProjectAt): Promise<readonly ServerSpec[]> {
  const { folder } = at;
  const files = await readFiles(lookups, candidates(folder));
  const nearestLock = foldersUp(folder)
    .flatMap((up) => LOCK_FILES.filter((lock) => present(files.get(joined(up, lock)))))
    .at(0);
  const declared = jsonField(files.get(joined(folder, PACKAGE_JSON)), "packageManager");
  const manager = packageManager(declared, nearestLock ?? null);
  const project = { folder, files, lookups, manager };
  const found = await Promise.all(
    PRESETS.map(async (preset) => {
      const detected = await lookIn(project, preset.look);
      return detected === null ? [] : [specOf(preset, detected, at)];
    }),
  );
  return found.flat();
}

export async function detect(
  paths: readonly string[],
  lookups: ProjectLookups,
  root: string,
): Promise<readonly ServerSpec[]> {
  const folders = await projectFolders(lookups, paths);
  const found = (
    await Promise.all(folders.map((folder) => detectIn(lookups, { folder, root })))
  ).flat();
  return found.map((spec) => {
    const shared = found.filter((other) => other.name === spec.name).length > 1;
    const label = spec.project === "" ? ROOT_LABEL : spec.project;
    return shared ? { ...spec, name: `${spec.name} (${label})` } : spec;
  });
}
