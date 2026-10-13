import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

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

export const MAX_PARALLEL_AGENTS = 3;

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

function mainCheckoutPath(cwd: string): string {
  try {
    const [gitDir, commonDir, prefix] = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir", "--show-prefix"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).split("\n");
    if (gitDir === undefined || commonDir === undefined) return cwd;
    // Only a linked worktree's git dir differs from the common dir it shares (git-worktree(1)).
    if (gitDir !== commonDir) return resolve(dirname(commonDir), prefix ?? "");
    const source = sharedCloneSource(gitDir);
    return source === undefined ? cwd : resolve(source, prefix ?? "");
  } catch {
    return cwd;
  }
}

// A `git clone --shared` lists the source's object store in `objects/info/alternates` (gitrepository-layout(5)).
function sharedCloneSource(gitDir: string): string | undefined {
  try {
    const lines = readFileSync(resolve(gitDir, "objects/info/alternates"), "utf8")
      .split("\n")
      .filter((l) => l !== "");
    const [objects] = lines;
    if (
      lines.length !== 1 ||
      objects === undefined ||
      !isAbsolute(objects) ||
      !objects.endsWith("/.git/objects")
    )
      return undefined;
    return dirname(dirname(objects));
  } catch {
    return undefined;
  }
}

export function readSliceRegistry(cwd: string): SliceRegistry {
  try {
    const raw = readFileSync(resolve(mainCheckoutPath(cwd), SLICE_REGISTRY), "utf8");
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
  /(?:(?<![=-])>>?|\btee\s+(?:-a\s+)?|\bcp\s+(?:-\S+\s+)*\S+\s+|\bmv\s+(?:-\S+\s+)*\S+\s+)\s*["']?([^\s;&|"']+)/g;

const CD_TARGET = /\bcd\s+["']?([^\s;&|"']+)/g;

export function writeTargetsFromCommand(command: string, baseDir: string): string[] {
  const cds = [...command.matchAll(CD_TARGET)];
  const targets: string[] = [];
  for (const m of command.matchAll(REDIRECT_TARGET)) {
    const t = m[1];
    if (t === undefined || t === "/dev/null" || t.startsWith("&")) continue;
    const dir = cds
      .filter((cd) => cd.index < m.index)
      .reduce((base, cd) => resolve(base, cd[1] ?? "."), baseDir);
    targets.push(resolve(dir, t));
  }
  return targets;
}
