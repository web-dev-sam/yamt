# MrPeopleDocs

Agent output (`agent://MrPeopleDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleDocs.md), collected 2026-11-03T23:32:33.853Z.

{
  "summary": "Docs updated for mr-people (base 21f71b1b..eb8ceaaa): plan #153 amended, #169, #170 (add-field rule as implemented per Main/#2265, open-row rule #2246); risk register RK53/RK54 updated, RK64/RK65 added; architecture shell commands, §3.9 People + tests, MergeRequestSource, §5.1 state rows (offered writers incl. people.rs per #2255, withPeople, loadList, people search/asks/open boxes/add field), page People paragraph; tree.md and state.md rows for every new/moved file; ipc-contract commands+source; src-tauri/AGENTS.md; map verified line eb8ceaaa.",
  "files_changed": [
    "docs/plan.md",
    "docs/architecture.md",
    ".omp/skills/project-map/SKILL.md",
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/ipc-contract/SKILL.md",
    ".omp/skills/risk-register/SKILL.md",
    "src-tauri/AGENTS.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    "frontend/src/ui/AGENTS.md:69: 'the field clears and keeps focus once that add is answered unless the text changed meanwhile' → after #2265: clears only if text unchanged, keeps focus only if it still has focus (plan #170)",
    "docs/slices/request-mr-row-details.md rule 3 and its non-goal: add a line 'reopened by request-mr-people.md' (design's shared edits)",
    "CHANGELOG.md: one line for adding/removing assignees and reviewers (design's shared edits)",
    "frontend/src/ui/MergeRequestPeopleSearch.vue:83-87 refocuses unconditionally; docs (plan #170, architecture, tree.md) describe the #2265 fix 'keeps focus only if it still has it'"
  ]
}
