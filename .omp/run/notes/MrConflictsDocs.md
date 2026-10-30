# MrConflictsDocs

Agent output (`agent://MrConflictsDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsDocs.md), collected 2026-10-30T23:32:24.074Z.

{
  "summary": "Docs now match the merge-request-conflicts code at 80345da. The Rust fix round (the bounded claim wait in merge_requests.rs) had not landed, so it is not described. Changed: architecture §1, §2, §3.2, §3.5, §3.9, a new §3.10 (local-merge), §4 IPC, §5.1 state rows, §5.4 ui and §7; tree.md file rows (pushing.ts closeEnded too); state.md owners of the record, locks, Committed, mergeRequest (#2022), actions and localMerge; ipc-contract's 5 commands; PM1, dependency diagram and Verified line. map-check: ok.",
  "files_changed": [
    "docs/architecture.md",
    ".omp/skills/project-map/SKILL.md",
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/ipc-contract/SKILL.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    "docs/plan.md:173 (#141): push argv lacks `--end-of-options` before `<remote>`; code: push --porcelain --no-follow-tags --recurse-submodules=no --end-of-options <remote> refs/heads/<b>:refs/heads/<b>",
    "docs/plan.md:171 (#139): `merge --no-ff --no-commit` lacks `--end-of-options <rev>` (GitR1 note); also design brief §4.2 step 13 / §4.3 checkout, branch -D, branch --force argv",
    "docs/slices/briefs/mr-conflicts-design.md:535: `MergeState also holds _claim` and `Committed { offer }`; code: claim held by lib.rs merge() via Startup::Merge { session, claim }, Committed { root, offer }",
    "docs/architecture.md:1658 (justfile arch-check summary, pre-existing): lists only gitio/merge-core rules; could name the per-crate dependency rules incl. local-merge"
  ]
}
