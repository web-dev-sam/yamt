# LocalConflictsDocs

Agent output (`agent://LocalConflictsDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsDocs.md), collected 2026-11-02T18:56:53.475Z.

{
  "summary": "Updated the docs for the local conflict check at f73c85c6. Architecture: §3.2 (remote_refs, missing_commits, merge_tree, MergeTreeRun, MergeOutcome, batch_check and refuse_lazy_fetch, Oid: Hash), §3.5 (merged, check after End), §3.9 (MergedPairs line, query fields, readiness.rs, check.rs, CheckedRow, mergesCleanly, scenario), §4 (ListMessage, Readiness, CheckedRow, two-callback listMergeRequests, ?mr=local), §5.1, §5.4. Also tree.md, state.md, ipc-contract (#2098) and the map's commit line. map-check ok.",
  "files_changed": [
    "docs/architecture.md",
    ".omp/skills/project-map/SKILL.md",
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/ipc-contract/SKILL.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    ".omp/skills/rust-conventions/SKILL.md:21 RS5 names only src-tauri's two Mutexes (Merge, Host); add MergeRequestState's `pages` and `merged` (plan #133, #149), never held together, as #97/#117 amended it for the compare and range states.",
    "src-tauri/AGENTS.md:1 `list_merge_requests` (a worker: every page then one ListEnd…) omits the check: add 'then, when the list reached the project, `check_conflicts` under `MergeRequestState.merged` and each changed row as `ListMessage::Checked`; answers after the check'."
  ]
}
