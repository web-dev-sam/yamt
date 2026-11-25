# Merge-request heading — design: the changes window names its merge request, branches and +/− totals

Agent `MrHeadingDesign` (designer). Request: `docs/slices/request-mr-heading.md` (rules 1–6, acceptance, non-goals; read
whole). Design brief: `docs/slices/briefs/mr-heading-design-brief.md`. Plan rows read: §2 #103, #119, #125, #132, #195,
#196 (the last row is #198). Facts carry their source (`path:line` in the tree at `d9d494c4`, a doc, GitLab's source) or
are marked `[INFERENCE]`.

## 0. Facts in the tree

**How a changes window starts and what it knows.**

- `prepare_open` asks the details query, fetches when a commit is missing, builds `spec = "<base>..<head>"`, tries the
  pair lock and answers `RangeToOpen { root, spec, project, iid }` (`crates/merge-requests/src/open.rs:52-73`). The query
  reads only `state targetBranch diffRefs { baseSha headSha }` (`crates/merge-requests/src/query.rs:15-19`); its answer is
  parsed into `Details { state, target_branch, diff_refs }` (`open.rs:27-40`). `RangeToOpen` is
  `crates/merge-requests/src/lib.rs:202-213`.
- The same project's branches query already reads `sourceBranch targetBranch sourceProjectId targetProjectId`
  (`query.rs:21-25`), and `is_from_fork(source_project_id, target_project_id)` decides a fork (a null source id counts)
  (`crates/merge-requests/src/page.rs:294-298`, used by `resolve.rs:46`).
- The child is started as `yamt --diff=<spec> --repo <root> --review-of=<project>!<iid> [--ai]`, one `OsString` per
  argument (`src-tauri/src/second_window.rs:45-57`), through `Command::args` with no shell (`second_window.rs:26-43`); the
  program is this yamt's own binary or AppImage (`second_window.rs:63-66`). The argv is logged on start
  (`second_window.rs:37`). The round trip `range_arguments` → `args::parse` is tested (`second_window.rs:122-145`, RK42).
- `args::parse` matches each argument by `to_str()` and `strip_prefix` (`src-tauri/src/args.rs:150-184`); `--review-of`
  becomes `MarksOf::MergeRequest { project, iid }` (`args.rs:77-92,134-148`); `Invocation::Range { spec, repo, ai,
  start, marks }` (`args.rs:51-57`) reaches `range::run_range` (`src-tauri/src/lib.rs:68-74`).
- `run_range` computes the title **before** the range is listed — `range_title(spec, root)` = `"{spec} — {folder} —
  yamt"` (`src-tauri/src/range.rs:44,97-99`; `window_title` `src-tauri/src/window.rs:187-190`) — and hands it to
  `open_with_data_folder(title, kind, manage, at_exit)`, which runs `manage` (lock, list, stores, `RangeState`) and only
  then builds the window with that title (`window.rs:104-127,134-146`). The compare window passes the fixed
  `COMPARE_TITLE` (`window.rs:25,95-102`).
- `open_range` answers `state.range.start()` (`range.rs:101-106`) = `RangeStart { range, left, right, files }`
  (`crates/range/src/lib.rs:81-87`, `crates/range/src/open.rs:88-97`). `Range` is immutable for the window's life
  (`open.rs:31-37`). `yamt-cli range` prints `start()` and the loaded files; `just fixtures` writes
  `frontend/fixtures/range/{review,empty}.json` with it (`crates/cli/src/range.rs:8-18`, `justfile:47-49`), and
  `just fixtures-check` diffs them (`justfile:33-37`).

**Counts.** Per file `RangeLineCounts::Counted { added: u32, removed: u32 } | NotCounted` (`crates/range/src/lib.rs:54-59`),
`NotCounted` for git's binary and missing numstat (`crates/range/src/entries.rs:153-158`). The merge-request list sums
its sizes with `saturating_add` (`page.rs:278-292`). The window sums per folder in TS (`frontend/src/ui/rangeFolderSums.ts:9-27`,
plan #125) and shows a pair in `RangeCounts.vue` (`text-success-signal` / `text-problem-error`, `RangeCounts.vue:13-16`)
from `lineCounts` (`+n`, `−n` with U+2212, `frontend/src/ui/rangeText.ts:82-86`).

**Labels and who reads them.**

- `RangeSideLabel { Named { name } | MergeBase { left, right } }` (`crates/range/src/lib.rs:28-36`): the left of `a...b`
  is `MergeBase`, every other side `Named` as typed (`crates/range/src/open.rs:44-62`). A changes window's sides are
  therefore `Named { name: <40-hex base> }` and `Named { name: <40-hex head> }`.
- `Compared.right_label` (`lib.rs:70-79`, `open.rs:146-155`) is read by `right_branch` (`crates/review/src/right_branch.rs:9-33`):
  `symbolic_full_name(<head sha>)` is `None`, so a changes window looks its merge request up **by commit**
  (`crates/review/src/send.rs:295-302,321-331`); `lines_up` compares only the two commit ids (`lines_up.rs:38-48`).
  Nothing else in Rust reads a label.
- The window: `sideLabel` / `sideHeading` / `emptyRangeText` (`frontend/src/ui/rangeText.ts:66-76`); the column headers
  are two muted `<h3>` holding `sideHeading` with the subject as `title` (`frontend/src/ui/RangeView.vue:63-67,173-185`);
  the search panel's pane titles (`frontend/src/ui/rangeSearch.ts:27-35`); `twoDotsHint` reads `sideLabel(right)`
  (`frontend/src/ui/rangeThreadText.ts:73-79`). So a changes window's headers show 40-character ids today.

**The window's layout.** The range root is a row: `SideColumn` (`w-60`, resizable, hidden with the file list,
`frontend/src/ui/SideColumn.vue:14-25`) and a right column holding a stack of bars (`ProblemBar`, `NoticeBar`, `empty:hidden`)
above the grid of per-file `RangeView`s, the empty-range text and the settings / merge-request screens
(`frontend/src/ui/RangeApp.vue:143-178`). `RangeView`'s header row is 40 px of file icon, path, the since-review
controls, mode note, Previous, Next, collapse, the reviewed count, Send, merge requests, settings
(`RangeView.vue:105-170`). An existing chip look: `rounded border border-control-border bg-panel-inline px-1.5`
(`frontend/src/ui/KeymapList.vue:149`). Tokens `fg`, `fg-muted`, `code`, `panel`, `panel-inline`, `control-border`,
`success-signal`, `problem-error` exist in the dark block and every theme (`frontend/src/style.css:24-60`,
`frontend/src/themes/*.css`, e.g. `light.css:11-36`). `mergeRequestReference(iid)` = `!<iid>`
(`frontend/src/ui/mergeRequestsText.ts:123-125`, takes the `MergeRequestIid` brand, `ipc/domain.ts:66,199-201`).

**Fixtures.** `?range=<case>` parses `fixtures/range/*.json` with valibot (`frontend/src/ipc/fixtureRange.ts:95-123`);
cases `review` (`main...feature`, merge base `531ea52`, right `9c1ba3f`) and `empty` (`feature..feature`). `app-session
start-fixture` turns `--threads`, `--gitlab`, `--reviewed` into URL parameters (`frontend/scripts/app-session/startArgs.ts:104-115`)
and `start-app --review-of` into the app's flag (`startArgs.ts:59-87,238-261`). The fake glab answers a details query
with `<scenario>/graphql-merge-request-<iid>` (`scripts/fake-glab/glab:196-202`); `tests/glab/merge-requests/` holds
!12 (`531ea52..9c1ba3f`, "Reminders before a card is due", `feature` → `main`), !13 (`531ea52..6ea97d8`, "Snooze a
reminder", `snooze` → `main`, the head only in range-repo's fake GitLab), !14–!17 (`tests/glab/README.md:132-142`,
`tests/glab/merge-requests/merge-request-13.json`, `graphql-page-1.json:10-11,48-49`, `commit-route/merge-request.json`);
the project id is 7 (`tests/glab/merge-requests/project.json`, `graphql-page-1.json:24-25`).

**Outside facts.**

- GitLab GraphQL `MergeRequest`: `title: String!`, `sourceBranch: String!`, `targetBranch: String!`, `sourceProject:
  Project` (nullable) (`app/graphql/types/merge_request_type.rb:78,82,89,98`, gitlab-org/gitlab master); `Project.namespace`
  (`project_type.rb:386`); `Namespace.fullPath: ID!` (`namespace_type.rb:28`).
- GitLab's merge-request page names a fork's source branch `<source project's namespace full path>:<branch>`, the branch
  alone otherwise (`app/presenters/merge_request_presenter.rb:118-126`, `source_project_namespace` =
  `source_project.namespace.full_path`, `app/models/merge_request.rb:1952-1957`, v19.3.2-ee). A fork `sam/taskboard`
  with branch `feature` reads `sam:feature`.
- A title is at most 255 characters (`app/models/concerns/issuable.rb:35`, `TITLE_LENGTH_MAX = 255`).
- `Command::arg`: "the argument is not passed through a shell, but given literally to the program"; on Windows,
  "most applications use the standard convention for decoding arguments … these are safe to use with `arg`" (Rust std,
  `std::process::Command::arg`). yamt is such an application (Rust's own `args_os`). On Linux and macOS each element is one
  `execve` argv string. The one character no argv can carry is NUL; GitLab stores titles in PostgreSQL text, which cannot
  hold a NUL character (PostgreSQL docs, "Character Types"), and git refuses NUL and control characters in a ref name
  (git-check-ref-format(1)).
- `[INFERENCE]` GitLab's GraphQL answers `sourceProject: null` both for a deleted source project and for one the viewer
  may not read (GitLab's GraphQL authorization nulls an unauthorised nullable object).

## 1. What every option shares (rules settled, details refined here)

- **Comparison untouched (rule 6, #119, #132).** `spec` stays `<base_sha>..<head_sha>`; `RangeSideLabel`, `Compared`,
  `right_branch`, `lines_up`, the pair lock, threads and `--review-of` marks are not touched. Every option keeps the
  labels as typed and adds the merge request's names as a **separate** fact, so the right side's lookup stays by commit.
- **Fork source form (rule 5).** `source` = `<namespace full path>:<sourceBranch>` when `is_from_fork(sourceProjectId,
  targetProjectId)` and GitLab sends `sourceProject.namespace.fullPath`; `(fork) <sourceBranch>` for a fork whose source
  project GitLab does not show (owner's answer 6: never the bare branch); `sourceBranch` alone for a same-project
  merge request. Computed once in `prepare_open`, carried as text.
- **Title bar text (rule 1, owner's answer 3, VU18).** Parts set apart by **two spaces**, never a separator character;
  `→` (U+2192) is content (direction), minus U+2212; the ` — <folder> — yamt` end (U+2014) stays:
  - changes window: `!13 Snooze a reminder  snooze → main  +A −R — rr — yamt`
  - plain diff window: `main...feature  +A −R — rr — yamt` (the range as typed)
  - a changes window started without names (rule 6): `!13  531ea52..6ea97d8  +A −R — rr — yamt` (the short ids,
    never 40 characters; `..` is range syntax, content)
  - every control character of the MR title (a newline included) is a space in the title bar; branch names cannot hold
    one (git-check-ref-format(1)).
- **Headers (rule 3).** Changes window: left = target name, then muted "where `<source>` branched off", then
  the short id muted monospace; right = source name, then the short id. Plain `a...b`: the same look, left = `a`, "where
  `b` branched off" (owner's answer 5); `a..b` and the right side: name and short id. Started without names: the short
  id alone. Since view: "As you reviewed it" as today (#196).
- **No click target on the line** (non-goal): `open_page` opens only pages a list offered (ipc-contract `open_page`);
  the range window has no offered page of its own merge request without the merge-request page loaded.

## 2. Options

### A. Names ride the child's arguments; Rust puts heading and totals into `RangeStart` (recommended)

**Data structures first.**

```rust
// crates/range/src/lib.rs — the one definition of the names (merge-requests and src-tauri use it)
pub struct MergeRequestNames { pub title: String, pub source: String, pub target: String }
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeHeading {
    Typed,                                                   // yamt --diff=<range> by hand
    MergeRequest { iid: u32, names: MergeRequestNames },     // opened from the merge-request page
    UnnamedMergeRequest { iid: u32 },                        // --review-of without names (an older yamt's argv)
}
pub struct RangeTotals { pub added: u32, pub removed: u32 } // Σ Counted, saturating; NotCounted adds nothing
pub struct RangeStart { range, heading: RangeHeading, totals: RangeTotals, left, right, files }
impl Range { pub fn start(&self, heading: RangeHeading) -> RangeStart }

// crates/merge-requests: RangeToOpen { root, spec, project, iid, names: MergeRequestNames }

// src-tauri/src/args.rs — MarksOf renamed, because it now names more than the marks
pub(crate) enum RangeOf {
    SideNames,
    MergeRequest { project: String, iid: u32, names: Option<MergeRequestNames> },
}
Invocation::Range { spec, repo, ai, start, range_of: RangeOf }
// flags: --mr-title=<text> --mr-source=<branch> --mr-target=<branch>: all three or none, only with --review-of
```

```ts
// frontend/src/ipc/rangeDomain.ts — iid branded MergeRequestIid
type RangeHeading =
  | { kind: "typed" }
  | { kind: "mergeRequest"; iid; names }
  | { kind: "unnamedMergeRequest"; iid };
// frontend/src/ui/rangeText.ts — the one place a side's shown name is decided
type ColumnName =
  | { kind: "named"; name; branchedOff: string | null; shortId; subject }
  | { kind: "commit"; shortId; subject };
type HeadingLine =
  | { kind: "mergeRequest"; reference; title; source; target }
  | { kind: "unnamedMergeRequest"; reference; source; target } // short ids
  | { kind: "typed"; left; dots: ".." | "..."; right };
```

**Path.** `prepare_open` widens the details query (`title sourceBranch sourceProjectId targetProjectId sourceProject {
namespace { fullPath } }`) → `RangeToOpen.names` → `range_arguments` adds three `--mr-*=` elements → `args::parse` →
`RangeOf::MergeRequest { names: Some(..) }` → `manage_range_in` derives `RangeHeading` once, keeps it in `RangeState`,
lists, builds `range.start(heading)` and answers the title from it (`open_with_data_folder`'s `manage` returns the
title, since the totals exist only after listing) → `open_range` answers `range.start(heading)` → the page shows the
line and headers from that `RangeStart`. Title bar and line read one struct from one pure function over the immutable
`Range`, so the numbers cannot differ. Offline by construction (rule 5): no GitLab call after the click.

**Argument safety.** Each flag is one argv element `--mr-title=<text>` matched by prefix, so a value with quotes, `=`,
spaces, a newline or a leading `-` (`--mr-title=--diff=x`) is the value: the prefix `--mr-title=` matches before any
other. Linux/macOS: argv strings verbatim; Windows: std's quoting with std's own decoding (§0). 255 characters at most
for the title (§0) is far below any argv limit. NUL cannot occur (§0). Tested by the round trip with a title holding
`"`, `'`, `=`, `\n`, a leading `-`, `!` and a non-ASCII letter (RK42).

**Old-style start (rule 6).** `--review-of` without the three flags → `UnnamedMergeRequest { iid }`: `!13`, short ids
in the line and headers, totals as always. Only two flags, or one twice → refused like a malformed `--review-of`
(one line, exit 2), so a half-named window cannot exist.

**Window.** A new row `RangeHeadingLine.vue`, the first child of `RangeApp.vue`'s bar stack above the grid: one
`island bg-panel` line, 36 px, on the files screen only (owner's answer 4; `v-if`, so the stack stays `empty:hidden` on
Settings and the merge-request list), whatever file is shown and with none (its own row, so `RangeView`'s header
controls keep their width at 1280 px by construction). Parts, set apart by `gap-2` and alignment only (VU18): `!12`
muted, the title `font-semibold` truncating first, the source chip, a muted `→` (direction, content), the target chip
(chips `rounded border border-control-border bg-panel-inline px-1.5 font-mono text-code`, `max-w-64 truncate`, full
name in `title`), then `RangeCounts` with the totals at the right end (`ml-auto`). Plain: `main` chip, muted `...`
(the range's own syntax, content: two dots and three compare different commits), `feature` chip, totals.
`RangeColumnHeading.vue` renders one `ColumnName` (name `font-semibold text-fg`, note `text-fg-muted`, short id
`font-mono text-fg-muted`, subject as `title`), used for both columns of `RangeView`. `sideHeading` goes (its callers:
headers, search pane titles, empty text, all move to `columnNames`/`columnText`).

**Files.** Rust: `crates/range/src/{lib,open,entries}.rs`, `crates/range/tests/{range,listing_answers}.rs`,
`crates/cli/src/range.rs`, `crates/merge-requests/src/{lib,open,query}.rs`, `query/tests.rs`, `tests/open.rs`,
`tests/glab/merge-requests/graphql-merge-request-{12..19}.json`, `tests/glab/README.md`,
`src-tauri/src/{args,args/tests,lib,range,range/tests,window,second_window,reviewed/tests}.rs`, four `AGENTS.md`.
Web: `ipc/{rangeDomain,index,fixtureRange}.ts`, `ui/{rangeText,rangeSearch}.ts`, `ui/{RangeApp,RangeView}.vue`, new
`ui/RangeHeadingLine.vue`, `ui/RangeColumnHeading.vue`, eight tests holding `RangeStart` literals, `app-session` flags.
Generated: `ipc/bindings.ts`, `fixtures/range/*.json`.

**Risks.** RK42 (a new flag yamt no longer parses): pinned by the round trip. `open_with_data_folder`'s signature
changes for the compare window too (one call site, `Ok(COMPARE_TITLE.to_owned())`). Between the Rust commit (with
regenerated bindings and fixtures) and the web build the web typecheck is red (test literals lack `heading`/`totals`);
the gate runs after both. Renaming `MarksOf` touches four doc places (§5).

**Tests.** §4. **Visions:** 2 (one definition of the names, one computation of the totals feeding title bar and line,
one function naming a side), 4 (three heading variants and all-or-none flags: a half-named window and a heading
without a merge request do not compile/parse), 1 (labels and posting untouched; plain functions, no new layer), 3
(round-trip test is the detector of RK42).

**Cost.** Two builds for rules 1–6 (~31 + ~23 files, ~600 + ~700 changed lines `[INFERENCE]`), one for rule 7
(`mr-heading-sides`, ~12 files, beside the Rust build), one verify; one plan row.

### B. Names ride the arguments; the page sums the totals and sets the title bar

**Data structures.** As A for `MergeRequestNames` and `RangeHeading`; **no** `RangeTotals`: `ui/rangeText.ts`
`totalsOf(files)` sums like `folderSums`; `ipc/` gains `setWindowTitle(text)` over Tauri's window API; the title text
is built in TS; Rust opens the window with a placeholder title (today's).

**Files.** As A minus `entries.rs`/totals and minus the `open_with_data_folder` change; plus
`src-tauri/capabilities/main.json` (`core:window:allow-set-title`, today only `allow-listen`, `allow-destroy`,
`capabilities/main.json:6`), a new `RangeSource` method and its Tauri/fixture implementations.

**Risks.** The title bar changes after the page loads (a window whose page failed keeps the placeholder); a
capability added to the window; the title format lives in TS while every other title is Rust (`window.rs:25,187-190`).

**Tests.** As A's web tests plus the title text in node; no Rust title test. **Visions:** 2 (one sum), against 5
(a new permission and IPC path for a string Rust can build) and 1 (two places build window titles).

**Cost.** Same two builds, smaller Rust, larger web; a capability review.

### C. Names handed over in a file beside the pair's lock

**Data structures.** `prepare_open` writes `<data>/yamt/range/<repo key>/<base>-<head>/heading.json` `{ format: 1, iid,
title, source, target }` before spawning; `manage_range_in` reads it after taking the lock; heading and totals as A.

**Files.** As A minus the argv and args changes; plus a stored-file reader/writer with `format`, refusals
(RK49-style), and `crates/range` or `merge-requests` gaining `std::fs` writes of a second file kind in the pair folder.

**Risks.** A second writer to the pair folder; a stale `heading.json` names a later hand-typed `yamt
--diff=<base>..<head>` (rule 2 says a plain window shows its typed names); the AI sweep walks pair folders
(`crates/agent/src/sweep.rs:11-28`, per `range-reviewed-design.md` §0); an unreadable file is a new refusal.

**Tests.** File round trip, stale-file cases, sweep. **Visions:** 4 weaker (untyped until parsed), 2 weaker (two
writers), 5 against (a file format for three strings).

**Cost.** One more stored format with its tests and RK row; no argv risk.

## 3. Recommendation

**A.** It is the boring path the request already sketches (`--review-of` beside the spec, `second_window.rs:45-57`),
keeps every name and number in Rust where the title bar is built, and gives the page one struct to show. B moves a
title into TS for one sum the Rust side already holds; C adds a file format and a stale-name hazard for three strings
an argv carries safely on all three systems. A costs the `MarksOf` → `RangeOf` rename, a `manage` that answers the
title, and one red-typecheck interval between the two builds.

## 4. Option A in detail

### 4.1 Rust

- `Range::start(heading)` computes `totals` with `entries::totals(&self.entries)`: `saturating_add` per side over
  `Counted`, `NotCounted` skipped (as `page.rs:289`). `yamt-cli range` passes `RangeHeading::Typed`.
- `prepare_open`'s `open_diff` reads the new fields and builds `MergeRequestNames` (§1 fork form); `require_branch_name`
  stays on the target only (the source is shown, never fetched).
- `manage_range_in(app, app_folder, resolved, ai, range_of) -> Result<String, String>`: `heading_of(&range_of)` first,
  then as today (lock, list, threads, reviewed via `review_of(range, range_of)`), then `title =
  range_title(&range.start(heading.clone()), range.root())`, `RangeState { heading, .. }`, `Ok(title)`.
- `range_title(start: &RangeStart, root: &Path) -> String`, the three forms of §1.
- `open_with_data_folder(kind, manage, at_exit)`, `manage: FnOnce(&App, &Path) -> Result<String, String>` answering the
  window's title; `open_compare`'s answers `COMPARE_TITLE`.

### 4.2 The window

- `toRangeStart` brands `heading.iid` (`isMergeRequestIid`), passes `names` and `totals`.
- `rangeText.ts`: `columnNames(start)`, `columnText(column)`, `branchedOffNote(branch)`, `headingLine(start)`,
  `emptyRangeText(start)` on `columnText`; `sideHeading` removed; `sideLabel` stays (`twoDotsHint`).
- `RangeView` takes `columns: ColumnNames` instead of `leftSide`/`rightSide`; `RangeApp` computes it once.
- `rangePanes` titles = `columnText`.
- Fixture `?heading=mergeRequest|fork|unnamed` replaces the case's heading (values in the web brief); an unknown value
  logs `range.fixture_heading_miss` and keeps the case's.

### 4.3 Tests per layer, and the bug each catches

| Layer                   | Test                                                                                                                                               | Catches                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| range unit              | `totals` over Counted/NotCounted/`u32::MAX`                                                                                                        | a binary file counted; overflow panic or wrap                                                       |
| range integration       | `start(heading)` carries the heading; totals = Σ entries on a real repo                                                                            | totals from another list than the shown one                                                         |
| merge-requests          | `query/tests.rs` the details query's exact text; `tests/open.rs` !13 names, !18 fork `sam:feature`, !19 hidden fork `feature`                      | a missing field, a fork shown without its namespace, a deserialisation failure on a recorded answer |
| src-tauri args          | names with `--review-of`; refused without it, partial, twice; nasty title parses back; `USAGE`                                                     | a half-named window; a title read as a flag                                                         |
| src-tauri second_window | round trip with names (both `Ai`)                                                                                                                  | RK42                                                                                                |
| src-tauri range         | title of typed / named / unnamed / control char; `open_range` answers the heading and totals                                                       | title and line out of step; a newline in the title bar                                              |
| web node                | `columnNames`/`columnText`/`headingLine`/`emptyRangeText` per kind; `toRangeStart` brands iid; `rangePanes`; fixture `?heading`; app-session flags | 40-character id in a header; wrong side as source; `..` vs `...`                                    |
| WebKit fixture          | `?range=review` with each `?heading`, `?range=empty`; 1280 and 900 px; dark and light                                                              | layout overflow; colours not the list's                                                             |
| real app                | page → !13 on range-repo with fake glab; title bar via `xdotool`; posting lines up; plain and old-style starts                                     | the argv path end to end; offline names                                                             |

### 4.4 Rule 7: the side column only beside files (build `mr-heading-sides`)

**Facts.** The merge and range roots render `SideColumn` (`v-show="searchShown || filesShown"`, `SideColumn.vue:14-21`)
with the search panel and the file list (`App.vue:72-94`, `RangeApp.vue:106-142`); the compare root renders
`CompareTabList` with `v-show="fileListShown"` (`CompareApp.vue:71-80`). `Screen = files | settings | serverLog |
mergeRequests` (`ui/screen.ts:3-7`): the merge window has settings and server logs, compare and range settings and the
merge-request list. Each root's `keydown` listener calls the store's `fileListKey` (all three) and `search.toggleKey`
(merge, range) (`App.vue:51-53`, `CompareApp.vue:43-44`, `RangeApp.vue:58-61`); both go through `windowKey(target,
action, event, platform)` (`ui/fileListKey.ts:17-32`), whose `WindowKeyTarget { asking, settings }` the stores and the
search targets satisfy (`store.ts:233`, `compareStore.ts:162`, `rangeStore.ts:239`, `searching.ts:68`,
`mergeSearch.ts:34`, `rangeSearch.ts:17`).

**Design.** Hide, never unmount: `SideColumn` gains a prop `onFiles: boolean` and shows when `onFiles && (searchShown ||
filesShown)`; the merge and range roots pass `screen.kind === 'files'`; `CompareApp` shows `CompareTabList` when
`fileListShown && screen.kind === 'files'`. The list, the search panel (its query, results, open groups), the width and
the list/tree mode keep living in their components and stores, so the files screen brings the column back as it was.
`[INFERENCE]` WebKit keeps a `display: none` element's scroll offset and restores it when shown (WebKit saves a
layer's scroll position when its renderer goes); the verify build checks it. **Keys:** `WindowKeyTarget` gains
`screen: Readonly<ShallowRef<Screen>>`, and `windowKey` answers false off the files screen (before `preventDefault`):
the file-list and search toggles cannot change a hidden column, so it returns exactly as it was. One rule in one
function for both keys and all three windows (vision 2).

**Files.** `ui/SideColumn.vue`, `ui/App.vue`, `ui/CompareApp.vue`, `ui/RangeApp.vue`, `ui/fileListKey.ts`, their
tests (`fileListKey.test.ts`, `searching.test.ts`, the store tests, and every test literal of a `WindowKeyTarget`:
`diskChanges.test.ts`, `stops.test.ts`, …), `ui/AGENTS.md`. Disjoint from `mr-heading-rust`; it runs beside it.

**Tests.** `fileListKey.test.ts`: both actions do nothing (no `preventDefault`, state unchanged) on settings, a server
log and the merge-request list, act on files; the three store tests: `fileListKey` off the files screen leaves
`fileListShown`. WebKit: each window, each non-files screen hides the column; back on files the list, its scroll, the
search panel and its query, the width and the tree mode are as left. **Visions:** 2, 1.

## 5. Builds, records, docs

- **Builds:** `mr-heading-rust` ∥ `mr-heading-sides` (rule 7; disjoint: Rust vs `frontend/src/ui` roots) → (orchestrator:
  `just bindings`, `just fixtures`, commit both with the Rust patch) → `mr-heading-web` (reads `RangeApp.vue`,
  `ui/AGENTS.md` and the `*.test.ts` files as `sides` left them; it owns them only after `sides` is committed, never at
  the same time) → (docs keeper) → `mr-heading-verify` (smoke pass after the web build, final pass after the docs).
- **Proposed plan row #199** (DR5: for the orchestrator to record): "**A merge request's changes window names the
  merge request, its branches and the range's +/− totals** (owner 2026-11-25, request `docs/slices/request-mr-heading.md`
  rules 1–6; design `briefs/mr-heading-design.md` option A). The page passes the title and both branches it read in the
  details query to the second yamt as `--mr-title=`, `--mr-source=`, `--mr-target=` beside `--review-of` (one argv
  element each, all or none); a fork's source is `<namespace full path>:<branch>` as GitLab's page shows it, `(fork)
  <branch>` when GitLab shows no source project. `RangeStart` gains `heading` (`Typed | MergeRequest { iid, names } |
  UnnamedMergeRequest { iid }`) and `totals` (Σ `Counted`, saturating `u32`), both computed once in Rust; the title bar
  (`range_title` over that `RangeStart`, parts two spaces apart, VU18) and the window's line read them. Labels and
  `Compared` unchanged: the posting check still finds the merge request by commit. Owner's answers: the line and every
  window's side column only on the files screen (rule 7, the side column kept mounted and restored as it was; its two
  toggle keys act only there); headers 'target, where source branched off' for `...` and merge requests alike; control
  characters of a title are spaces in the title bar. | Rejected: a handover file beside the pair lock (second writer,
  stale names for a later hand-typed range); totals and title in the page (`setTitle` permission, a title that changes
  after load); an environment variable (inherited by the AI agent and every child) | 2, 4, 1 |"
- **Risk register:** RK42's detector gains "the round trip with `--mr-*` names" (`second_window.rs` tests); RK79's text
  names `RangeOf` for `MarksOf`.
- **Docs keeper:** `tree.md` (new `ui/RangeHeadingLine.vue`, `ui/RangeColumnHeading.vue`; `src-tauri (range)` row:
  `RangeOf`, `--mr-*`), `state.md` (the heading: from the arguments, read once by `manage_range_in`, `RangeState.heading`),
  architecture §3 (`yamt-range` types, `src-tauri` args/range/window, `second_window.rs`), the ipc-contract command list
  (`open_range -> RangeStart { range, heading, totals, left, right, files }`), the ui `AGENTS.md`/architecture window
  sections for rule 7 (the side column only on the files screen, its keys only there), `CHANGELOG.md`.

## 6. Owner's answers (2026-11-25, recorded in the request)

1. The merge-request line shows only on the files screen; the side column of all three windows too (rule 7, §4.4).
2. Plain `a...b` windows use "main, where feature branched off".
3. A fork GitLab does not show is "(fork) <branch>".
4. No separator characters anywhere (VU18): the title bar's parts are two spaces apart.
