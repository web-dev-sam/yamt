# PlanScoutMrRowFacts

Agent output (`agent://PlanScoutMrRowFacts`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T18-27-31-593Z_01a19d84-3c89-72d1-885b-0286d2017e79/PlanScoutMrRowFacts.md), collected 2026-11-02T18:45:05.884Z.

I couldn't write `local://PlanScoutMrRowFacts.md`: this session has only read, grep, glob and web search tools, and no write tool. The full report is below so it can be saved as is. The main checkout was read as it is now.

**The diff-stats bug in short:** no single condition hides both the size and an icon. When GitLab sends `diffStats: []` or `null`, the Rust side returns `size: None` and the size part of the row is hidden. The only row icon that can disappear is the CI box, which is hidden when `headPipeline` is null. The readiness icon is always rendered.

# Merge-request row facts

## 1. Row layout
- One row is one component, `frontend/src/ui/MergeRequestRow.vue`: script lines 1-86, template lines 88-200. The list page `frontend/src/ui/MergeRequestsView.vue:181-194` draws one `<MergeRequestRow>` for each entry of `shownRows`.
- Order from left to right, inside the `<div class="flex items-center gap-3">` at :96:
  1. Text column (:97-119). Line 1 is the title: a `<button>` when `row.page` is set (:98-106), otherwise a `<span>` (:107). Line 2 is the muted meta line `<p class="truncate text-xs text-fg-muted">` (:108-118): `!iid · created … · +A −D · N files`.
  2. Discussions: `w-12`, MessageSquare icon and count (:120-128).
  3. Approvals: `w-12`, ThumbsUp icon and count (:129-137).
  4. CI box: `w-7`, `CiStatusBox` (:138-147).
  5. Readiness icon: `w-7`, `MergeRequestReadiness` (:148-150).
  6. Resolve/Continue action: `w-7` (:151-173).
  7. Show Diff button: FileDiff icon (:174-186).
  8. Under the row: the refusal line and the reply line (:188-193).
- The row has no labels, no author, no assignees and no reviewers.
- Child components: `MergeRequestReadiness.vue:28-32` and `CiStatusBox.vue:119-171`.

## 2. Diff stats `+0 −0`: what hides the size and the icon
- **Query:** `crates/merge-requests/src/query.rs:36` asks for `diffStats {{ additions deletions }}`, one entry per changed file. `diffStatsSummary` is avoided on purpose: in a list it makes GitLab report a wrong `detailedMergeStatus` (query.rs:104-110; `docs/slices/briefs/mr-diff-stats.md`).
- **Rust parse:**
  - `page.rs:101` declares `diff_stats: Option<Vec<FileStats>>`.
  - `page.rs:204` does `size: change_size(node.diff_stats.as_deref().unwrap_or_default())`.
  - `page.rs:246-249`: `change_size` returns `None` when the list is empty.
  - So `null`, `[]` and a missing field all become `size: None`. Tests confirm this at `page/tests.rs:367-371` (`no_files_or_null_stats_is_no_size`).
  - Entries that exist but count 0/0 (for example a binary or mode-only change) give `Some { 0, 0, files: N }`.
- **IPC:** `lib.rs:236-238` has `pub size: Option<ChangeSize>`; `ChangeSize { additions, deletions, files }` is at lib.rs:122-131. In TS it is `bindings.ts:172 ChangeSize`, used by `MergeRequestRow` (`bindings.ts:570`). `mergeRequestDomain.ts:14-22,66-74` passes `size` through unchanged.
- **Template:**
  - `MergeRequestRow.vue:58-62`: `size` is `null` when `row.size === null`.
  - :110 `<template v-if="size !== null">` hides only the ` · +A −D · N files` part.
  - The words come from `mergeRequests/internal/size.ts:18-29`.
- **The icons:**
  - The CI box is the only conditional icon: `MergeRequestRow.vue:140` has `v-if="row.pipeline !== null"`, and `row.pipeline` comes from `headPipeline` (`page.rs:200`). A null `headPipeline` means no icon, which request #4 asks for ("no pipeline → no icon", `request-merge-requests.md:60`).
  - The readiness span (`MergeRequestRow.vue:148-150`, `MergeRequestReadiness.vue:29`) has no `v-if` and always renders.
  - Nothing wraps both the size and an icon.
- **`[]` or null from GitLab:** this explains the missing size. `[INFERENCE]` A merge request with no changed files gets `diffStats: []` from GitLab; the brief `mr-diff-stats.md` Change 2 assumes "no entries while it has not computed the diff yet". The recorded case is `!27` in `tests/glab/mr-conflicts/graphql-page-1.json:96-115`: it has `diffStats: []` and a SUCCESS pipeline, so it shows no size but does show a CI icon.
  - `[INFERENCE]` An empty merge request usually has no head pipeline, so the CI icon disappears for a separate reason that happens at the same time.
- **Hazard in the main checkout, `mergesCleanly`:**
  - Rust's `Readiness::MergesCleanly` (lib.rs:150-153) and `bindings.ts:880` have it.
  - `mergeRequests/internal/readiness.ts:24-29,59-65` (ICONS) and `MergeRequestReadiness.vue:17-23` (LOOKS) do not. `LOOKS[undefined].tone` would throw while rendering.
  - Today nothing reaches that code: `tauriMergeRequests.ts:26-36` ignores every message after `end`, and `checked` messages come only after `end`.
  - An empty merge request whose head equals its target merges clean locally. If GitLab says CHECKING, UNCHECKED or CONFLICT, the result would be `mergesCleanly` (`readiness.rs:55-67`). This matters once the page slice that is running elsewhere (SLICES.md:54) lands only partly.
- **Unknown:** which icon the owner means by "status icon", and what GitLab actually sends for his merge request.

## 3. Approvals
- **Query:** `query.rs:34` asks `approvedBy {{ nodes {{ username }} }}`, usernames only.
- **Parse:** `page.rs:96` reads `approved_by: Option<Nodes<IgnoredAny>>` and `page.rs:199` keeps only `approvals: count(listed(node.approved_by).len())`.
- **IPC:** `lib.rs:226-227` `pub approvals: u32`; in TS `MergeRequestRow.approvals: number`.
- **Render:** `MergeRequestRow.vue:129-137` shows ThumbsUp and the count, muted at 0. The hover comes from `approvalsText` (`mergeRequestsText.ts:70-72`, "N approvals"); `approvals` is computed at Row.vue:48.
- Approver names do not reach the window: the parser throws away even the username.

## 4. People data in the query and IPC types
- The list query is in `crates/merge-requests/src/query.rs:21-43`, with the node fields at :30-41:
  - `labels {{ nodes {{ title }} }}` (:31)
  - `assignees {{ nodes {{ username name }} }}` (:32)
  - `reviewers {{ nodes {{ username name }} }}` (:33)
  - `approvedBy {{ nodes {{ username }} }}` (:34)
  - `currentUser {{ username }}` (:25)
- Not asked anywhere: `author`, `avatarUrl`, label `color`, `mergeRequestInteraction`/`reviewState`.
- **Rust types:** `Person { username, name }` (lib.rs:56-63). `MergeRequestRow` has `assignees: Vec<Person>`, `reviewers: Vec<Person>` and `labels: Vec<String>` (lib.rs:214-221). `MergeRequestPage.me: Option<String>` (lib.rs:255-260).
- **Bindings:** `Person` at bindings.ts:742, `MergeRequestRow` at :570, `MergeRequestPage` at :552, `ListMessage` at :507, `CheckedRow` at :182, `Readiness` at :861.
- **Window filter type:** `mergeRequests/internal/filters.ts:17-25` (`Person`, `ListedRequest`).
- There is no author field anywhere.

## 5. Labels
- Rows do not show labels (Row.vue:88-200 has none). The request lists "avatars" and "labels, assignees, reviewers or branches on a row (filters only)" as out of scope (`request-merge-requests.md:107-108`).
- Only label titles are fetched (`query.rs:31`, `page.rs:116-119,186`); the colour is not.

## 6. Filters
- **Bar:**
  - `MergeRequestsView.vue:110-134` renders a `MergeRequestFilter` for each entry of `LIST_FILTERS = ["assignee","reviewer","label"]` (:31), then "Clear filters" (:120-127), then Draft as `ChoiceButtons` (:128-133, `ChoiceButtons.vue:1-18`; options at `mergeRequestsText.ts:23-27`).
- **One filter:** `ui/MergeRequestFilter.vue:1-131`.
  - The opener button toggles on click (:69-73, :78-90).
  - The × clear button shows when set (:91-101).
  - The menu is a plain `<div class="absolute … z-10">` at :102-129, not a popover component.
  - The narrow box appears when there are more than `NARROW_FROM` = 8 choices (`choices.ts:10`).
  - Menu items are `menuitemcheckbox` and show a count (:116-127).
- **Open/close:** `ui/useDropdownMenu.ts`.
  - `toggle` (:61-77): opens below, or flips above when it would overflow.
  - Closes on a click outside (`onClickOutside`, :112-124), on Escape/menu keys (`menuKey` → `stepMenuItem` "close", :79-101), on a context menu elsewhere (:125-132) and on window blur (:133-137).
  - The menu stays open after a toggle.
- **Options and counts:** `mergeRequests/internal/choices.ts`, called from `ui/mergeRequests.ts:200-206` (`choicesOf`) over all loaded rows.
  - `personChoices` (:62-92): "Me" first (count of rows holding `me`, :50-60), then "None" (rows with nobody), then the others plus still-checked missing values. Those are sorted by display label with `localeCompare(…,"en")` (:16-18).
  - `labelChoices` (:94-117): "None" first, then titles sorted the same way. A checked value missing from the list stays with count 0.
- **Predicate:** `filters.ts:69-79` `passes()` (any match inside a filter, every filter across) and :81-87 `filtered()`. Wired at `ui/mergeRequests.ts:248`.
- **Not single-valued:** assignee, reviewer and label are arrays (`filters.ts:9-14`), changed with `toggled` (:97-110). Draft is a single tri-state `"all"|"drafts"|"ready"` (`filters.ts:1`).
- **Stored shape:** key `"yamt.mergeRequests.filters"` (`ui/mergeRequestFilters.ts:7`), value `{ "<common git dir>": { assignee: string[], reviewer: string[], label: string[], draft } }`.
  - Words: `"me"|"none"|"user:<username>"`, and `"none"|"label:<title>"` for labels (`stored.ts:17-25`).
  - The entry is removed when no filter is set (`mergeRequestFilters.ts:22-29`). The test at `mergeRequests.test.ts:462-464` shows the exact JSON.
  - Parsers: `mergeRequests/internal/stored.ts` `filtersFrom` (:56-67) and `storedFilters` (:69-76).
  - The repository key is `GitLabProject.found.repository` (lib.rs:39-48), picked at `ui/mergeRequests.ts:243-246`.

## 7. Tooltips and `title` attributes
- There is no generic tooltip component or directive.
  - The one custom hover tooltip is `ui/OperationLabel.vue:52-74`: `@mouseenter`/`@mouseleave` set `open`, and a fixed `<div class="… hover-tooltip … tooltip-text">` is placed by `tooltipBox()` from `ui/operationTooltip.ts:15-23`. Its utilities are in `style.css:169,175`.
  - CodeMirror tooltips (`editor/internal/removalTooltip.ts:46-50`) reuse the same utilities through `theme.css:281-289`.
  - The CI hover box is its own popover inside `CiStatusBox.vue:41-117,144-169` (via `useMenuPlacement`).
  - Everything else uses native `title`.
- `title=`/`:title=` in `frontend/src/ui/**`: 56 in 28 files, counted with `\s:?title=`.

| File | Count |
| --- | ---: |
| ChoiceView | 2 |
| CiStatusBox | 1 |
| CompareLanguagePicker | 1 |
| CompareTabList | 2 |
| CompareView | 3 |
| FileList | 1 |
| FileMark | 1 |
| KeyRecorder | 1 |
| MergeRequestFilter | 1 |
| MergeRequestReadiness | 1 |
| MergeRequestRow | 8 |
| MergeRequestsButton | 1 |
| MergeToolbar | 1 |
| MergeView | 2 |
| NoticeBar | 1 |
| OperationButtons | 1 |
| ProblemBar | 1 |
| RangeFileRow | 2 |
| RangeMessage | 4 |
| RangeMessageEditor | 1 |
| RangeSendButton | 1 |
| RangeThreadBox | 3 |
| RangeView | 5 |
| SearchPanel | 2 |
| SearchResults | 2 |
| ServerGroup | 3 |
| ServerStatus | 3 |
| SettingsButton | 1 |

- Line numbers in the merge-request and CI files:
  - `MergeRequestRow.vue`: :102 (pageTitle), :107 (row.title), :110 (createdTitle), :113 (size.title), :123 (discussions), :132 (approvals), :156 (action hover/label), :176 (openTitle).
  - `MergeRequestReadiness.vue:29`
  - `MergeRequestFilter.vue:93`
  - `MergeRequestsButton.vue:14`
  - `CiStatusBox.vue:154` (job button)
  - `MergeRequestsView.vue`: none.
- `.title =` from TS: none in `ui/`. The only ones are `editor/internal/find.ts:137` and :213.

## 8. Writes to GitLab today
- `yamt_gitio::Glab` (`crates/gitio/src/glab.rs:16-19`, re-exported at `merge-requests/src/lib.rs:30`):
  - `Glab::find()` (:52)
  - `run(cwd, args, stdin: Option<Vec<u8>>) -> Result<GlabRun>` (:72-99), which adds `NO_COLOR=1` and `GIT_TERMINAL_PROMPT=0` and a 20 s `GLAB_TIMEOUT` (:10)
  - `get` (:102-113), for stdin-closed reads
  - `auth_status` (:116)
- **The only write:** `crates/review/src/gitlab.rs:80-91` `post_draft_note` builds `["api","--include","--method","POST","projects/{id}/merge_requests/{iid}/draft_notes","--input","-"]`.
  - `send.rs:175-176` runs it as `posted(run(glab, range.root(), &args, Some(body.json())))`.
  - `glab_answer.rs:85-92` `run` wraps `glab.run`.
  - `glab_answer.rs:25-51` `posted` reads `--include` output with `http_answer_from` (:55-74): 2xx is a success, 401/403/429/5xx stop, other 4xx are a refusal.
- The merge-requests crate has only reads: `glab.get` at list.rs:41, open.rs:83 and resolve.rs:76. The shell calls `Glab::find()` at `src-tauri/src/merge_requests.rs:245,257,267`.
- **Fake glab:** `scripts/fake-glab/glab:171-179` routes `POST */draft_notes`, `POST graphql` and the GET routes; any other route answers 404 (`request-merge-requests.md:162-163`). A new write route would need its own case there.

## 9. Images and CSP
- `src-tauri/tauri.conf.json:14` (and devCsp at :15) has `img-src 'self' data:`, so remote `https://gitlab.com/uploads/...` avatars are blocked.
- There is no `<img>` with a remote `src` in `frontend/src`; the only `<img` strings are hostile-input test strings in the markdown tests.

## 10. Local storage per repository
- `ui/windowStorage.ts`:
  - `storedValue<T>(key, fallback, serializer, warnEvent, storage?)` (:15-31) wraps vueuse `useStorage` with `flush:"sync"`, `writeDefaults:false`, and `onError` → `log.warn`.
  - `storedRecord(key, warnEvent, storage?)` (:51-67) is a JSON map with `entryAt`, `set` and `remove`.
  - `parseStored` (:7-13) returns `null` on bad JSON.
- `ui/serverPins.ts`: key `"yamt.servers.pinned"` (:12), map keyed by `root` (`serverSetup.ts:194`). `pinsOf` (:14-20) drops anything that is not a string array; an empty entry is removed (:41-45).
- `ui/mergeRequestFilters.ts:9-32` follows the same pattern, keyed by repository.
- No key has a version suffix. Formats change by reading old shapes leniently: `toolbarButtons.ts:38-46,93-120` reads an old array format next to the new object format under the same key.
- Other keys: `yamt.collapse.unchanged`, `yamt.files.view`, `yamt.files.width`, `yamt.panes.split`, `yamt.toolbar.hidden`.

## 11. Fixtures
- `frontend/src/ipc/fixtureMergeRequestData.ts` makes `Generated.MergeRequestRow` values from cycles over the row index (`row()` :156-177; `fixtureRows(from,count)` :180-182):
  - `PEOPLE` (:45-51)
  - `LABELS` (:53)
  - `PIPELINES` with `null` every 8th row (:55-64)
  - `READINESS` with 8 states and no `mergesCleanly` (:77-86)
  - `size` `null` every 5th row (:144-154)
  - draft every 7th row, no assignee every 4th, no label every 5th
  - It has constants such as `FIXTURE_REPOSITORY`, `FIXTURE_ME="sam"`, `OPEN_REPLIES`, and iid 640 downward.
- Fake glab list scenarios under `tests/glab/`:
  - `merge-requests/`: `graphql-page-1.json`, `graphql-page-2.json` (with `diffStats: null` at :22), `graphql-merge-request-{12..17}.json`, `project.json`
  - `merge-requests-timeout/`
  - `mr-conflicts/` (`!27` with `diffStats: []`)
  - `local-conflicts/` (`!49` PREPARING with `diffStats: []`)

## 12. What the docs decided about the row
- `request-merge-requests.md:57-62` (#4): the row holds exactly the title, `!iid`, created-ago, open discussions, approvals, the CI icon and the open-changes button; counts are never "x/y". Line 107 keeps labels, assignees, reviewers and avatars off the row (filters only).
- `request-mr-conflicts.md:28-36`: the size `+120 −40 · 6 files` goes in the meta part, with unknown counts showing nothing. The readiness icon gets its own fixed column beside the CI box, one state per row, conflicts first.
- `briefs/mr-row-two-lines.md`: line 1 is the title alone; line 2 is a muted `text-xs` `!iid · created … · size` line. The icon columns on the right keep fixed widths and are centred vertically.
- `briefs/mr-row-pointer.md`: the hand cursor covers the whole row when it has a page. Only the hovered button gets `bg-hover`, otherwise the row gets `bg-row-hover`. Disabled buttons show the arrow cursor and no highlight.
- `briefs/mr-row-colours.md`: `sizeParts` with the parts coloured: iid, age and `·` muted, `+X` in success-signal, `−Y` in problem-error, files in `text-fg`. The `textContent` stays the same.
