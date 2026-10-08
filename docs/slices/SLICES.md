# Work board

Durable state of the build. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## Bootstrap (session 1)

| slice | owner | status | evidence |
|---|---|---|---|
| B.1 repo + docs + config + AGENTS.md | orchestrator | done | first commit empty; docs in `docs/` |
| B.2 `.omp/` skills, agents, hooks, GUARDRAILS | orchestrator | done | commit 42fcb3d |
| B.3 fence smoke (identity, ownership, generated, bash-guard, main-no-code) | orchestrator | done | four blocks observed; identity confirmed |
| 0.0 walking skeleton (Rust) | rust-impl | done | verifier: `just check` exit 0; arch-check probes; commit 588abc9 |
| 0.0' walking skeleton (frontend) | web-impl | done | verifier: `just check` exit 0; 8 node tests; WebKit browser project blocked (libs); commit 588abc9 |
| B.5 first retro | curator | running | |

## M0 — Rust, headless

| slice | owner | status | evidence |
|---|---|---|---|
| 0.1 merge-core | rust-impl | todo | |
| 0.1' gitio | rust-impl | todo | |
| 0.2 session | rust-impl | todo | |
| 0.3 cli + goldens + merge-file cross-check | rust-impl | todo | |
| Gate C: PhpStorm comparison on 10 goldens | human | todo | |

## Open product questions

See `docs/architecture.md` §10. Answered ones move into `docs/plan.md` §2.
