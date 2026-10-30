// The orchestrator's bookkeeping, so agent reports land in files instead of the orchestrator's context
// (owner 2026-10-30, #1770). Run through the justfile: `just collect|triage|findings|archive-board`.
// Plain node (type stripping); no dependencies.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

type Json = Record<string, unknown>;
type Finding = Json & { problem?: unknown; triage?: unknown };

const FINDINGS = ".omp/run/findings.jsonl";
const BOARD = "docs/slices/SLICES.md";
const ARCHIVE = "docs/slices/archive/board.md";
const LINE_CHARS = 160;
const FINDING_ID = /^#(\d+)\b/;

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

// The main checkout, also from an isolated worktree or a `git clone --shared` copy (same rule as
// .omp/hooks/lib/policy.ts mainCheckoutPath).
function mainCheckout(cwd: string): string {
  const [gitDir, commonDir] = git(
    ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"],
    cwd,
  ).split("\n");
  const top = git(["rev-parse", "--show-toplevel"], cwd);
  if (gitDir === undefined || commonDir === undefined) return top;
  if (gitDir !== commonDir) return dirname(commonDir);
  const alternates = join(gitDir, "objects/info/alternates");
  if (!existsSync(alternates)) return top;
  const [objects] = readFileSync(alternates, "utf8")
    .split("\n")
    .filter((l) => l !== "");
  return objects !== undefined && isAbsolute(objects) && objects.endsWith("/.git/objects")
    ? dirname(dirname(objects))
    : top;
}

function oneLine(text: unknown, max = LINE_CHARS): string {
  const flat = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function isRecord(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// Where omp keeps this session's agent outputs: the session file without `.jsonl`; for an agent of an
// earlier session, the newest session folder of this project that has it.
function artifactsDir(root: string, name: string): string {
  const session = process.env["PI_SESSION_FILE"];
  if (session !== undefined && existsSync(join(session.replace(/\.jsonl$/, ""), `${name}.md`)))
    return session.replace(/\.jsonl$/, "");
  const project = join(
    homedir(),
    ".omp/agent/sessions",
    `-${relative(homedir(), mainCheckout(root)).replaceAll("/", "-")}`,
  );
  const found = existsSync(project)
    ? readdirSync(project)
        .map((d) => join(project, d))
        .filter((d) => existsSync(join(d, `${name}.md`)))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    : [];
  if (found[0] === undefined)
    throw new Error(`no output of agent ${name} in ${session ?? project}`);
  return found[0];
}

// A structured run leaves `<name>.json`; an older free-text run may hold its JSON in a fenced block.
function readOutput(dir: string, name: string): { text: string; data: Json | null } {
  const text = readFileSync(join(dir, `${name}.md`), "utf8");
  const sidecar = join(dir, `${name}.json`);
  const candidates = existsSync(sidecar)
    ? [readFileSync(sidecar, "utf8")]
    : [text, ...[...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1] ?? "")];
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isRecord(parsed))
        return { text, data: isRecord(parsed["data"]) ? parsed["data"] : parsed };
    } catch {
      // not JSON: try the next candidate
    }
  }
  return { text, data: null };
}

function sliceOf(name: string): string {
  return name.replace(/(Boundary|Correct)$/, "").replace(/R\d+$/, "");
}

function readFindings(root: string): string[] {
  const path = join(root, FINDINGS);
  return existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter((l) => l.trim() !== "")
    : [];
}

function findingId(line: string): number | null {
  try {
    const parsed: unknown = JSON.parse(line);
    const match = isRecord(parsed) ? FINDING_ID.exec(String(parsed["problem"] ?? "")) : null;
    return match?.[1] === undefined ? null : Number(match[1]);
  } catch {
    return null;
  }
}

// Reviewer findings as they are; a verifier's failed steps and failed smoke recipes as blocks.
function newFindings(name: string, data: Json): Finding[] {
  if (data["gate"] !== undefined) {
    const failures = list(data["failures"])
      .filter(isRecord)
      .map((f) => ({
        severity: "block",
        file: null,
        line: null,
        problem: `${String(f["step"])}: ${String(f["excerpt"])}`,
        fix: null,
      }));
    const smoke = list(data["smoke"])
      .filter((s) => isRecord(s) && s["pass"] === false)
      .map((s) => {
        const r = s as Json;
        return {
          severity: "block",
          file: null,
          line: null,
          problem: `${String(r["recipe"])}: ${String(r["observed"])}`,
          fix: null,
        };
      });
    return [...failures, ...smoke].map((f) => ({ ...f, source: "verifier", rule_id: null }));
  }
  const source = name.endsWith("Boundary")
    ? "boundary"
    : name.endsWith("Correct")
      ? "correctness"
      : "review";
  return list(data["findings"])
    .filter(isRecord)
    .map((f) => ({
      source,
      severity: f["severity"],
      rule_id: f["rule_id"] ?? null,
      file: f["file"] ?? null,
      line: f["line"] ?? null,
      problem: f["problem"],
      fix: f["fix"] ?? null,
    }));
}

function summaryLines(name: string, data: Json | null, ids: Array<[number, Finding]>): string[] {
  if (data === null) return [`${name}: free-text output, no JSON; read the note`];
  const lines: string[] = [];
  if (data["verdict"] !== undefined)
    lines.push(`${name}: verdict ${String(data["verdict"])}, ${ids.length} findings`);
  if (data["gate"] !== undefined)
    lines.push(`${name}: gate ${String(data["gate"])}, ${ids.length} failures`);
  for (const [id, f] of ids)
    lines.push(
      `  #${id} ${String(f["severity"])} ${f["file"] === null ? "" : `${String(f["file"])}:${String(f["line"])} `}${oneLine(f["problem"])}`,
    );
  if (data["files_changed"] !== undefined) {
    const mutation = isRecord(data["mutation"]) ? data["mutation"] : {};
    lines.push(
      `${name}: ${list(data["files_changed"]).length} files, ${list(data["tests_added"]).length} tests, ` +
        `${list(mutation["survivors"]).length} survivors kept (${oneLine(mutation["command"] ?? "no mutation run", 60)})`,
      `  ${oneLine(data["summary"], 300)}`,
    );
    for (const a of list(data["acceptance_not_run"])) lines.push(`  NOT RUN: ${oneLine(a)}`);
    for (const d of list(data["deviations_from_brief"])) lines.push(`  deviation: ${oneLine(d)}`);
    for (const r of list(data["open_risks"]).filter(isRecord))
      lines.push(`  risk: ${oneLine(`${String(r["location"])} ${String(r["risk"])}`)}`);
  }
  if (data["recommendation"] !== undefined) {
    lines.push(
      `${name}: ${list(data["options"]).length} options; ${oneLine(data["recommendation"], 300)}`,
    );
    for (const b of list(data["briefs_written"])) lines.push(`  brief: ${String(b)}`);
    for (const q of list(data["open_questions"])) lines.push(`  question: ${oneLine(q, 240)}`);
  }
  if (lines.length === 0) lines.push(`${name}: ${oneLine(JSON.stringify(data), 300)}`);
  return lines;
}

function patchFiles(patch: string): string[] {
  const files = new Set<string>();
  for (const m of patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)) {
    if (m[1] !== undefined) files.add(m[1]);
    if (m[2] !== undefined) files.add(m[2]);
  }
  return [...files];
}

function collect(args: string[]): void {
  const name = args[0];
  if (name === undefined)
    throw new Error("usage: just collect <AgentName> [--slice <slice>] [--commit <message>]");
  const flag = (key: string): string | undefined => {
    const at = args.indexOf(key);
    return at === -1 ? undefined : args[at + 1];
  };
  const root = git(["rev-parse", "--show-toplevel"], process.cwd());
  const dir = artifactsDir(root, name);
  const { text, data } = readOutput(dir, name);
  const written: string[] = [];
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
    written.push(path);
  };

  const notePath = `.omp/run/notes/${name}.md`;
  write(
    notePath,
    `# ${name}\n\nAgent output (\`agent://${name}\`, ${join(dir, `${name}.md`)}), collected ${new Date().toISOString()}.\n\n${text}\n`,
  );
  const lines: string[] = [];

  let changed: string[] = [];
  const patchSource = join(dir, `${name}.patch`);
  if (existsSync(patchSource) && statSync(patchSource).size > 0) {
    const patchPath = `.omp/run/patches/${name}.patch`;
    mkdirSync(join(root, ".omp/run/patches"), { recursive: true });
    copyFileSync(patchSource, join(root, patchPath));
    written.push(patchPath);
    changed = patchFiles(readFileSync(patchSource, "utf8"));
    lines.push(`patch ${patchPath} (${changed.length} files)`);
  }

  const mutation = data !== null && isRecord(data["mutation"]) ? data["mutation"] : null;
  if (mutation !== null) {
    const survivorsPath = `.omp/run/mutants/${name}.survivors.txt`;
    write(
      survivorsPath,
      `${String(mutation["command"] ?? "")}\n${list(mutation["survivors"]).map(String).join("\n")}\n`,
    );
    lines.push(`survivors ${survivorsPath}`);
  }

  const ids: Array<[number, Finding]> = [];
  if (data !== null) {
    const existing = readFindings(root);
    let next =
      Math.max(0, ...existing.map(findingId).filter((id): id is number => id !== null)) + 1;
    const ts = new Date().toISOString();
    const added = newFindings(name, data).map((f) => {
      const id = next++;
      ids.push([id, f]);
      return JSON.stringify({
        ts,
        slice: flag("--slice") ?? sliceOf(name),
        ...f,
        problem: `#${id} ${String(f.problem)}`,
        triage: "",
      });
    });
    if (added.length > 0) {
      writeFileSync(join(root, FINDINGS), [...existing, ...added].join("\n") + "\n");
      written.push(FINDINGS);
    }
  }

  console.log([...summaryLines(name, data, ids), `note ${notePath}`, ...lines].join("\n"));

  const message = flag("--commit");
  if (message !== undefined) {
    git(["add", "-A", "--", ...written, ...changed], root);
    git(["commit", "-q", "-m", message], root);
    console.log(`committed ${git(["log", "--oneline", "-1"], root)}`);
  }
}

function triage(args: string[]): void {
  const split = args.indexOf("--");
  const ids = new Set((split === -1 ? [] : args.slice(0, split)).map(Number));
  const text = split === -1 ? undefined : args.slice(split + 1).join(" ");
  if (ids.size === 0 || text === undefined || text === "" || [...ids].some(Number.isNaN))
    throw new Error('usage: just triage <id>... -- "promoted: <reason>" | "dropped: <reason>"');
  const root = git(["rev-parse", "--show-toplevel"], process.cwd());
  const seen = new Set<number>();
  const lines = readFindings(root).map((line) => {
    const id = findingId(line);
    if (id === null || !ids.has(id)) return line;
    seen.add(id);
    return JSON.stringify({ ...(JSON.parse(line) as Finding), triage: text });
  });
  const missing = [...ids].filter((id) => !seen.has(id));
  if (missing.length > 0) throw new Error(`no finding ${missing.map((id) => `#${id}`).join(", ")}`);
  writeFileSync(join(root, FINDINGS), lines.join("\n") + "\n");
  console.log(`${[...ids].map((id) => `#${id}`).join(" ")}: ${text}`);
}

function findings(args: string[]): void {
  const ids = new Set(args.map(Number));
  if (ids.size === 0 || [...ids].some(Number.isNaN))
    throw new Error("usage: just findings <id>...");
  for (const line of readFindings(mainCheckout(process.cwd()))) {
    const id = findingId(line);
    if (id === null || !ids.has(id)) continue;
    const f = JSON.parse(line) as Finding;
    console.log(
      `${String(f["problem"])}\n  severity ${String(f["severity"])}, ${String(f["source"])}, ${String(f["file"] ?? "-")}:${String(f["line"] ?? "-")}`,
    );
    console.log(`  fix: ${String(f["fix"] ?? "-")}\n  triage: ${String(f["triage"] ?? "-")}\n`);
    ids.delete(id);
  }
  if (ids.size > 0) throw new Error(`no finding ${[...ids].map((id) => `#${id}`).join(", ")}`);
}

// Moves one closed `## ` section of the board to the archive, so re-hydration reads only open work.
function archiveBoard(args: string[]): void {
  const prefix = args.join(" ");
  if (prefix === "") throw new Error('usage: just archive-board "<start of the ## heading>"');
  const root = git(["rev-parse", "--show-toplevel"], process.cwd());
  const board = readFileSync(join(root, BOARD), "utf8").split("\n");
  const starts = board.flatMap((l, i) => (l.startsWith(`## ${prefix}`) ? [i] : []));
  if (starts.length !== 1)
    throw new Error(`"## ${prefix}" matches ${starts.length} sections; give more of the heading`);
  const from = starts[0] ?? 0;
  const after = board.findIndex((l, i) => i > from && l.startsWith("## "));
  const to = after === -1 ? board.length : after;
  const section = board.slice(from, to);
  mkdirSync(dirname(join(root, ARCHIVE)), { recursive: true });
  const archive = existsSync(join(root, ARCHIVE))
    ? readFileSync(join(root, ARCHIVE), "utf8").trimEnd()
    : "# Work board archive\n\nClosed sections of `docs/slices/SLICES.md`, oldest first.";
  writeFileSync(join(root, ARCHIVE), `${archive}\n\n${section.join("\n").trimEnd()}\n`);
  writeFileSync(join(root, BOARD), [...board.slice(0, from), ...board.slice(to)].join("\n"));
  console.log(`moved "${section[0] ?? ""}" (${section.length} lines) to ${ARCHIVE}`);
}

const COMMANDS: Record<string, (args: string[]) => void> = {
  collect,
  triage,
  findings,
  "archive-board": archiveBoard,
};

const [command, ...rest] = process.argv.slice(2);
const run = command === undefined ? undefined : COMMANDS[command];
if (run === undefined) {
  console.error(
    `usage: ${basename(process.argv[1] ?? "collect.ts")} ${Object.keys(COMMANDS).join("|")} …`,
  );
  process.exit(2);
}
try {
  run(rest);
} catch (error) {
  console.error(`${command}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
