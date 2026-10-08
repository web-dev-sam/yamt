# Guardrails registry

Rule ids refer to skills under `.omp/skills/`. Levels: L0 prose/review, L1 static, L2 test,
L3 hook. Procedure: `skill://guardrail-evolution`. Changes land only after Gate D.

| id | rule | level | detector | origin | added | status |
|---|---|---|---|---|---|---|
| PM1 | gitio never depends on merge-core; merge-core has no I/O deps | L1 | `just arch-check`, clippy `disallowed_*` | architecture §2 | 2026-10-08 | active |
| PM2 | ui/ never imports @codemirror, editor/internal, model/ | L1 | oxlint `no-restricted-imports` overrides | architecture §2 | 2026-10-08 | active |
| PM3 | editor/, model/, connectors/ never import vue, vueuse, tauri | L1 | oxlint overrides | architecture §2 | 2026-10-08 | active |
| PM4 | generated files are never hand-edited | L3 | hook `generated.ts` + `just bindings-check` | architecture §4 | 2026-10-08 | active |
| PM5 | no cross-module `internal/` imports; no import cycles | L1 | oxlint overrides, `import/no-cycle` | architecture §2 | 2026-10-08 | active |
| SP1 | implementers edit only their `Owned` globs | L3 | hook `ownership.ts` | ai-system §7 | 2026-10-08 | active |
| SP9 | subagents never commit/push; destructive git denied for all | L3 | hook `bash-guard.ts` | ai-system §7 | 2026-10-08 | active |
| OR-main | orchestrator never edits crates/, frontend/, src-tauri/ | L3 | hook `ownership.ts` | ai-system §3 | 2026-10-08 | active |
| RS8 | no unwrap/expect/panic outside tests | L1 | clippy deny set | architecture §7 | 2026-10-08 | active |
| RS9 | domain `match` has no wildcard arm | L1 | clippy `wildcard_enum_match_arm` | architecture §2 | 2026-10-08 | active |
| TS3 | switch over a union is exhaustive | L1 | tsgolint `switch-exhaustiveness-check` | architecture §2 | 2026-10-08 | active |
| TS4 | no `as`/`!`/`any` outside ipc/fixture.ts | L1 | oxlint | architecture §2 | 2026-10-08 | active |
| TS10/VU3 | top-level functions are declarations | L1 | oxlint `func-style` | owner, 2026-10-08 | 2026-10-08 | active |
| TS12 | no console.* outside ipc/log.ts | L1 | oxlint `no-console` | owner, 2026-10-08 | 2026-10-08 | active |
| TS14 | no magic numbers | L1 (TS) / L0 (Rust) | oxlint `no-magic-numbers`; review | owner, 2026-10-08 | 2026-10-08 | active |
| VU2 | script-setup section order | L1 | `scripts/check-sfc-order.ts` | owner, 2026-10-08 | 2026-10-08 | active |
| RK13 | merge-core agrees with `git merge-file` on conflict-free triples | L2 | `cli/tests` cross-check | plan §5 M0 | 2026-10-08 | active |
| RK14 | chunks sorted and pairwise disjoint | L2 | proptest | architecture §3.1 | 2026-10-08 | active |
| R-open-1 | comments carry what code cannot; reviewer deletion test | L0 | review (`skill://comment-policy`) | owner, 2026-10-08 | 2026-10-08 | active, open for refinement |
| OR-q | questions to the human are product questions | L0 | orchestrator self-rule | finding #1 (human) | 2026-10-08 | active |
| OR-h | every message/question to the human is self-contained plain language: no internal ids, no invented vocabulary, no tool names the human did not introduce; one sentence per option stating what changes for them | L0 | orchestrator self-rule; curator audits human-facing questions each retro | finding #32 (human) | 2026-10-08 | active |

## Changelog

- 2026-10-08 — bootstrap. Registry seeded from architecture §2/§7 and the owner's conventions
  session. No Gate D yet; first retro after slice 0.0.
- 2026-10-08 — fence smoke passed: main-session no-code block, subagent ownership block, generated-file block, bash-guard (push, commit) block. Confirmed `ctx.agent.id` == task `name`, `ctx.agent.name` == agent definition name; `slices.json` is keyed by task name.
- 2026-10-08 — human correction during Gate D of retro 0.0: the approval question used internal ids and jargon and could not be answered. Rule OR-h added to `skill://orchestrate` ("Talking to the human"). Applied outside Gate D as a direct human instruction.
