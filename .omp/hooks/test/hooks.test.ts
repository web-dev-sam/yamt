import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { flaggedTerms, readPlainLanguageLists } from "../lib/plain-language";
import { type AgentIdentity, MAX_PARALLEL_AGENTS, readSliceRegistry } from "../lib/policy";
import bashGuard from "../pre/bash-guard";
import generated from "../pre/generated";
import ownership from "../pre/ownership";
import plainLanguage from "../pre/plain-language";
import sliceRegistry from "../pre/slice-registry";
import taskFanout from "../pre/task-fanout";

type ToolCall = { toolName: string; input: Record<string, unknown> };
type Verdict = { block: true; reason: string } | undefined;
type Handler = (event: ToolCall, ctx: { cwd: string; agent: AgentIdentity }) => Promise<Verdict>;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../..");
const FIXTURE_REPO = resolve(HERE, "fixture-repo");

const MAIN: AgentIdentity = { kind: "main", id: "main", name: "main" };
const IMPLEMENTER: AgentIdentity = { kind: "sub", id: "M0S1MergeCore", name: "rust-impl" };
const UNREGISTERED: AgentIdentity = { kind: "sub", id: "Stranger", name: "web-impl" };
const REVIEWER: AgentIdentity = { kind: "sub", id: "Review1", name: "correctness-reviewer" };

function toolCallHandler(hook: (pi: never) => void): Handler {
  const handlers = new Map<string, Handler>();
  const pi = { on: (name: string, handler: Handler) => handlers.set(name, handler) };
  hook(pi as never);
  const handler = handlers.get("tool_call");
  if (handler === undefined) throw new Error("hook registered no tool_call handler");
  return handler;
}

function bash(command: string): ToolCall {
  return { toolName: "bash", input: { command } };
}

function write(path: string, content = ""): ToolCall {
  return { toolName: "write", input: { path, content } };
}

async function assertVerdict(
  handler: Handler,
  event: ToolCall,
  agent: AgentIdentity,
  blocked: boolean,
  cwd = REPO,
): Promise<void> {
  const verdict = await handler(event, { cwd, agent });
  assert.equal(
    verdict?.block === true,
    blocked,
    `${JSON.stringify(event.input)} as ${agent.name}: ${verdict?.reason ?? "allowed"}`,
  );
}

test("ownership: main, owned, outside, URL targets, scratch dir, unregistered", async () => {
  const h = toolCallHandler(ownership);
  const cases: Array<[ToolCall, AgentIdentity, boolean]> = [
    [write("crates/merge-core/src/lib.rs"), MAIN, true],
    [write("frontend/src/ui/App.vue"), MAIN, true],
    [write("frontend/package.json"), MAIN, false],
    [write("crates/gitio/Cargo.toml"), MAIN, false],
    [write("docs/plan.md"), MAIN, false],
    [write("crates/merge-core/src/lib.rs"), IMPLEMENTER, false],
    [write("crates/gitio/src/lib.rs"), IMPLEMENTER, true],
    [write("agent://Main", "question"), IMPLEMENTER, false],
    [write(resolve(tmpdir(), "scratch.txt")), IMPLEMENTER, false],
    [bash("echo x > crates/gitio/src/lib.rs"), IMPLEMENTER, true],
    [write("crates/merge-core/src/lib.rs"), UNREGISTERED, true],
  ];
  for (const [event, agent, blocked] of cases)
    await assertVerdict(h, event, agent, blocked, FIXTURE_REPO);
});

test("generated: bindings, lockfile, snapshots", async () => {
  const h = toolCallHandler(generated);
  await assertVerdict(h, write("frontend/src/ipc/bindings.ts"), IMPLEMENTER, true);
  await assertVerdict(
    h,
    { toolName: "edit", input: { input: "[Cargo.lock#1A2B]\nPUT 1.=1:\n+x" } },
    MAIN,
    true,
  );
  await assertVerdict(h, write("crates/merge-core/tests/snapshots/chunks.snap"), IMPLEMENTER, true);
  await assertVerdict(h, write("frontend/src/ipc/log.ts"), IMPLEMENTER, false);
});

test("bash-guard: every justfile recipe except golden-update passes for an implementer", async () => {
  const h = toolCallHandler(bashGuard);
  const recipes = [
    ...readFileSync(resolve(REPO, "justfile"), "utf8").matchAll(/^@?([a-z][\w-]*)[^:\n]*:(?!=)/gm),
  ].map((m) => m[1]);
  assert.ok(recipes.includes("bindings-check"), `parsed recipes: ${recipes.join(", ")}`);
  for (const recipe of recipes)
    await assertVerdict(h, bash(`just ${recipe}`), IMPLEMENTER, recipe === "golden-update");
});

test("bash-guard: git and destructive commands", async () => {
  const h = toolCallHandler(bashGuard);
  await assertVerdict(h, bash("git push origin main"), MAIN, true);
  await assertVerdict(h, bash("git push"), IMPLEMENTER, true);
  await assertVerdict(h, bash("git commit -m x"), IMPLEMENTER, true);
  await assertVerdict(h, bash("git commit -m x"), MAIN, false);
  await assertVerdict(h, bash("git -C /tmp/x commit -m x"), IMPLEMENTER, false);
  await assertVerdict(h, bash("rm -rf src"), IMPLEMENTER, true);
  await assertVerdict(h, bash("rm -rf target/debug"), IMPLEMENTER, false);
});

test("bash-guard: desktop screenshots are blocked; page and private-display captures pass", async () => {
  const h = toolCallHandler(bashGuard);
  const cases: Array<[string, boolean]> = [
    ["spectacle -b -n -a -o /tmp/shot.png", true],
    ["grim /tmp/shot.png", true],
    [
      "qdbus org.kde.KWin /org/kde/KWin/ScreenShot2 org.kde.KWin.ScreenShot2.CaptureActiveWindow",
      true,
    ],
    ["import -window root /tmp/shot.png", true],
    ["import -display :99 -window root /tmp/shot.png", false],
    ["curl -s http://127.0.0.1:4444/session/abc/screenshot", false],
  ];
  for (const [command, blocked] of cases) {
    await assertVerdict(h, bash(command), IMPLEMENTER, blocked);
    await assertVerdict(h, bash(command), MAIN, blocked);
  }
});

test("bash-guard: reviewers never run whole-workspace toolchains", async () => {
  const h = toolCallHandler(bashGuard);
  const cases: Array<[string, boolean]> = [
    ["just check", true],
    ["just web-lint", true],
    ["pnpm -C frontend lint", true],
    ["pnpm -C frontend typecheck", true],
    ["pnpm -C frontend test", true],
    ["cargo clippy --workspace --all-targets", true],
    ["cargo nextest run --workspace", true],
    ["pnpm -C frontend exec vue-tsc -b", true],
    ["pnpm -C frontend exec oxlint --type-aware", true],
    ["pnpm -C frontend test src/ipc/log.test.ts", false],
    ["cargo nextest run -p yamt-merge-core chunks", false],
  ];
  for (const [command, blocked] of cases) await assertVerdict(h, bash(command), REVIEWER, blocked);
  await assertVerdict(h, bash("just check"), IMPLEMENTER, false);
});

test("plain-language: flags list words and ids in main's questions only", async () => {
  const h = toolCallHandler(plainLanguage);
  const ask = (question: string, label: string): ToolCall => ({
    toolName: "ask",
    input: { questions: [{ id: "q1", question, options: [{ label }] }] },
  });
  await assertVerdict(
    h,
    ask("Approve P2 so the curator can add a robust check?", "Yes"),
    MAIN,
    true,
  );
  await assertVerdict(
    h,
    ask(
      "Should the app ask before closing a file with unresolved conflicts?",
      "Yes, ask every time",
    ),
    MAIN,
    false,
  );
  await assertVerdict(h, ask("Approve P2?", "Yes"), IMPLEMENTER, false);

  const lists = readPlainLanguageLists(REPO);
  assert.ok(lists !== undefined);
  assert.deepEqual(
    flaggedTerms(["Approve P2 so the curator can add a robust check?"], lists).map((f) => f.term),
    ["robust", "curator", "P2"],
  );
  assert.deepEqual(flaggedTerms(["Adjusting the slicer"], lists), []);
});

test("slice-registry: disjoint, overlap, shared, generated, invalid, edit", async () => {
  const h = toolCallHandler(sliceRegistry);
  const registry = (slices: Record<string, string[]>): ToolCall =>
    write(
      ".omp/run/slices.json",
      JSON.stringify(
        Object.fromEntries(Object.entries(slices).map(([k, owned]) => [k, { owned }])),
      ),
    );
  await assertVerdict(
    h,
    registry({ A: ["crates/merge-core/**"], B: ["crates/gitio/**", "frontend/src/ui/**"] }),
    MAIN,
    false,
  );
  await assertVerdict(
    h,
    registry({ A: ["frontend/src/ui/**"], B: ["frontend/src/ui/App.vue"] }),
    MAIN,
    true,
  );
  await assertVerdict(h, registry({ A: ["crates/merge-core/**", "justfile"] }), MAIN, true);
  await assertVerdict(h, registry({ A: ["frontend/**"] }), MAIN, true);
  await assertVerdict(h, registry({ A: ["frontend/src/ipc/bindings.ts"] }), MAIN, true);
  await assertVerdict(h, write(".omp/run/slices.json", "{ not json"), MAIN, true);
  await assertVerdict(
    h,
    { toolName: "edit", input: { input: "[.omp/run/slices.json#1A2B]\nPUT 1.=1:\n+{}" } },
    MAIN,
    true,
  );
  await assertVerdict(h, write("docs/plan.md", "{ not json"), MAIN, false);
});

test("task-fanout: at most MAX_PARALLEL_AGENTS tasks per main call", async () => {
  const h = toolCallHandler(taskFanout);
  const task = (n: number): ToolCall => ({
    toolName: "task",
    input: { tasks: Array.from({ length: n }, (_, i) => ({ name: `T${i}` })) },
  });
  await assertVerdict(h, task(MAX_PARALLEL_AGENTS), MAIN, false);
  await assertVerdict(h, task(MAX_PARALLEL_AGENTS + 1), MAIN, true);
});

test("task-fanout: one isolated agent per main call", async () => {
  const h = toolCallHandler(taskFanout);
  const tasks = (...items: Array<Record<string, unknown>>): ToolCall => ({
    toolName: "task",
    input: { tasks: items },
  });
  await assertVerdict(
    h,
    tasks({ name: "A", isolated: true }, { name: "B", isolated: true }),
    MAIN,
    true,
    FIXTURE_REPO,
  );
  await assertVerdict(
    h,
    tasks({ name: "M0S1MergeCore", agent: "web-impl", isolated: true }, { name: "T1" }),
    MAIN,
    false,
    FIXTURE_REPO,
  );
});

test("task-fanout: implementer spawns are registered and never reuse a name", async () => {
  const h = toolCallHandler(taskFanout);
  const spawn = (name: string): ToolCall => ({
    toolName: "task",
    input: { tasks: [{ name, agent: "web-impl" }] },
  });
  await assertVerdict(h, spawn("Stranger"), MAIN, true, FIXTURE_REPO);
  await assertVerdict(h, spawn("M0S1MergeCore"), MAIN, false, FIXTURE_REPO);
  await assertVerdict(h, spawn("M0S1MergeCore"), MAIN, true, FIXTURE_REPO);
});

test("policy: hooks in a linked worktree read the main checkout's uncommitted registry", async () => {
  const main = mkdtempSync(resolve(tmpdir(), "yamt-main-"));
  const worktreeParent = mkdtempSync(resolve(tmpdir(), "yamt-worktree-"));
  const worktree = resolve(worktreeParent, "m");
  const git = (...args: string[]): string =>
    execFileSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
      { cwd: main, encoding: "utf8" },
    );
  try {
    git("init", "--quiet");
    mkdirSync(resolve(main, ".omp/run"), { recursive: true });
    const registry = resolve(main, ".omp/run/slices.json");
    writeFileSync(registry, JSON.stringify({ B: { owned: ["b/**"] } }));
    git("add", ".omp/run/slices.json");
    git("commit", "--quiet", "-m", "registry");
    git("worktree", "add", "--quiet", worktree);
    writeFileSync(registry, JSON.stringify({ A: { owned: ["a/**"] } }));

    assert.deepEqual(readSliceRegistry(worktree), { A: { owned: ["a/**"] } });
    await assertVerdict(
      toolCallHandler(taskFanout),
      { toolName: "task", input: { tasks: [{ name: "A", agent: "web-impl", isolated: true }] } },
      MAIN,
      false,
      worktree,
    );
  } finally {
    rmSync(main, { recursive: true, force: true });
    rmSync(worktreeParent, { recursive: true, force: true });
  }
});

test("policy: hooks in a `git clone --shared` read the source checkout's uncommitted registry", async () => {
  const main = mkdtempSync(resolve(tmpdir(), "yamt-main-"));
  const cloneParent = mkdtempSync(resolve(tmpdir(), "yamt-clone-"));
  const clone = resolve(cloneParent, "m");
  const git = (...args: string[]): string =>
    execFileSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
      { cwd: main, encoding: "utf8" },
    );
  try {
    git("init", "--quiet");
    mkdirSync(resolve(main, ".omp/run"), { recursive: true });
    const registry = resolve(main, ".omp/run/slices.json");
    writeFileSync(registry, JSON.stringify({ B: { owned: ["b/**"] } }));
    git("add", ".omp/run/slices.json");
    git("commit", "--quiet", "-m", "registry");
    git("clone", "--quiet", "--shared", main, clone);
    writeFileSync(registry, JSON.stringify({ A: { owned: ["a/**"] } }));

    assert.deepEqual(readSliceRegistry(clone), { A: { owned: ["a/**"] } });
    await assertVerdict(
      toolCallHandler(taskFanout),
      { toolName: "task", input: { tasks: [{ name: "A", agent: "web-impl", isolated: true }] } },
      MAIN,
      false,
      clone,
    );
  } finally {
    rmSync(main, { recursive: true, force: true });
    rmSync(cloneParent, { recursive: true, force: true });
  }
});

test("ownership: arrows are not redirects; targets after `cd <dir>` resolve against it", async () => {
  const h = toolCallHandler(ownership);
  const cases: Array<[string, boolean]> = [
    [`curl -d '{"script":"x => 1"}' http://127.0.0.1:4445/session`, false],
    [`cd ${resolve(tmpdir(), "rk13")} && printf a > base`, false],
    ["printf a > base", true],
  ];
  for (const [command, blocked] of cases)
    await assertVerdict(h, bash(command), UNREGISTERED, blocked, FIXTURE_REPO);
});

test("ownership: redirects resolve against the tool cwd and every earlier relative or absolute `cd`", async () => {
  const h = toolCallHandler(ownership);
  await assertVerdict(
    h,
    bash("cd frontend && printf x > src/editor/p.ts"),
    MAIN,
    true,
    FIXTURE_REPO,
  );
  await assertVerdict(
    h,
    { toolName: "bash", input: { command: "printf x > src/editor/p.ts", cwd: "frontend" } },
    MAIN,
    true,
    FIXTURE_REPO,
  );
  await assertVerdict(
    h,
    bash("cd crates/merge-core && printf x > src/lib.rs"),
    IMPLEMENTER,
    false,
    FIXTURE_REPO,
  );
  await assertVerdict(
    h,
    bash("cd crates && cd gitio && printf x > src/lib.rs"),
    IMPLEMENTER,
    true,
    FIXTURE_REPO,
  );
});

test("task-fanout: broadcasts are blocked for everyone, named messages pass", async () => {
  const h = toolCallHandler(taskFanout);
  await assertVerdict(h, write("agent://all", "retry"), MAIN, true);
  await assertVerdict(h, write("agent://all", "done"), IMPLEMENTER, true);
  await assertVerdict(h, write("agent://Main", "question"), IMPLEMENTER, false);
});
