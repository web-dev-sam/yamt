# MrStartsRustCorrectness

Agent output (`agent://MrStartsRustCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsRustCorrectness.md), collected 2026-11-03T19:42:16.474Z.

{
  "verdict": "pass",
  "checked": [
    "B1/B2 traced in parse/started_on: --mr, --diff --mr, --mr --diff, --mr twice → Compare; --diff=a..b --mr → Range with repo; --mr --repo p either order → DIFF_WITH_REPO; --help/--version win. Tests: args.rs:396-436.",
    "C1: unset, empty or 0 → Off; other values → On, non-UTF-8 too (unix test); --ai overrides. 1/yes cases fail if the read is deleted. Tests set no process env; lib.rs reads AI_VAR once.",
    "start_script appends the exact dataset.open line after the ai line, only for Compare/Range + MergeRequests (no wildcard). Exact-string tests cover merge/Files absence. All open_and_wait callers pass start.",
    "second_window tests pin children parsed with start Files, no --mr (non-goal kept). Open risk 1 (children inherit YAMT_AI) accepted: C1 says every start; a range child is On only when the parent's same value is On.",
    "Mutation: 0 survivors (17 mutants: 8 caught, 9 unviable), nothing to judge under VF7. target/mutants now holds another run. Likely mutants (guard ||, ==, true/false; start_script strings) are killed by these tests.",
    "Accepted deviations: a third start_script test; app-session wrappers for --mr/YAMT_AI (smoke: open marker compare/range, ai on/off, refusal exit 2). README B3/C2 go to the docs slice; risk 2's message follows B2. No test run."
  ],
  "findings": []
}
