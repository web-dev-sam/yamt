# RangeReviewedDocs

Agent output (`agent://RangeReviewedDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedDocs.md), collected 2026-11-19T10:29:59.493Z.

{
  "summary": "The docs now match the Reviewed-marks code at c764929b, and map-check passes. Updated: architecture.md (layout and dependencies, the range window's Rust and window sections, the IPC types and ReviewedSource, a range-window state table), tree.md, state.md, project-map SKILL.md (verified commit, diagram, PM1), ipc-contract (4 commands, ReviewedSource), plan #195/#196, RK79 and the CHANGELOG under Unreleased.",
  "files_changed": [
    "docs/architecture.md",
    ".omp/skills/project-map/SKILL.md",
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/ipc-contract/SKILL.md",
    "docs/plan.md",
    ".omp/skills/risk-register/SKILL.md",
    "CHANGELOG.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    "scripts/map-check.sh:31 `for source in ChunkSource CompareSource RangeSource ReviewSource MergeRequestSource` omits ReviewedSource: add it so its four methods are checked against architecture (the RangeSource sed reads only its own methods). Update tree.md:141's list to match.",
    "crates/reviewed/src/lib.rs:40 `SinceReview::NoText` doc (exported to ipc/bindings.ts) omits two cases: no mark, and the kept text swept by another window's open. Add both, then run `just bindings`.",
    "docs/slices/briefs/range-reviewed-core.md:127 and range-reviewed-design.md §4 describe since_review without the swept-text → NoText case, and the stored format without the required `left`/`right` keys. These are history briefs; fix only if they are kept as references."
  ]
}
