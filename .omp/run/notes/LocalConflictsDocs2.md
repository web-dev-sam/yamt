# LocalConflictsDocs2

Agent output (`agent://LocalConflictsDocs2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-20T08-47-17-734Z_01a1f823-7ce6-7780-b335-95b51a2d3520/LocalConflictsDocs2.md), collected 2026-11-20T09:29:36.516Z.

{
  "summary": "Docs match 2a5d636d..9628ca0a (plan #197); map-check ok, no other checks run. architecture §3.2: merge_tree(first, second, timeout) always plain --write-tree, never --quiet, attributes from first's tree only (attr.tree, no global/system file; info/attributes still applies; git <2.43 ignores attr.tree). merge_tree_supported replaces the MergeTreeRun row; check section names require_merge_tree. tree.md:27-28, both AGENTS files, Verified line (9628ca0a) updated. state.md, ipc-contract unchanged.",
  "files_changed": [
    "docs/architecture.md",
    ".omp/skills/project-map/SKILL.md",
    ".omp/skills/project-map/tree.md",
    "crates/gitio/AGENTS.md",
    "crates/merge-requests/AGENTS.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": []
}
