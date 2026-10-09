import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export const PRODUCT_CODE_ROOTS = ["crates/**", "frontend/**", "src-tauri/**", "tests/golden/**"];

export const ORCHESTRATOR_EDITABLE = [
  "frontend/package.json",
  "frontend/.oxlintrc.json",
  "frontend/.oxfmtrc.json",
  "frontend/eslint.config.js",
  "frontend/vite.config.ts",
  "frontend/tsconfig*.json",
  "src-tauri/Cargo.toml",
  "crates/*/Cargo.toml",
];

export const SHARED_PATHS = [
  "Cargo.toml",
  "Cargo.lock",
  "justfile",
  "frontend/package.json",
  "frontend/pnpm-lock.yaml",
];

export const MAX_PARALLEL_AGENTS = 2;

export const IMPLEMENTER_AGENTS: Record<string, true> = { "rust-impl": true, "web-impl": true };

export const SLICE_REGISTRY = ".omp/run/slices.json";

export const GENERATED_PATHS = [
  "frontend/src/ipc/bindings.ts",
  "Cargo.lock",
  "pnpm-lock.yaml",
  "frontend/pnpm-lock.yaml",
  "**/__snapshots__/**",
  "**/*.snap",
  "tests/golden/**/expected.json",
];

export type SliceOwnership = { owned: string[]; readonly?: string[] };
export type SliceRegistry = Record<string, SliceOwnership>;

export type AgentIdentity = { kind: "main" | "sub"; id: string; name: string };

export function globToRegExp(glob: string): RegExp {
  let out = "^";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        const slashFollows = glob[i + 2] === "/";
        out += slashFollows ? "(?:.*/)?" : ".*";
        i += slashFollows ? 2 : 1;
      } else {
        out += "[^/]*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else if (ch !== undefined && /[.+^${}()|[\]\\]/.test(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return new RegExp(`${out}$`);
}

export function matchesAny(path: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(path));
}

export function toRepoRelative(path: string, cwd: string): string {
  const abs = isAbsolute(path) ? path : resolve(cwd, path);
  const rel = relative(cwd, abs);
  return rel.split("\\").join("/");
}

export function escapesRepo(relPath: string): boolean {
  return relPath === ".." || relPath.startsWith("../") || isAbsolute(relPath);
}

const HASHLINE_HEADER = /^\[([^\]#]+)#[0-9A-Fa-f]{4}\]/gm;

export function pathsFromToolInput(toolName: string, input: Record<string, unknown>): string[] {
  const found = new Set<string>();
  if (typeof input.path === "string") found.add(input.path);
  if (Array.isArray(input.paths))
    for (const p of input.paths) if (typeof p === "string") found.add(p);
  if (toolName === "edit" && typeof input.input === "string") {
    for (const m of input.input.matchAll(HASHLINE_HEADER)) {
      const p = m[1];
      if (p !== undefined) found.add(p.trim());
    }
  }
  return [...found];
}

export function readSliceRegistry(cwd: string): SliceRegistry {
  try {
    const raw = readFileSync(resolve(cwd, SLICE_REGISTRY), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: SliceRegistry = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === null || typeof value !== "object" || !("owned" in value)) continue;
      const owned: unknown = value.owned;
      if (!Array.isArray(owned)) continue;
      out[key] = { owned: owned.filter((g): g is string => typeof g === "string") };
    }
    return out;
  } catch {
    return {};
  }
}

export function ownershipFor(
  agent: AgentIdentity,
  registry: SliceRegistry,
): SliceOwnership | undefined {
  return (
    registry[agent.id] ??
    registry[agent.name] ??
    registry[agent.id.toLowerCase()] ??
    registry[agent.name.toLowerCase()]
  );
}

const REDIRECT_TARGET =
  /(?:>>?|\btee\s+(?:-a\s+)?|\bcp\s+(?:-\S+\s+)*\S+\s+|\bmv\s+(?:-\S+\s+)*\S+\s+)\s*["']?([^\s;&|"']+)/g;

export function writeTargetsFromCommand(command: string): string[] {
  const targets: string[] = [];
  for (const m of command.matchAll(REDIRECT_TARGET)) {
    const t = m[1];
    if (t !== undefined && t !== "/dev/null" && !t.startsWith("&")) targets.push(t);
  }
  return targets;
}
