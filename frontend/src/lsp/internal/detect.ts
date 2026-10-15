import type { ProjectFile } from "../../ipc";
import {
  ECOSYSTEMS,
  foldersUp,
  joined,
  manifestPaths,
  PACKAGE_JSON,
  parentOf,
  present,
  projectOf,
  type Ecosystem,
} from "./ecosystems";
import { projectUri, type ProjectAt } from "./handshake";
import { nodeHint, recipeHint, type NodeHint } from "./install";
import { LOCK_FILES, PYTHON_LOCK_FILES } from "./packageManager";
import { PRESETS, type Formats, type Look, type Preset, type Sign, type Tool } from "./presets";
import {
  foundAnywhere,
  hasConfig,
  inProject,
  jsonField,
  nearest,
  readFiles,
  type Project,
  type ProjectLookups,
} from "./project";
import { extensionOf, type InstallHint, type ServerSpec } from "./spec";

type Command = ServerSpec["command"];

type Detected = {
  readonly tool: Tool;
  readonly command: Command;
  readonly install: InstallHint | null;
};

type Wanted = { readonly here: readonly string[]; readonly up: readonly string[] };

const ROOT_LABEL = "repository root";

function modulePackage(name: string): string {
  return `node_modules/${name}/${PACKAGE_JSON}`;
}

function servingEcosystems(path: string): readonly Ecosystem[] {
  const extension = extensionOf(path);
  const serving = PRESETS.filter((preset) => preset.fileTypes.includes(extension));
  return [...new Set(serving.map((preset) => preset.ecosystem))];
}

async function projectsOf(
  lookups: ProjectLookups,
  paths: readonly string[],
): Promise<readonly (readonly [string, ReadonlySet<Ecosystem>])[]> {
  const joins = paths.flatMap((path) =>
    servingEcosystems(path).map((ecosystem) => ({ ecosystem, folder: parentOf(path) })),
  );
  const files = await readFiles(
    lookups,
    joins.flatMap(({ ecosystem, folder }) => manifestPaths(ecosystem, folder)),
  );
  const projects = new Map<string, Set<Ecosystem>>();
  for (const { ecosystem, folder } of joins) {
    const project = projectOf(ecosystem, folder, files);
    if (project !== null) {
      projects.set(project, (projects.get(project) ?? new Set()).add(ecosystem));
    }
  }
  return [...projects].sort(([a], [b]) => (a < b ? -1 : 1));
}

function signFile(sign: Sign): readonly string[] {
  switch (sign.kind) {
    case "manifest":
      return [];
    case "file":
      return [sign.name];
    case "section":
      return [sign.file];
  }
}

function formatConfigs(formats: Formats): readonly string[] {
  return formats.kind === "withConfig" ? formats.files : [];
}

function lookedFor(preset: Preset): Wanted {
  const { look } = preset;
  switch (look.kind) {
    case "projectProgram":
      return { here: [], up: formatConfigs(preset.formats) };
    case "used": {
      const tools = [preset, ...look.orElse];
      return {
        here: look.signs.flatMap(signFile),
        up: tools.flatMap((tool) => formatConfigs(tool.formats)),
      };
    }
    case "typescript":
    case "eslint":
      return {
        here: look.configs,
        up: [...formatConfigs(preset.formats), modulePackage(look.package)],
      };
  }
}

function ecosystemFiles(ecosystem: Ecosystem): Wanted {
  switch (ecosystem) {
    case "node":
      return { here: [PACKAGE_JSON], up: LOCK_FILES };
    case "python":
      return { here: [], up: PYTHON_LOCK_FILES };
    case "rust":
    case "go":
    case "php":
    case "clang":
      return { here: [], up: [] };
  }
}

function candidates(folder: string, ecosystems: ReadonlySet<Ecosystem>): readonly string[] {
  const wanted = [
    ...PRESETS.filter((preset) => ecosystems.has(preset.ecosystem)).map(lookedFor),
    ...[...ecosystems].map(ecosystemFiles),
  ];
  return [
    ...wanted.flatMap(({ here }) => here.map((name) => joined(folder, name))),
    ...foldersUp(folder).flatMap((at) =>
      wanted.flatMap(({ up }) => up.map((name) => joined(at, name))),
    ),
  ];
}

function signHolds(project: Project, sign: Sign): boolean {
  switch (sign.kind) {
    case "manifest":
      return true;
    case "file":
      return hasConfig(project, [sign.name]);
    case "section": {
      const file = project.files.get(joined(project.folder, sign.file));
      return file?.kind === "Text" && sign.line.test(file.text);
    }
  }
}

function nearestPackage(project: Project, name: string): ProjectFile | undefined {
  return foldersUp(project.folder)
    .map((at) => project.files.get(joined(at, modulePackage(name))))
    .find(present);
}

async function serverOf(
  project: Project,
  tool: Tool,
  server: Extract<Look, { kind: "typescript" | "eslint" }>["server"],
  reason: NodeHint["reason"],
): Promise<Detected> {
  const { command } = server;
  const install = nodeHint(project, { package: server.package, program: command.program }, reason);
  const installed = await foundAnywhere(project, command.program);
  return { tool, command, install: installed ? null : install };
}

async function typescript(
  project: Project,
  preset: Preset,
  look: Extract<Look, { kind: "typescript" }>,
): Promise<Detected | null> {
  const version = jsonField(nearestPackage(project, look.package), "version");
  const major = /^\d+/.exec(version ?? "")?.[0];
  if (version === null || major === undefined || !hasConfig(project, look.configs)) {
    return null;
  }
  if (Number(major) >= look.firstLspMajor) {
    return { tool: preset, command: look.compiler, install: null };
  }
  if (await inProject(project, look.nativePreview.program)) {
    return { tool: preset, command: look.nativePreview, install: null };
  }
  return serverOf(project, preset, look.server, { kind: "typescript", version });
}

async function used(
  project: Project,
  preset: Preset,
  look: Extract<Look, { kind: "used" }>,
): Promise<Detected | null> {
  const { command } = look;
  if (look.signs.some((sign) => signHolds(project, sign))) {
    for (const choice of [{ ...preset, command }, ...look.orElse]) {
      if (await foundAnywhere(project, choice.command.program)) {
        return { tool: choice, command: choice.command, install: null };
      }
    }
    return { tool: preset, command, install: recipeHint(project, look.recipe, command.program) };
  }
  return look.orProjectProgram && (await inProject(project, command.program))
    ? { tool: preset, command, install: null }
    : null;
}

async function lookIn(project: Project, preset: Preset): Promise<Detected | null> {
  const { look } = preset;
  switch (look.kind) {
    case "projectProgram":
      return (await inProject(project, look.command.program))
        ? { tool: preset, command: look.command, install: null }
        : null;
    case "used":
      return used(project, preset, look);
    case "typescript":
      return typescript(project, preset, look);
    case "eslint": {
      const configured = hasConfig(project, look.configs);
      return configured && nearestPackage(project, look.package) !== undefined
        ? serverOf(project, preset, look.server, { kind: "eslint" })
        : null;
    }
  }
}

function formatsIn(project: Project, formats: Formats): boolean {
  switch (formats.kind) {
    case "always":
      return true;
    case "never":
      return false;
    case "withConfig":
      return nearest(project, formats.files) !== null;
  }
}

function specOf(project: Project, preset: Preset, detected: Detected, root: string): ServerSpec {
  const { tool } = detected;
  const workspaceUri = projectUri({ folder: project.folder, root });
  return {
    name: tool.name,
    command: detected.command,
    project: project.folder,
    folders: ECOSYSTEMS[preset.ecosystem].folders,
    fileTypes: preset.fileTypes,
    formats: formatsIn(project, tool.formats),
    settings: tool.settings,
    initializationOptions: tool.initializationOptions?.(workspaceUri) ?? null,
    install: detected.install,
  };
}

async function detectIn(
  lookups: ProjectLookups,
  { folder, root }: ProjectAt,
  ecosystems: ReadonlySet<Ecosystem>,
): Promise<readonly ServerSpec[]> {
  const files = await readFiles(lookups, candidates(folder, ecosystems));
  const found = await Promise.all(
    PRESETS.filter((preset) => ecosystems.has(preset.ecosystem)).map(async (preset) => {
      const project = { ecosystem: preset.ecosystem, folder, files, lookups };
      const detected = await lookIn(project, preset);
      return detected === null ? [] : [specOf(project, preset, detected, root)];
    }),
  );
  return found.flat();
}

export async function detect(
  paths: readonly string[],
  lookups: ProjectLookups,
  root: string,
): Promise<readonly ServerSpec[]> {
  const projects = await projectsOf(lookups, paths);
  const found = (
    await Promise.all(
      projects.map(([folder, ecosystems]) => detectIn(lookups, { folder, root }, ecosystems)),
    )
  ).flat();
  return found.map((spec) => {
    const shared = found.filter((other) => other.name === spec.name).length > 1;
    const label = spec.project === "" ? ROOT_LABEL : spec.project;
    return shared ? { ...spec, name: `${spec.name} (${label})` } : spec;
  });
}
