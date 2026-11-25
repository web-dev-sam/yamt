# Slice mr-heading-rust — the merge request's names reach the changes window; `RangeStart` carries heading and totals; the title bar names them

Feature "MR heading" build 1 of 3, running beside `mr-heading-sides` (frontend only, disjoint); then `mr-heading-web`,
then `mr-heading-verify`. Request: `docs/slices/request-mr-heading.md` rules 1, 4, 5, 6 and the owner's answers (read it
whole); VU18 (`skill://vue-conventions` "Looks": no separator character in window titles built in Rust, two spaces
between parts). Design: `docs/slices/briefs/mr-heading-design.md`
option A, §0 (facts), §1 (shared refinements), §4.1. Plan rows: #119, #132 (the comparison stays `<base>..<head>`), #195
(marks by `--review-of`), proposed #199 (design §5). Risks: RK42 (the second yamt's arguments), RK40 (opening writes no
ref: unchanged, do not touch the fetch), RK79.

Facts (given, from the design's §0; re-check only what is marked `[INFERENCE]`):

- `prepare_open` / `open_diff` / `Details` / `OpenDiff`: `crates/merge-requests/src/open.rs:27-47,52-103`; the details
  query `crates/merge-requests/src/query.rs:15-19`, its test `query/tests.rs:112-123`; `is_from_fork`
  `crates/merge-requests/src/page.rs:294-298`; `RangeToOpen` `crates/merge-requests/src/lib.rs:202-213`.
- `range_arguments` and its round-trip test (RK42): `src-tauri/src/second_window.rs:45-57,122-145`.
- `args.rs`: `USAGE` 6-30, `MarksOf` 77-92, `merge_request_marks` 134-148, `parse` 150-184, `invocation` 186-210; tests
  `src-tauri/src/args/tests.rs:245-304`; the match in `src-tauri/src/lib.rs:68-74`.
- `src-tauri/src/range.rs`: `RangeState` 23-29, `run_range` 33-52 (title computed before listing, line 44),
  `manage_range_in` 56-84, `review_of` 86-91, `range_title` 97-99, `open_range` 101-106; tests
  `src-tauri/src/range/tests.rs` (helpers 62-127, `open_range_answers_the_range_s_start` 260-268, title test 335-342).
- `src-tauri/src/window.rs`: `open_with_data_folder` 104-127 (title used at 121 → `open_and_wait` 134-146),
  `open_compare` 95-102, `window_title` 187-190.
- `crates/range`: `RangeStart` `src/lib.rs:81-87`, `Range::start` `src/open.rs:88-97`, `entries_at`/`line_counts`
  `src/entries.rs:79-89,153-158`; `.start()` callers: `src/open.rs:240`, `tests/range.rs` (67, 75, 139, 145, 199, 204,
  255, 281), `tests/listing_answers.rs:53`, `crates/cli/src/range.rs:10`, `src-tauri/src/range.rs:105`,
  `src-tauri/src/range/tests.rs:263,323`.
- The saturating precedent: `page.rs:278-292`. GitLab fields and the fork form: design §0 "Outside facts" (sourced).
- The fake glab answers a details query with `tests/glab/<scenario>/graphql-merge-request-<iid>.json`
  (`scripts/fake-glab/glab:196-202`); `merge-requests/` is project id 7 (`project.json`).

## Target

**Owned:** `crates/range/src/lib.rs`, `crates/range/src/open.rs`, `crates/range/src/entries.rs`,
`crates/range/tests/range.rs`, `crates/range/tests/listing_answers.rs`, `crates/range/AGENTS.md`,
`crates/cli/src/range.rs`, `crates/cli/AGENTS.md`,
`crates/merge-requests/src/lib.rs`, `crates/merge-requests/src/open.rs`, `crates/merge-requests/src/query.rs`,
`crates/merge-requests/src/query/tests.rs`, `crates/merge-requests/tests/open.rs`, `crates/merge-requests/AGENTS.md`,
`tests/glab/merge-requests/graphql-merge-request-{12,13,14,15,16,17,18,19}.json` (18 and 19 new), `tests/glab/README.md`,
`src-tauri/src/args.rs`, `src-tauri/src/args/tests.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/range.rs`,
`src-tauri/src/range/tests.rs`, `src-tauri/src/window.rs`, `src-tauri/src/second_window.rs`,
`src-tauri/src/reviewed/tests.rs`, `src-tauri/AGENTS.md`.

Size: 19 code files, 8 one-line recorded answers, the README and 4 `AGENTS.md` (one build, because `RangeToOpen`,
`Invocation::Range` and `Range::start` change together: any split leaves the workspace uncompiled); ~600 changed lines
`[INFERENCE]`.

**Read-only:** everything else. Generated: `frontend/src/ipc/bindings.ts` and `frontend/fixtures/range/*.json` — run
`just bindings` and `just fixtures` for your own checks; the orchestrator regenerates and commits both after your patch
(never in it). `frontend/**` is `mr-heading-web`'s: after your patch the web typecheck is red until that build lands
(expected; say so in `open_risks`, do not fix it).

**Non-goals:** the window (`frontend/**`); `RangeSideLabel`, `Compared`, `right_branch`, `lines_up`, the fetch, the pair
lock, threads, marks (rule 6: nothing else moves); GitLab's own diff counts; a fork's namespace looked up by any other
call; docs outside the owned `AGENTS.md`/README (the docs keeper's).

## Contract (fixed; you may add, never change)

```rust
// crates/range/src/lib.rs — exported
/// A merge request's title and branches as GitLab named them when its changes were opened (plan §2 #199): `source`
/// as GitLab's merge-request page names it, `<namespace full path>:<branch>` for a fork, `(fork) <branch>` for a fork
/// GitLab does not show the reader.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct MergeRequestNames {
    pub title: String,
    pub source: String,
    pub target: String,
}

/// What the window's line and title bar name (plan §2 #199).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeHeading {
    /// A range typed by hand: its sides' labels.
    Typed,
    /// A merge request's changes, with its names at the click.
    MergeRequest { iid: u32, names: MergeRequestNames },
    /// A merge request's changes started without its names (an older yamt's arguments).
    UnnamedMergeRequest { iid: u32 },
}

/// The whole range's line counts: every listed file's `Counted` lines summed, saturating at `u32::MAX`; a
/// `NotCounted` file adds nothing.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct RangeTotals {
    pub added: u32,
    pub removed: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct RangeStart {
    pub range: String,
    pub heading: RangeHeading,
    pub totals: RangeTotals,
    pub left: RangeSide,
    pub right: RangeSide,
    pub files: Vec<RangeEntry>,
}

// crates/range/src/open.rs
impl Range {
    #[must_use]
    pub fn start(&self, heading: RangeHeading) -> RangeStart; // totals over self.entries (entries.rs `totals`)
}
// crates/cli/src/range.rs: range.start(RangeHeading::Typed)

// crates/merge-requests/src/lib.rs
pub struct RangeToOpen {
    pub root: PathBuf,
    pub spec: String,
    pub project: String,
    pub iid: MergeRequestIid,
    /// The merge request's title and branches from the details query, as the window shows them (plan §2 #199).
    pub names: yamt_range::MergeRequestNames,
}

// crates/merge-requests/src/query.rs — DETAILS_QUERY's value, exactly this one line (single spaces; the `\`
// continuations of `query.rs:17-19` may keep their style as long as the value is this):
// query MergeRequestDetails($fullPath: ID!, $iid: String!) { project(fullPath: $fullPath) { mergeRequest(iid: $iid) { state title sourceBranch targetBranch sourceProjectId targetProjectId sourceProject { namespace { fullPath } } diffRefs { baseSha headSha } } } }
// source shown (request rule 5, owner): not a fork → sourceBranch; a fork (is_from_fork(sourceProjectId,
//   targetProjectId)) with sourceProject.namespace.fullPath → "<fullPath>:<sourceBranch>"; a fork without it (GitLab
//   shows no source project) → "(fork) <sourceBranch>" (one const, `HIDDEN_FORK = "(fork) "`), never the bare branch.
//   require_branch_name stays on the target only.

// src-tauri/src/args.rs — `MarksOf` renamed (lsp rename), field `marks` → `range_of`
/// What a range window is of: its two sides by name, or a merge request's changes (`--review-of`), which its Reviewed
/// marks and its heading follow (plan §2 #195, #199).
pub(crate) enum RangeOf {
    SideNames,
    MergeRequest { project: String, iid: u32, names: Option<MergeRequestNames> },
}
Invocation::Range { spec: RangeSpec, repo: PathBuf, ai: Ai, start: StartScreen, range_of: RangeOf }
// Flags, each one argv element, value = everything after the prefix (may hold `=`, quotes, newlines, a leading `-`):
//   --mr-title=<text>   --mr-source=<branch>   --mr-target=<branch>
// All three once each, together, with --review-of → RangeOf::MergeRequest { names: Some(..) }; none → names: None.
// Refusals (one line + USAGE, exit 2; --help/--version still win):
//   "give --mr-title, --mr-source and --mr-target together, each once"     (one or two of them, or one twice)
//   "--mr-title, --mr-source and --mr-target go with --review-of=<project>!<iid>"   (all three, no --review-of)
//   the existing --review-of refusals keep their precedence (a window without a range answers
//   "--review-of goes with --diff=<range>" as today).
// USAGE gains, right after the --review-of lines:
//   "  --mr-title=<text> --mr-source=<branch> --mr-target=<branch>\n"
//   "                    with --review-of: the merge request's title and branches the window shows\n"
//   "                    (the merge-request page passes them)\n"

// src-tauri/src/second_window.rs — range_arguments, in this order:
//   --diff=<spec>, --repo, <root>, --review-of=<project>!<iid>, --mr-title=<title>, --mr-source=<source>,
//   --mr-target=<target>, then --ai when on.

// src-tauri/src/window.rs
/// Builds a window whose state `manage` sets up in `<data_dir>/yamt` before the window opens, `manage` answering the
/// window's title; its refusal is the one line the run ends with, a closed window is exit 0 after `at_exit`.
pub(crate) fn open_with_data_folder(
    kind: WindowKind,
    manage: impl FnOnce(&App, &Path) -> Result<String, String>,
    at_exit: impl FnOnce(&AppHandle),
) -> tauri::Result<Ending>;
// open_compare's manage answers COMPARE_TITLE.

// src-tauri/src/range.rs
pub(crate) struct RangeState { pub(crate) range: Range, pub(crate) heading: RangeHeading, /* the rest as today */ }
pub(crate) fn run_range(repo: &Path, spec: &RangeSpec, ai: Ai, start: StartScreen, range_of: RangeOf) -> Ending;
/// Ok: the window's title (`range_title` of the listed range's start).
fn manage_range_in<R: Runtime>(app: &App<R>, app_folder: &Path, resolved: Resolved, ai: Ai, range_of: RangeOf)
    -> Result<String, String>;
fn range_title(start: &RangeStart, root: &Path) -> String;
// open_range answers state.range.start(state.heading.clone()).
// heading: SideNames → Typed; MergeRequest { iid, names: Some(n) } → MergeRequest { iid, names: n };
//          MergeRequest { iid, names: None } → UnnamedMergeRequest { iid }.
```

**Title bar** (`range_title`; request rule 1 and VU18: parts set apart by **two spaces**, never a separator character;
`→` U+2192 is content; `−` U+2212; the ` — <folder> — yamt` end with U+2014 stays, `<folder> — yamt` being
`window_title(root)`; between `!<iid>` and `<title>` one space):

| heading               | title                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- |
| `Typed`               | `<start.range>  +<added> −<removed> — <folder> — yamt`                             |
| `MergeRequest`        | `!<iid> <title>  <source> → <target>  +<added> −<removed> — <folder> — yamt`       |
| `UnnamedMergeRequest` | `!<iid>  <left.short_id>..<right.short_id>  +<added> −<removed> — <folder> — yamt` |

e.g. `!13 Snooze a reminder  snooze → main  +4 −1 — rr — yamt`, `!13  531ea52..6ea97d8  +4 −1 — rr — yamt`. One
constant for the two-space gap. Every `char::is_control` character of `<title>` is written as a space; nothing else is
changed.

**Generated TS** (after `just bindings`; `mr-heading-web` codes against these names — if specta's differ, report it):
`MergeRequestNames = { title: string; source: string; target: string }`; `RangeHeading = { kind: "typed" } | { kind:
"mergeRequest"; iid: number; names: MergeRequestNames } | { kind: "unnamedMergeRequest"; iid: number }`; `RangeTotals =
{ added: number; removed: number }`; `RangeStart` gains `heading: RangeHeading; totals: RangeTotals`.
**Generated fixtures** (after `just fixtures`): each `frontend/fixtures/range/*.json` `start` gains `"heading": { "kind":
"typed" }` and `"totals": { "added": <n>, "removed": <m> }`, nothing else changes.

**Recorded answers** (`tests/glab/merge-requests/`, one line each; the `diffRefs` and `state` of 12–17 as today):

| file          | `title`                                   | `sourceBranch` | `targetBranch`      | `sourceProjectId` / `targetProjectId` | `sourceProject`                          | `diffRefs`      |
| ------------- | ----------------------------------------- | -------------- | ------------------- | ------------------------------------- | ---------------------------------------- | --------------- |
| 12            | Reminders before a card is due            | feature        | main                | 7 / 7                                 | `{"namespace":{"fullPath":"taskboard"}}` | as today        |
| 13            | Snooze a reminder                         | snooze         | main                | 7 / 7                                 | same                                     | as today        |
| 14            | Card colours                              | colours        | main                | 7 / 7                                 | same                                     | `null` as today |
| 15 (`merged`) | Archive finished cards                    | archive        | main                | 7 / 7                                 | same                                     | as today        |
| 16            | Start from a commit nobody has            | lost-base      | main                | 7 / 7                                 | same                                     | as today        |
| 17            | Snooze into a branch named like a refspec | snooze         | `main:refs/heads/x` | 7 / 7                                 | same                                     | as today        |
| 18 (new)      | Remind by e-mail                          | feature        | main                | 12 / 7                                | `{"namespace":{"fullPath":"sam"}}`       | !12's           |
| 19 (new)      | Remind by e-mail from a hidden fork       | feature        | main                | 12 / 7                                | `null`                                   | !12's           |

Key order in each object: `state`, `title`, `sourceBranch`, `targetBranch`, `sourceProjectId`, `targetProjectId`,
`sourceProject`, `diffRefs` (as the query asks). `tests/glab/README.md`'s `merge-requests/` paragraph names the new
fields and !18 (a fork, `sam`) and !19 (a fork GitLab does not show).

## Change

1. `crates/range`: the three types, `RangeStart`'s two fields, `entries::totals(entries: &[RangeEntry]) -> RangeTotals`
   (`pub(crate)`), `Range::start(heading)`; every `.start()` caller passes `RangeHeading::Typed`; `AGENTS.md`'s type list.
   `crates/cli`: `start(RangeHeading::Typed)`; its `AGENTS.md` if it names `RangeStart`'s fields.
2. `crates/merge-requests`: the query text; `Details` gains `title: String`, `source_branch: String`,
   `source_project_id: Option<i64>`, `target_project_id: i64`, `source_project: Option<…>` (`namespace: Option<…>`,
   `full_path: String`); `OpenDiff` carries the `MergeRequestNames`; `prepare_open` puts them into `RangeToOpen`; the eight
   recorded answers; README; `AGENTS.md` (the details query's fields, `RangeToOpen.names`, the fork form).
3. `src-tauri/src/args.rs`: lsp-rename `MarksOf` → `RangeOf` and the field `marks` → `range_of` (every call site,
   `lib.rs`, tests, `reviewed/tests.rs`); add `names`; the three flags, the two refusals, `USAGE`.
4. `second_window.rs`: the three flags in `range_arguments`; the round-trip test carries names.
5. `window.rs`: `open_with_data_folder` without `title`, `manage` answering it; `open_compare`.
6. `range.rs`: `RangeState.heading`; `run_range`/`manage_range_in` per the contract (the heading derived before
   `review_of` consumes `range_of`; the lock still first; the title built after listing); `range_title`; `open_range`.
   `src-tauri/AGENTS.md` (`RangeOf`, the `--mr-*` flags, `manage` answers the title).
7. `just bindings` and `just fixtures` locally for your checks; neither file goes into the patch.

## Acceptance

- `crates/range/src/entries.rs` unit: `totals_sum_every_counted_file_and_skip_not_counted` (two `Counted`, one
  `NotCounted`), `totals_saturate_at_u32_max` (`u32::MAX` + 1 added → `u32::MAX`).
- `crates/range/tests/range.rs`: `start_carries_the_heading_it_is_given_and_the_listed_files_totals` (a real repo, each
  of the three headings; `totals` = Σ of `start.files`' `Counted`).
- `crates/merge-requests/src/query/tests.rs`: the details query's argv is exact (the full text above) and one line with
  balanced braces.
- `crates/merge-requests/tests/open.rs`: `an_opened_merge_request_carries_its_title_and_branches` (!13 →
  `{ "Snooze a reminder", "snooze", "main" }`); `a_fork_s_source_is_its_namespace_then_its_branch` (!18 →
  `sam:feature`); `a_fork_gitlab_does_not_show_is_marked_as_a_fork` (!19 → `(fork) feature`, never `feature`); the
  existing tests still pass on
  the widened answers (!14 `Preparing`, !15 `NotOpen`, !16 `MissingCommit`, !17 refused before any fetch).
- `src-tauri/src/args/tests.rs`: `mr_names_with_review_of_name_the_merge_request`;
  `mr_names_without_review_of_partial_or_twice_are_refused` (each of: one flag, two flags, a flag twice, all three without
  `--review-of`; `--help` still wins); `a_title_holding_quotes_equals_newlines_and_a_leading_dash_is_one_value`
  (`--mr-title=--diff=x "it's" = −\n!7 é`); `review_of_without_names_names_no_names`; `the_usage_names_the_mr_names`.
- `src-tauri/src/second_window.rs`: the RK42 round trip with names (the title above) for both `Ai` values parses back to
  `Invocation::Range { range_of: RangeOf::MergeRequest { names: Some(..), .. }, .. }`.
- `src-tauri/src/range/tests.rs`: `a_typed_window_s_title_is_the_range_its_totals_and_folder`
  (`main...remote  +1 −1 — <folder> — yamt`, two spaces, no `·`, the repo's one changed line; each of the three title
  tests asserts the exact string and that it holds no `·`, `|` or `•`);
  `a_merge_request_window_s_title_names_it_its_branches_and_totals`; `an_unnamed_merge_request_s_title_names_its_short_ids`;
  `a_control_character_in_the_title_is_a_space_in_the_title_bar` (a `\n` and a `\t`); `open_range_answers_the_heading_and_totals`
  (through `invoke_on`: `heading` = `{ "kind": "mergeRequest", "iid": 13, "names": { … } }`, `totals` = `{ "added": 1,
  "removed": 1 }`); the existing `open_range_answers_the_range_s_start` passes `Typed`; the old title test is replaced.
- `just fixtures` locally: `git diff --stat frontend/fixtures` shows only `range/review.json` and `range/empty.json`,
  each diff only the `heading` and `totals` keys (paste it); revert them before reporting.
- Commands: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test -p yamt-range -p
  yamt-merge-requests -p yamt-cli -p yamt-app`, `just bindings` then `just bindings-check` (revert `bindings.ts`
  afterwards), `just arch-check`, `just mutants HEAD`.

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK40, RK42, RK79), `skill://verification`.
