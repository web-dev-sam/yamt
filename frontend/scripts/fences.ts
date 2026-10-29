import { globSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

import { parse } from "@vue/compiler-sfc";
import ts from "typescript";

import { agentViolations } from "./agentFence";
import { clipboardViolations } from "./clipboardFence";
import { markdownViolations } from "./markdownFence";

export type SourceFile = { readonly path: string; readonly text: string };

export type FenceViolation = {
  readonly rule: "PM2" | "PM3" | "PM5" | "PM7" | "PM8" | "PM9";
  readonly file: string;
  readonly specifier: string;
  readonly reason: string;
};

type Finding = Pick<FenceViolation, "rule" | "reason">;

type Edge = { readonly specifier: string; readonly file: string };

type Root = "merge" | "compare" | "range";

type WindowRoot = Exclude<Root, "merge">;

const SKIPPED_FILE = "src/ipc/bindings.ts";
const QUERY_SUFFIX = /\?.*$/;
const MODULE_OF = /^src\/([^/]+)\//;
const RESOLVE_SUFFIXES = ["", ".ts", ".vue", "/index.ts"] as const;
const FRAMEWORK_FREE_MODULES: Readonly<Record<string, "framework-free" | "self-contained">> = {
  editor: "framework-free",
  model: "framework-free",
  connectors: "framework-free",
  lsp: "framework-free",
  jsonrpc: "self-contained",
  agent: "framework-free",
  search: "self-contained",
};
const AGENT_IMPORTS: Readonly<Record<string, true>> = {
  "src/ipc": true,
  "src/ipc/index": true,
  "src/ipc/index.ts": true,
  "src/jsonrpc": true,
  "src/jsonrpc/index": true,
  "src/jsonrpc/index.ts": true,
};
const LSP_FORBIDDEN_MODULES = ["src/editor", "src/ui", "src/model", "src/connectors"] as const;
const FRAMEWORK_PACKAGE_PREFIXES = ["vue/", "@vue/", "@vueuse/", "@tauri-apps/"] as const;
const ICON_PREFIX = "~icons/";
const RAW_QUERY = "?raw";
const SOURCE_EXTENSION = /\.(?:ts|vue)$/;
const TEST_SOURCE_EXTENSION = /(?:\.test)?\.(?:ts|vue)$/;
const ROOT_FILES: Readonly<Record<string, Root>> = {
  "src/ui/store": "merge",
  "src/ui/App": "merge",
  "src/ui/compareStore": "compare",
  "src/ui/CompareApp": "compare",
  "src/ui/rangeStore": "range",
  "src/ui/RangeApp": "range",
};
const WINDOW_FILE = /^src\/ui\/(?:use)?(compare|range)[^/]*\.(?:ts|vue)$/i;
const WINDOW_RULES: Readonly<Record<WindowRoot, "PM7" | "PM9">> = {
  compare: "PM7",
  range: "PM9",
};
const AI_FILES: Readonly<Record<string, true>> = {
  "src/ui/AiTurn": true,
  "src/ui/AiStep": true,
  "src/ui/EditDiff": true,
  "src/ui/AgentSettings": true,
  "src/ui/aiClose": true,
};

function scriptTexts(file: SourceFile): string[] {
  if (!file.path.endsWith(".vue")) {
    return [file.text];
  }
  const { descriptor } = parse(file.text, { filename: file.path });
  return [descriptor.script, descriptor.scriptSetup].flatMap((block) =>
    block === null ? [] : [block.content],
  );
}

function isInside(path: string, directory: string): boolean {
  return path === directory || path.startsWith(`${directory}/`);
}

function relativeTarget(importer: string, bare: string): string | undefined {
  if (!bare.startsWith(".")) {
    return undefined;
  }
  return posix.join(posix.dirname(importer), bare).replace(/\/$/, "");
}

function packageFinding(module: string | undefined, specifier: string): Finding | undefined {
  const bare = specifier.replace(QUERY_SUFFIX, "");
  if (module === "ui" && bare.startsWith("@codemirror/")) {
    return { rule: "PM2", reason: "ui/ never imports CodeMirror; go through editor/index.ts" };
  }
  if (module === "ui" && bare.startsWith("@tauri-apps/")) {
    return { rule: "PM2", reason: "ui/ never imports Tauri; go through ipc/index.ts" };
  }
  if (module === undefined || !Object.hasOwn(FRAMEWORK_FREE_MODULES, module)) {
    return undefined;
  }
  if (bare === "vue" || FRAMEWORK_PACKAGE_PREFIXES.some((prefix) => bare.startsWith(prefix))) {
    return { rule: "PM3", reason: `${module}/ is framework-free` };
  }
  if (bare.startsWith(ICON_PREFIX) && !specifier.endsWith(RAW_QUERY)) {
    return {
      rule: "PM3",
      reason: `${module}/ is framework-free; an icon without ${RAW_QUERY} is a Vue component`,
    };
  }
  return undefined;
}

function pathFinding(module: string | undefined, target: string): Finding | undefined {
  if (module === "ui" && isInside(target, "src/editor/internal")) {
    return {
      rule: "PM2",
      reason: "ui/ never reaches editor/internal/; go through editor/index.ts",
    };
  }
  if (module === "ui" && isInside(target, "src/model")) {
    return { rule: "PM2", reason: "ui/ never imports model/" };
  }
  const forbidden = LSP_FORBIDDEN_MODULES.find((directory) => isInside(target, directory));
  if (module === "lsp" && forbidden !== undefined) {
    return { rule: "PM2", reason: `lsp/ never imports ${forbidden.slice("src/".length)}/` };
  }
  const selfContained = module !== undefined && FRAMEWORK_FREE_MODULES[module] === "self-contained";
  if (selfContained && target.startsWith("src/") && !isInside(target, `src/${module}`)) {
    return { rule: "PM2", reason: `${module}/ imports no other src/ module` };
  }
  const outsideAgent = target.startsWith("src/") && !isInside(target, "src/agent");
  if (module === "agent" && outsideAgent && !Object.hasOwn(AGENT_IMPORTS, target)) {
    return { rule: "PM2", reason: "agent/ imports only ipc/index.ts and jsonrpc/index.ts" };
  }
  const targetModule = MODULE_OF.exec(target)?.[1];
  const crossesInternal = targetModule !== module && target.split("/").includes("internal");
  if (targetModule !== undefined && crossesInternal) {
    return { rule: "PM5", reason: "no module imports another module's internal/" };
  }
  return undefined;
}

function isWindowRoot(name: string): name is WindowRoot {
  return Object.hasOwn(WINDOW_RULES, name);
}

function windowRoot(file: string): string {
  if (Object.hasOwn(AI_FILES, file.replace(TEST_SOURCE_EXTENSION, ""))) {
    return "range";
  }
  return WINDOW_FILE.exec(file)?.[1]?.toLowerCase() ?? "";
}

function rootFinding(file: string, target: string): Finding | undefined {
  const root = windowRoot(file);
  if (!isWindowRoot(root)) {
    return undefined;
  }
  const rule = WINDOW_RULES[root];
  const other = ROOT_FILES[target.replace(SOURCE_EXTENSION, "")];
  if (other !== undefined && other !== root) {
    return { rule, reason: `the ${root} window never imports the ${other} window's root` };
  }
  if (isInside(target, "src/lsp")) {
    return { rule, reason: `the ${root} window never imports lsp/` };
  }
  return undefined;
}

function aiFileFinding(file: string, target: string): Finding | undefined {
  const aiFile = Object.hasOwn(AI_FILES, target.replace(SOURCE_EXTENSION, ""));
  return aiFile && windowRoot(file) !== "range"
    ? { rule: "PM9", reason: "the AI's views and close question are the range window's only" }
    : undefined;
}

function stronglyConnected(graph: ReadonlyMap<string, readonly Edge[]>): string[][] {
  type Visit = { readonly index: number; low: number };
  const visits = new Map<string, Visit>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  function visit(node: string): Visit {
    const self: Visit = { index: visits.size, low: visits.size };
    visits.set(node, self);
    stack.push(node);
    onStack.add(node);
    for (const edge of graph.get(node) ?? []) {
      const seen = visits.get(edge.file);
      if (seen === undefined) {
        self.low = Math.min(self.low, visit(edge.file).low);
      } else if (onStack.has(edge.file)) {
        self.low = Math.min(self.low, seen.index);
      }
    }
    if (self.low === self.index) {
      const component = stack.splice(stack.lastIndexOf(node));
      component.forEach((member) => onStack.delete(member));
      components.push(component);
    }
    return self;
  }

  for (const node of graph.keys()) {
    if (!visits.has(node)) {
      visit(node);
    }
  }
  return components;
}

function isCycle(
  component: readonly string[],
  graph: ReadonlyMap<string, readonly Edge[]>,
): boolean {
  return (
    component.length > 1 ||
    component.some((node) => graph.get(node)?.some((edge) => edge.file === node) ?? false)
  );
}

function cycleViolations(graph: ReadonlyMap<string, readonly Edge[]>): FenceViolation[] {
  const cycles = stronglyConnected(graph).filter((component) => isCycle(component, graph));
  return cycles.flatMap((component) => {
    const members = component.toSorted();
    const [file] = members;
    const edge =
      file === undefined
        ? undefined
        : graph.get(file)?.find((candidate) => members.includes(candidate.file));
    if (file === undefined || edge === undefined) {
      return [];
    }
    return [
      {
        rule: "PM5",
        file,
        specifier: edge.specifier,
        reason: `import cycle: ${members.join(" ↔ ")}`,
      } satisfies FenceViolation,
    ];
  });
}

export function findFenceViolations(files: readonly SourceFile[]): FenceViolation[] {
  const known: ReadonlySet<string> = new Set(files.map((file) => file.path));
  const violations: FenceViolation[] = [];
  const graph = new Map<string, Edge[]>();
  for (const file of files) {
    const module = MODULE_OF.exec(file.path)?.[1];
    const edges: Edge[] = [];
    const texts = scriptTexts(file);
    const specifiers = texts.flatMap((text) =>
      ts.preProcessFile(text, true, true).importedFiles.map((reference) => reference.fileName),
    );
    for (const specifier of specifiers) {
      const bare = specifier.replace(QUERY_SUFFIX, "");
      const target = relativeTarget(file.path, bare);
      const finding =
        target === undefined
          ? packageFinding(module, specifier)
          : (pathFinding(module, target) ??
            rootFinding(file.path, target) ??
            aiFileFinding(file.path, target));
      if (finding !== undefined) {
        violations.push({ ...finding, file: file.path, specifier });
      }
      const resolved =
        target === undefined
          ? undefined
          : RESOLVE_SUFFIXES.map((suffix) => target + suffix).find((path) => known.has(path));
      if (resolved !== undefined) {
        edges.push({ specifier, file: resolved });
      }
    }
    violations.push(
      ...clipboardViolations(file.path, texts),
      ...markdownViolations(file.path, texts),
      ...agentViolations(file.path, texts),
    );
    graph.set(file.path, edges);
  }
  return [...violations, ...cycleViolations(graph)];
}

export function readSourceTree(frontendRoot: string): SourceFile[] {
  return globSync(["src/**/*.ts", "src/**/*.vue"], { cwd: frontendRoot })
    .filter((path) => path !== SKIPPED_FILE)
    .toSorted()
    .map((path) => ({ path, text: readFileSync(join(frontendRoot, path), "utf8") }));
}
