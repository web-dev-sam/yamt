import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import { GENERATED_PATHS, globToRegExp, pathsFromToolInput, SHARED_PATHS, toRepoRelative } from "../lib/policy";

const REGISTRY = ".omp/run/slices.json";

function literalPrefix(glob: string): string {
  const wildcard = glob.search(/[*?]/);
  return wildcard === -1 ? glob : glob.slice(0, wildcard);
}

function globsOverlap(a: string, b: string): boolean {
  return globToRegExp(b).test(literalPrefix(a)) || globToRegExp(a).test(literalPrefix(b));
}

function registryProblem(content: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return `invalid JSON: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return "top level must be an object keyed by task name";

  const slices: Array<[string, string[]]> = [];
  for (const [name, slice] of Object.entries(parsed)) {
    const owned: unknown = slice !== null && typeof slice === "object" ? Reflect.get(slice, "owned") : undefined;
    if (!Array.isArray(owned) || !owned.every((g): g is string => typeof g === "string")) {
      return `${name}: "owned" must be an array of glob strings`;
    }
    slices.push([name, owned]);
  }

  for (const [name, owned] of slices) {
    for (const glob of owned) {
      const shared = SHARED_PATHS.find((p) => globsOverlap(glob, p));
      if (shared !== undefined) return `${name} owns ${glob}, which covers shared file ${shared}; shared files are never owned (OR1)`;
      const generated = GENERATED_PATHS.find((p) => globsOverlap(glob, p));
      if (generated !== undefined) return `${name} owns ${glob}, which covers generated ${generated}; regenerate it after applying patches instead`;
    }
  }

  for (const [i, [nameA, ownedA]] of slices.entries()) {
    for (const [nameB, ownedB] of slices.slice(i + 1)) {
      for (const a of ownedA) {
        const b = ownedB.find((g) => globsOverlap(a, g));
        if (b !== undefined) return `${nameA} (${a}) and ${nameB} (${b}) overlap; owned globs are pairwise disjoint (OR1)`;
      }
    }
  }
  return undefined;
}

export default function sliceRegistry(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;
    const targetsRegistry = pathsFromToolInput(event.toolName, event.input).some((p) => toRepoRelative(p, ctx.cwd) === REGISTRY);
    if (!targetsRegistry) return;
    if (event.toolName === "edit") {
      return { block: true, reason: `[slice-registry/OR1] ${REGISTRY} is always written whole with \`write\`, so the hook can validate it.` };
    }
    const content = event.input.content;
    const problem = typeof content === "string" ? registryProblem(content) : "write has no string content";
    if (problem === undefined) return;
    return { block: true, reason: `[slice-registry/OR1] ${REGISTRY}: ${problem}` };
  });
}
