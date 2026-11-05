# MrPersonDiscussionsDocs

Agent output (`agent://MrPersonDiscussionsDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsDocs.md), collected 2026-11-05T15:30:14.062Z.

{
  "summary": "Docs now match the person-discussions code at f887786b. Updated: project-map tree/state/commit line; architecture (read_discussions offers, §3.9, §4 FirstComment, §5.1 rows, thread panel, new 'One person's discussions', keptInPlace key); ipc-contract; crate and shell AGENTS; ui AGENTS (queue file, keyed threads, Body/Buttons, person view); README review-mode project; plan #193/#194 and a note on #164; RK41/53/61 amended, RK77/78 added; CHANGELOG. ipc AGENTS needed no change. Main should run `just check`.",
  "files_changed": [
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/project-map/SKILL.md",
    "docs/architecture.md",
    ".omp/skills/ipc-contract/SKILL.md",
    "crates/merge-requests/AGENTS.md",
    "src-tauri/AGENTS.md",
    "frontend/src/ui/AGENTS.md",
    "tests/glab/README.md",
    "docs/plan.md",
    ".omp/skills/risk-register/SKILL.md",
    "CHANGELOG.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    "docs/slices/briefs/mr-person-discussions-state.md:111,126,138-141 say `order` rises on refresh/rowsReplaced; fix: these set held = expanded entries and keep `order`; only open and pick start a new order",
    "docs/slices/briefs/mr-person-discussions-design.md:272-274 same order-on-refresh wording; fix as above (C3 amended)",
    "docs/slices/briefs/mr-person-discussions-design.md §3 docs-keeper list names `MergeRequestPersonMenu.vue`; the file is `MergeRequestPersonPicker.vue`",
    "frontend/src/ui/MergeRequestFilter.vue:63 `keyOf` repeats the `viewerKey` rule; fix: use core `viewerKey`",
    "docs/plan.md rows #162, #179, #183, #189 carry no inline 'reopened/amended by #193' note (row #193 records them); add one if the plan's inline-note convention is wanted"
  ]
}
