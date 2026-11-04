# MrDescriptionDocs

Agent output (`agent://MrDescriptionDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionDocs.md), collected 2026-11-04T01:10:36.156Z.

{
  "summary": "I updated the docs for the merge-request description feature. architecture.md: §3.5, §3.9, §4, the state table §5.1, the description panel in §5.4, §7. plan.md: #112 reopened, #133/#137/#152 amended, new #171–#175 (#175 is #2280's gitlab.com-only uploads rule). Risk register: RK41/RK53 rewritten, RK66/RK67 added. Also tree.md, state.md, ipc-contract, the map's Verified line (9fe4c13b) and both AGENTS.md. Plan and AGENTS.md describe isLinkedPage in domain.ts, which the fix round has not done. Main committed some of these edits mid-run in fa6a2adc.",
  "files_changed": [
    "docs/architecture.md",
    "docs/plan.md",
    ".omp/skills/project-map/SKILL.md",
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/ipc-contract/SKILL.md",
    ".omp/skills/risk-register/SKILL.md",
    "src-tauri/AGENTS.md",
    "frontend/src/ipc/AGENTS.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    "frontend/src/ui/AGENTS.md:71: the panel's onClickOutside ignores openers only; add `[data-refreshes-list]` (Refresh, list-failure Retry) so a refresh never closes it",
    "src-tauri/src/merge_requests.rs:379: open_page doc says 'a list of this window sent it'; say 'a reply of this window sent it' (lists, discussions, descriptions), then `just bindings`",
    "CHANGELOG.md: no line for the description panel; add one (design §3 docs-keeper list)",
    "docs/slices/briefs/mr-links-*.md: plan rows #175–#177 must be #176–#178 (#175 is the uploads rule); Main is renumbering",
    "frontend/src/ipc/descriptionDomain.ts: docs describe isLinkedPage in domain.ts (Main #2296); until the fix round moves it, it is private here. tree.md also names settingsRead.ts, not created yet"
  ]
}
