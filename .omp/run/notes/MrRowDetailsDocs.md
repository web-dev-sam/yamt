# MrRowDetailsDocs

Agent output (`agent://MrRowDetailsDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsDocs.md), collected 2026-11-02T21:53:32.092Z.

{
  "summary": "Docs now match the code at 8010d81f. architecture.md has Glab::post, the yamt-picture scheme and CSP, the Pictures gate, the new crate modules, the generated types, rerequestReview, the §5.1 rows, and the hover, rows and filters text. tree.md has rows for every new file, rewritten useDropdownMenu and page rows, and filterActions/choicesOf (#2113, #2124). state.md adds Pictures, due dates, re-request asks, tooltip and menu state, replaced/running, and click (was toggle). ipc-contract has rerequest_review and the scheme. RK53–RK56 are filed. Verified line set to 8010d81f.",
  "files_changed": [
    "docs/architecture.md",
    ".omp/skills/project-map/SKILL.md",
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/ipc-contract/SKILL.md",
    ".omp/skills/risk-register/SKILL.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    ".omp/skills/ts-conventions/SKILL.md:61 TS15: add the exception for ui/tooltip.ts's per-window tooltip singleton (tip element, phase, closedAt, WeakMap of bound elements).",
    "docs/slices/briefs/mr-row-details-rust.md:133: `pictures: Mutex<PictureShelf>` plus a separate fetch gate → `pictures: Pictures` (one Mutex<PictureShelf> + Condvar, #2119).",
    "src-tauri/AGENTS.md:1: name the yamt-picture URI scheme (merge_requests/pictures.rs, Pictures gate, PICTURE_SCHEME registered in commands.rs) and the rerequest_review command.",
    "docs/slices/request-merge-requests.md:107 Non-goals still list 'avatars; labels, assignees, reviewers … on a row'; plan #151 reopens them. Mark them reopened by request-mr-row-details.",
    "docs/slices/request-merge-requests.md:151-152: CSP `img-src 'self' data:` and 'remote avatars would not load' are outdated; img-src now adds yamt-picture:, http://yamt-picture.localhost and Gravatar's two hosts (#152)."
  ]
}
