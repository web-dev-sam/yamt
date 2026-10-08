import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { flaggedTerms, readPlainLanguageLists } from "../lib/plain-language";
import type { AgentIdentity } from "../lib/policy";
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

async function assertVerdict(handler: Handler, event: ToolCall, agent: AgentIdentity, blocked: boolean, cwd = REPO): Promise<void> {
  const verdict = await handler(event, { cwd, agent });
  assert.equal(verdict?.block === true, blocked, `${JSON.stringify(event.input)} as ${agent.name}: ${verdict?.reason ?? "allowed"}`);
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
  for (const [event, agent, blocked] of cases) await assertVerdict(h, event, agent, blocked, FIXTURE_REPO);
});

test("generated: bindings, lockfile, snapshots", async () => {
  const h = toolCallHandler(generated);
  await assertVerdict(h, write("frontend/src/ipc/bindings.ts"), IMPLEMENTER, true);
  await assertVerdict(h, { toolName: "edit", input: { input: "[Cargo.lock#1A2B]\nPUT 1.=1:\n+x" } }, MAIN, true);
  await assertVerdict(h, write("crates/merge-core/tests/snapshots/chunks.snap"), IMPLEMENTER, true);
  await assertVerdict(h, write("frontend/src/ipc/log.ts"), IMPLEMENTER, false);
});

test("bash-guard: every justfile recipe except golden-update passes for an implementer", async () => {
  const h = toolCallHandler(bashGuard);
  const recipes = [...readFileSync(resolve(REPO, "justfile"), "utf8").matchAll(/^@?([a-z][\w-]*)[^:\n]*:(?!=)/gm)].map((m) => m[1]);
  assert.ok(recipes.includes("bindings-check"), `parsed recipes: ${recipes.join(", ")}`);
  for (const recipe of recipes) await assertVerdict(h, bash(`just ${recipe}`), IMPLEMENTER, recipe === "golden-update");
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
  await assertVerdict(h, ask("Approve P2 so the curator can add a robust check?", "Yes"), MAIN, true);
  await assertVerdict(h, ask("Should the app ask before closing a file with unresolved conflicts?", "Yes, ask every time"), MAIN, false);
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
    write(".omp/run/slices.json", JSON.stringify(Object.fromEntries(Object.entries(slices).map(([k, owned]) => [k, { owned }]))));
  await assertVerdict(h, registry({ A: ["crates/merge-core/**"], B: ["crates/gitio/**", "frontend/src/ui/**"] }), MAIN, false);
  await assertVerdict(h, registry({ A: ["frontend/src/ui/**"], B: ["frontend/src/ui/App.vue"] }), MAIN, true);
  await assertVerdict(h, registry({ A: ["crates/merge-core/**", "justfile"] }), MAIN, true);
  await assertVerdict(h, registry({ A: ["frontend/**"] }), MAIN, true);
  await assertVerdict(h, registry({ A: ["frontend/src/ipc/bindings.ts"] }), MAIN, true);
  await assertVerdict(h, write(".omp/run/slices.json", "{ not json"), MAIN, true);
  await assertVerdict(h, { toolName: "edit", input: { input: "[.omp/run/slices.json#1A2B]\nPUT 1.=1:\n+{}" } }, MAIN, true);
  await assertVerdict(h, write("docs/plan.md", "{ not json"), MAIN, false);
});

test("task-fanout: at most MAX_PARALLEL_AGENTS tasks per main call", async () => {
  const h = toolCallHandler(taskFanout);
  const task = (n: number): ToolCall => ({ toolName: "task", input: { tasks: Array.from({ length: n }, (_, i) => ({ name: `T${i}` })) } });
  await assertVerdict(h, task(2), MAIN, false);
  await assertVerdict(h, task(3), MAIN, true);
});
