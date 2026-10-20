import { candidates } from "./candidates";
import {
  ECOSYSTEMS,
  fileHolds,
  joined,
  manifestPaths,
  parentOf,
  projectOf,
  type Ecosystem,
} from "./ecosystems";
import { projectUri, type ProjectAt } from "./handshake";
import { nodeHint, serverHint, type NodeHint } from "./install";
import { integrationsOn } from "./integrations";
import { isObject } from "./json";
import { DETECTED_PRESETS, type DetectedPreset } from "./presets";
import {
  foundAnywhere,
  hasConfig,
  inProject,
  jsonField,
  nearest,
  nearestPackage,
  projectProgram,
  readFiles,
  type Project,
  type ProjectLookups,
} from "./project";
import { extensionOf, serverKey, type FoundSpec, type InstallHint, type ServerSpec } from "./spec";
import type { Command, Formats, Look, Sign, Tool } from "./tool";
import { withVue, type TypeScriptRun } from "./vue";

type Detected = {
  readonly tool: Tool;
  readonly command: Command;
  readonly install: InstallHint | null;
  readonly help: InstallHint | null;
  readonly typescript: TypeScriptRun | null;
};

const ROOT_LABEL = "repository root";
const PYTHON = "python";

function installed(tool: Tool, command: Command, help: InstallHint | null): Detected {
  return { tool, command, install: null, help, typescript: null };
}

function servingEcosystems(path: string): readonly Ecosystem[] {
  const extension = extensionOf(path);
  const serving = DETECTED_PRESETS.filter((preset) => preset.fileTypes.includes(extension));
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

function signHolds(project: Project, sign: Sign): boolean {
  switch (sign.kind) {
    case "manifest":
      return true;
    case "file":
      return hasConfig(project, [sign.name]);
    case "section":
      return fileHolds(project.files.get(joined(project.folder, sign.file)), sign.line);
  }
}

async function serverOf(
  project: Project,
  tool: Tool,
  command: Command,
  hint: InstallHint,
): Promise<Detected> {
  return (await foundAnywhere(project, command.program))
    ? installed(tool, command, hint)
    : { tool, command, install: hint, help: null, typescript: null };
}

async function typescript(
  project: Project,
  preset: DetectedPreset,
  look: Extract<Look, { kind: "typescript" }>,
): Promise<Detected | null> {
  const version = jsonField(nearestPackage(project, look.package), "version");
  const major = /^\d+/.exec(version ?? "")?.[0];
  if (version === null || major === undefined || !hasConfig(project, look.configs)) {
    return null;
  }
  if (Number(major) >= look.firstLspMajor) {
    const run = { kind: "noPlugins", program: "tsc", version } satisfies TypeScriptRun;
    return { ...installed(preset, look.compiler, null), typescript: run };
  }
  if (await inProject(project, look.nativePreview.program)) {
    const run = { kind: "noPlugins", program: "tsgo", version } satisfies TypeScriptRun;
    return { ...installed(preset, look.nativePreview, null), typescript: run };
  }
  const { command, package: name } = look.server;
  const reason: NodeHint["reason"] = { kind: "typescript", version };
  const hint = nodeHint(project, { package: name, program: command.program }, reason);
  const server = await serverOf(project, preset, command, hint);
  return { ...server, typescript: { kind: "plugins" } };
}

async function used(
  project: Project,
  preset: DetectedPreset,
  look: Extract<Look, { kind: "used" }>,
): Promise<Detected | null> {
  const { command } = look;
  const hint = serverHint(project, look);
  if (look.signs.some((sign) => signHolds(project, sign))) {
    if (await foundAnywhere(project, command.program)) {
      return installed(preset, command, hint);
    }
    for (const other of look.orElse) {
      if (await foundAnywhere(project, other.command.program)) {
        return installed(other, other.command, null);
      }
    }
    return { tool: preset, command, install: hint, help: null, typescript: null };
  }
  return look.orProjectProgram && (await inProject(project, command.program))
    ? installed(preset, command, hint)
    : null;
}

async function lookIn(project: Project, preset: DetectedPreset): Promise<Detected | null> {
  const { look } = preset;
  switch (look.kind) {
    case "projectProgram":
      return (await inProject(project, look.command.program))
        ? installed(preset, look.command, null)
        : null;
    case "used":
      return used(project, preset, look);
    case "typescript":
      return typescript(project, preset, look);
    case "eslint": {
      const configured = hasConfig(project, look.configs);
      return configured && nearestPackage(project, look.package) !== undefined
        ? serverOf(project, preset, look.server.command, serverHint(project, look))
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

async function fromProject(project: Project, tool: Tool, spec: FoundSpec): Promise<FoundSpec> {
  const from = tool.fromProject;
  switch (from.kind) {
    case "nothing":
      return spec;
    case "integrations": {
      const own = isObject(spec.initializationOptions) ? spec.initializationOptions : {};
      const on = integrationsOn(project, from.integrations);
      const keys = Object.fromEntries(on.map(({ key }) => [key, true]));
      const formats = spec.formats || on.some((integration) => integration.formats);
      return { ...spec, formats, initializationOptions: { ...own, ...keys } };
    }
    case "venvPython": {
      const pythonPath = await projectProgram(project, PYTHON);
      return pythonPath === null ? spec : { ...spec, settings: { python: { pythonPath } } };
    }
  }
}

async function specsOf(
  project: Project,
  preset: DetectedPreset,
  detected: Detected,
  root: string,
): Promise<readonly FoundSpec[]> {
  const { tool } = detected;
  const workspaceUri = projectUri({ folder: project.folder, root });
  const spec = await fromProject(project, tool, {
    name: tool.name,
    command: detected.command,
    project: project.folder,
    folders: ECOSYSTEMS[preset.ecosystem].folders,
    fileTypes: preset.fileTypes,
    formats: formatsIn(project, tool.formats),
    settings: tool.settings,
    initializationOptions: tool.initializationOptions?.(workspaceUri) ?? null,
    install: detected.install,
    help: detected.help,
    notes: [],
  });
  return detected.typescript === null ? [spec] : withVue(project, spec, detected.typescript, root);
}

async function detectIn(
  lookups: ProjectLookups,
  { folder, root }: ProjectAt,
  ecosystems: ReadonlySet<Ecosystem>,
): Promise<readonly FoundSpec[]> {
  const files = await readFiles(lookups, candidates(folder, ecosystems));
  const presets = DETECTED_PRESETS.filter((preset) => ecosystems.has(preset.ecosystem));
  const specs = await Promise.all(
    presets.map(async (preset) => {
      const project = { ecosystem: preset.ecosystem, folder, files, lookups };
      const detected = await lookIn(project, preset);
      return detected === null ? [] : specsOf(project, preset, detected, root);
    }),
  );
  return specs.flat();
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
    const labelled = `${spec.name} (${spec.project === "" ? ROOT_LABEL : spec.project})`;
    return { ...spec, key: serverKey(labelled), name: shared ? labelled : spec.name };
  });
}
