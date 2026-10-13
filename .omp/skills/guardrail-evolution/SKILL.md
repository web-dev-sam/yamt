---
name: guardrail-evolution
description: How yamt's rules change over time — the enforcement ladder, the rule registry format, promotion and retirement criteria, budgets, and the curator's retro procedure. Autoloaded into curator; the orchestrator reads it before recommending a guardrail.
---

# Guardrail evolution

The rule set is a product with a changelog, a budget, and retirement. Prose is the weakest
and most temporary form of a rule.

## Enforcement ladder

| level | mechanism                                                                          | example                                      |
| ----- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| L0    | prose in a skill, checked by a reviewer                                            | "prefer `thiserror` enums in library crates" |
| L1    | static: clippy, oxlint, tsc/vue-tsc, cargo graph, cargo-deny, `scripts/check-*.ts` | "ui/ never imports @codemirror"              |
| L2    | test: proptest invariant, golden, arch test                                        | "chunks are pairwise disjoint"               |
| L3    | hook: `tool_call` block                                                            | ownership, generated files, bash guard       |

- [GE1] An L0 rule that produced a `block` finding **twice** is promoted (L1 → L2 → L3,
  cheapest first) at the next retro, or deleted as unenforceable.
- [GE2] An L1+ rule needs no prose beyond its id and a one-line rationale; the detector is
  the rule. Delete the explanatory paragraph when promoting.
- [GE3] A rule with no findings and no detector for two milestones is deleted. A detector
  that never fired for two milestones is checked for redundancy with a stronger one.

## Registry: `.omp/GUARDRAILS.md`

```
| id | rule | level | detector | origin | added | status |
```

`id` is the skill rule id (`RS4`, `CM2`, `PM1`) or `R-open-N` for rules still being shaped.
`origin` cites findings (`#31,#44`) or the architecture section. `status`: `active`,
`promoted→L2`, `retired`. A `## Changelog` section is appended per retro with date and the
Gate D outcome per proposal.

## Budgets

- Each `SKILL.md` ≤ 120 lines (vendored material lives in `references/`, read on demand).
- Autoloaded total per implementer ≤ 400 lines; `GUARDRAILS.md` ≤ 60 active rules.
- Over budget ⇒ a proposal must name what it retires or promotes to make room.

## Retro procedure (curator)

Input: `.omp/run/findings.jsonl` since the last retro; incidents (hook blocks, fix round
2, Gate B escalations); human corrections (`source: "human"`) — these weigh most.

1. Cluster findings by `rule_id` (or by problem similarity when unset).
2. For each cluster with ≥ 2 members or any human member, propose **one** of:
   - a detector (L1 lint config, L2 test, L3 hook) with a one-line diff summary and cost;
   - a skill line (L0) only if no detector is feasible, stating why;
   - a retirement or merge of an existing rule.
3. Drift check: diff `skill://project-map` against the tree (directories, public types,
   dependency edges). Propose the correction; bump `verified against commit`.
4. Comment audit (`R-open-1`): count comments added this milestone, classify each as
   information-carrying or narrating; propose tightening or loosening the policy with examples.
5. Reviewer calibration: findings that led to a change vs. findings dropped by the
   orchestrator (`triage`, OR12); propose protocol adjustments if a reviewer is noisy or silent.

Output: `proposals[]` with `id, origin_findings, rule, level, detector, cost, diff_summary`.
The curator applies nothing until the orchestrator relays Gate D approval, then edits only
`.omp/**` (hook-enforced) and appends the changelog.

## Anti-goals

- No rule that only produces `nit`s.
- No rule that restates a lint already in `just check`.
- No "always"/"never" without a violation example and a detector or a reviewer test.
