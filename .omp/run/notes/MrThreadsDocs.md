# MrThreadsDocs

Agent output (`agent://MrThreadsDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsDocs.md), collected 2026-11-04T16:49:05.283Z.

{
  "summary": "The mr-threads docs now match the code at 502225d8, and `just map-check` passes. Updated: architecture §3.2/§3.5/§3.8/§3.9/§4/§5.1/§5.4; ipc-contract (the five commands); tree.md (crate/app/ipc/core/ui rows, fake-glab, scenarios); state.md (offers, `withRow`, marks/reloads, thread and reply texts); map commit line; plan #179–#185 plus a note on old names; RK33/35/41/53/54/60/61/64/66 amended and RK71–RK73 added; gitio and ui AGENTS lines; Reopened notes in two request docs; CHANGELOG; B5 orders in the mr-review-mode design. Only map-check was run.",
  "files_changed": [
    "docs/architecture.md",
    ".omp/skills/ipc-contract/SKILL.md",
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/project-map/SKILL.md",
    "crates/gitio/AGENTS.md",
    "frontend/src/ui/AGENTS.md",
    "docs/plan.md",
    ".omp/skills/risk-register/SKILL.md",
    "docs/slices/request-mr-discussions.md",
    "docs/slices/request-mr-description.md",
    "CHANGELOG.md",
    "docs/slices/briefs/mr-review-mode-design.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    "docs/slices/briefs/mr-threads-app.md:18-19,40,70,80: says merge_requests/thread.rs and tests/thread.rs; the files are now discussion_thread.rs and tests/discussion_thread.rs",
    "docs/slices/briefs/mr-threads-design.md:279-280,312: RK41/RK53 owner merge_requests/thread.rs should be merge_requests/discussion_thread.rs",
    "frontend/src/ui/AGENTS.md: no paragraph for mergeRequestThread.ts, the thread panel or the reply field; add one beside the discussions paragraph",
    "docs/slices/briefs/mr-review-mode-design.md:218-219: the real-app review orders (Me !94 !91 !96 !93, Anna !96 !97 !92) are not re-checked against the new turn rule [INFERENCE: they may have changed]; check them against the next real-app smoke"
  ]
}
