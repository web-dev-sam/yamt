# Range reviewed — design: "Reviewed" marks in the range window, remembered per review, and the changes since a review

Agent `RangeReviewedDesign` (designer). Request: `docs/slices/request-range-reviewed.md` (rules 1–7 as updated with the
owner's answer 1: option A plus "Review from start"; acceptance; non-goals). Base commit `b42a6c6b`. Plan rows read: §2
#48, #93, #95, #103–#107, #117, #125, #126, #145–#148. Architecture read: §3.8, §4 (range part), §5.1 (range root).
Facts carry their source (`path:line` at the base commit, a doc, a git manual page) or are marked `[INFERENCE]`.

## 0. Facts in the tree

**How the range is named and opened.**

- `RangeSpec { text, left, dots, right }` keeps both sides as typed; an empty side becomes `"HEAD"`
  (`crates/range/src/spec.rs:6-11,71-77`); `Dots` is `pub(crate)` (`spec.rs:14`).
- `Resolved::resolve` resolves the typed names, the left to the merge base for `...` (`open.rs:37-66`); `Range` keeps
  the `Resolved` (with its `Repo`, `pub(crate)`) privately and is immutable for the window's life (`open.rs:28-34`).
- Each listed file keeps `FileAt { old: Option<BlobAt>, new: Option<BlobAt>, binary }`, `BlobAt { oid, mode, size }`
  (`entries.rs:13-25`), `pub(crate)`; `BlobAt::kind()` maps the mode to `RangeEntryKind` (`entries.rs:28-35`). The entry's
  `path` is the new path, the old one for a deleted file (`lib.rs:59-66`, `entries.rs:115-122`).
- `load_file` = `decide` (submodule → kind change → mode only → binary → too large, `load.rs:63-95`), then
  `read_sides` + `decoded` (not UTF-8) → `RangeFile::Texts { left, right, differences: compare(..), mode }`
  (`load.rs:14-29`). A missing side reads as empty (`load.rs:31-36`). `search` uses the same three functions
  (architecture §3.8, `docs/architecture.md:702-705`).
- `PairLock::take` makes `<range_dir>/<repo key>/<left id>-<right id>/lock` (`lock.rs:24-46`); `repo_key` (folder name +
  FNV-1a 64 of the common git dir) and `fnv1a_64` are private (`lock.rs:107-131`). `pair_folders(range_dir)` lists
  **every** folder under each repo folder as a pair folder (`lock.rs:71-79`), which `yamt-agent`'s sweep walks
  (`crates/agent/src/sweep.rs:11-28`).
- `Repo::symbolic_full_name(name)`: the ref a name stands for (`refs/heads/x`, `refs/remotes/origin/x`, `HEAD` when
  detached), `None` for a commit id or an expression such as `HEAD~2` (`crates/gitio/src/names.rs:56-65`).
- A merge request's changes window is a second yamt started as `yamt --diff=<base_sha>..<head_sha> --repo <root>`
  (`src-tauri/src/second_window.rs:44-55`); `RangeToOpen { root, spec }` carries nothing else
  (`crates/merge-requests/src/lib.rs:202-209`); `prepare_open` knows the project's `full_path` and the `iid`
  (`crates/merge-requests/src/open.rs:52-71`); the commits it lacks are fetched with **no ref**
  (`open.rs:127-147`, `fetch_without_refs`; RK40 forbids moving a ref). `MergeRequestIid(pub u32)` (`lib.rs:108`).
- `manage_range_in` takes the pair lock, lists, opens `ThreadStore` in the pair folder and manages `RangeState`
  (`src-tauri/src/range.rs:46-69`); `app_folder` is `<data_dir>/yamt` (`range.rs:71-73`, plan #107).
- `threads.json` is the stored-file pattern: `format`, `NewerFormat`/`Broken` refused by name before any window, the
  file untouched; temp file + rename (`crates/review/src/thread_file.rs:14-18,192-251`; plan #117, #146; RK49).
- `IpcError` already has `WriteFailed`, `ReadFailed`, `UnknownRangeFile`, `Git` (`src-tauri/src/ipc_error.rs:8-72`).

**The window.**

- `RangeView.vue:70-111`: header = file icon, heading, mode note, Previous, Next, collapse toggle, then Send, merge
  requests, settings. `MergeToolbar.vue:176-188`: "Mark resolved" first, `mr-2 rounded border px-3.5 py-1`, filled
  `border-primary bg-primary text-on-primary hover:brightness-110`, outlined `border-control-border hover:bg-hover`; the
  remaining count after the buttons, `<span class="ml-3 text-fg-muted" role="status">` (`MergeToolbar.vue:204`).
- `FileList.vue`/`FileTree.vue` are generic; the range row is `RangeFileRow.vue` in the `#file` slot
  (`RangeApp.vue:105-118`). The merge list's resolved look: `FileMark.vue:17-45` (lucide `check`, word, name muted).
- `nextUnresolved(files, active)` is #48's rule (`ui/nextFile.ts:3-8`).
- `rangeStore.ts` is 297 lines (oxlint `max-lines` 300, `docs/slices/briefs/range-collapse-design.md:61-62`).
- `followRange(parts)` is already parameterised by `load`, `threads`, `listed`, `events`, `build`
  (`ui/useRangeController.ts:54-69,144-185`); `land` turns a `RangeFile` into columns or a sentence (`:81-96`).
- `RangeController` starts a thread on any drag over the line numbers (`editor/range.ts:132-162`); it has no switch to
  refuse one.
- `RangeView` mounts per visited file, keyed by id (`RangeApp.vue:126-134`).
- Fixture `?range=review`: 13 files in this order: `config`, `data/big.txt`, `docs/current.md`, `docs/keys.md`,
  `docs/legacy.txt`, `public/logo.png`, `src/api/mockBoards.ts`, `src/board/board.ts`, `src/board/reminders.ts`,
  `tools/build.sh`, `tools/deploy.sh`, `tools/setup.cmd`, `vendor/ui` (`frontend/fixtures/range/review.json:473-616`).

**Git keeps an unreferenced blob only for a while.** `git gc` prunes unreachable objects older than `gc.pruneExpire`
(default two weeks); reflog entries of commits no longer on a branch expire after `gc.reflogExpireUnreachable` (default
30 days) (git-gc(1), git-config(1), <https://git-scm.com/docs/git-gc>). A merge request's commits fetched without a ref
(above) are unreachable from the start; `git gc --prune=now` removes them at once.

## 1. What every option must decide (and decides the same way)

These follow from the rules and are shared by the options below.

1. **Review identity (rule 4).** A range's review = `(repository, left side name, dots, right side name)`; a merge
   request's = `(repository, project full path, iid)`. A side's name: when `symbolic_full_name(typed)` is a `refs/…`
   name, that full ref name; otherwise (a commit id, a detached `HEAD`, `HEAD~2`) the full id of the commit it names now.
   The typed name, not the merge base, names the left of `a...b`. Examples: `dev...HEAD` on branch `feature-x` →
   `ref:refs/heads/dev...ref:refs/heads/feature-x`; `main..abc1234` → `ref:refs/heads/main..commit:<40 hex>`;
   `main...HEAD` detached → `…commit:<id>`. `dev..x` and `dev...x` are two reviews (they show different changes).
   [vision 2: one rule, in `yamt-range`, which already owns the typed names; vision 1: full ref names cannot collide
   between a branch and a tag.]
2. **Mark state (rule 5)**, decided at open, once (the range is immutable, `open.rs:28-29`): a stored mark on a listed
   path whose right side `(object id, kind)` equals the range's → _reviewed_; differs → _changed since review_; a mark
   on a path not listed → dropped (and written back once); a listed file with no mark → _unreviewed_. Comparing git's
   object ids is exact and costs no blob read [vision 4/5]. A mode-only change of the right side (same blob, new kind) is
   a change; its since-review view shows the same text twice with no differences [accepted edge, vision 5].
3. **Toggle (rule 2)** reuses #48's next-file rule generalised (`nextFile.ts`: one function with a "done" predicate;
   `nextUnresolved` becomes a caller) over `start.files` order [vision 2: no second copy of #48].
4. **Since-review view (rules 5–7)**: left column = the right side's text when it was marked, right column = today's
   right side, differences by `merge_core::compare` (#95), no threads shown and none started (rule 7: a since-review line
   has no GitLab position; vision 5); "Review from start" = forget the mark; the view kind is derived from the mark
   (no switch state; vision 2). The file's view remounts when its mark changes (key `id:view`).

## 2. Options

### Option A — a new crate `yamt-reviewed`; a mark keeps both sides' object ids and the right side's text in yamt's data folder (recommended)

**Data structures first.**

```text
<data_dir>/yamt/reviewed/<repo key>/<fnv1a-64 hex of the review key text>/
    lock            — held only for one read-modify-write (File::lock), never for the window's life
    reviewed.json   — format 1, below
    texts/<blob id> — the right side's text at its mark, UTF-8, named by git's object id (written once, shared)
```

```json
{
  "format": 1,
  "review": {
    "kind": "range",
    "left": { "kind": "ref", "name": "refs/heads/dev" },
    "dots": "three",
    "right": { "kind": "ref", "name": "refs/heads/feature-x" }
  },
  "marks": [
    {
      "path": "src/board/board.ts",
      "left": { "id": "<hex>", "kind": "file" },
      "right": { "id": "<hex>", "kind": "file" },
      "keptText": true
    }
  ]
}
```

`review` is also `{ "kind": "mergeRequest", "project": "group/project", "iid": 12 }`; a side is
`{ "kind": "commit", "id": "<hex>" }` too; `left`/`right` of a mark is `null` where the range has no such side (added,
deleted); `kind` ∈ `file | executable | link | submodule` (`RangeEntryKind`); marks sorted by path. A deleted right side
needs no text (it reads as `""`, `load.rs:31`); `keptText: false` where the whole change was not text (binary, too large,
not UTF-8, submodule, kind change, mode only: the same `decide`/`decoded` rule as `load`).

Rust (crate `yamt-reviewed`, depends on `yamt-range`, `yamt-gitio` for `Oid` only, `yamt-merge-core` for `compare`):
`ReviewOf { Range { left, dots, right } | MergeRequest { project, iid } }` with `key_text()`; `ReviewedStore` held in
`RangeState` behind a `Mutex` (`open`, `marks`, `mark`, `unmark`, `since_review`); IPC `FileReview { file, mark }`,
`ReviewMark { Reviewed | ChangedSinceReview }`, `SinceReview { Texts { reviewed, current, differences } | NoText }`.
`yamt-range` gains five read-only accessors (side names, repo key, a file's two sides' objects, the right column's text,
`fnv1a_64` made public) — its one job (read a range) unchanged.

Window: `ReviewedSource` (`listReviewed`, `markReviewed`, `unmarkReviewed`, `loadSinceReview`) extended by
`RangeSource`; `ui/rangeReviewed.ts` holds the marks' mirror (its only writer: its own actions after Rust answered, as
`rangeThreads.ts`), the count, the toggle with the next file, "Review from start" and the since loads; `RangeView`
gets the button, the count, the since variant; `RangeFileRow` the mark; `RangeController` an option to start no threads.

**Why the text is kept, not only the blob id.** Rule 5's view needs the reviewed text after a rebase or a push. Blob
ids alone break exactly in the requested case: a merge request's commits are fetched without a ref
(`open.rs:127-147`) and are pruned by the next `git gc` after two weeks; a rebased branch's old blobs after 30 days +
two weeks (§0). Keeping a ref alive would write into the repository (rule 1, RK40). So the right side's text is copied
into yamt's data folder at the mark, once per distinct blob. Size: at most `MAX_TEXT_BYTES` = 8 MiB per text
(`crates/merge-core/src/lib.rs:26`); a review keeps one text per reviewed text file — `[INFERENCE]` typically tens of
KiB per file, so a few MiB for a large review; the core slice measures the folder on `scripts/range-repo.sh` with every
file marked and reports it. The left side's text is not copied: no view shows it (rule 5 shows the reviewed **right**
side); both sides' contents are recorded by git's object id, which is the content's identity (a refinement of rule 4's
"content of both sides", vision 5 — flagged in the recommendation).

**Why texts are separate files.** A toggle writes the small JSON plus at most one new text; inline texts would
rewrite every kept text (up to 8 MiB each) on every click [vision 5: the boring cost model]. Texts no mark names are
swept at open, under the lock.

**Why a lock per write, not per window.** Two windows can hold the same review on different commit pairs (the branch
moved between their starts; `PairLock` does not see it: different pair folders). Each write takes `lock`, re-reads
`reviewed.json`, applies its one change by path, writes temp + rename, unlocks: both windows' clicks survive [vision
2: the file is the one truth]. Each window's own list is classified at its open and changed only by its own clicks.

**Why a folder outside `range/`.** `pair_folders` lists every folder under `range/<repo key>/` as a pair
(`lock.rs:71-79`) and the AI sweep walks them; a `reviewed/` sibling would make that doc false [vision 2/3]. The folder
name is a hash of the review's key text because escaped names collide and meet the 255-byte name limit (#107's reason);
`review` inside the file is compared at read: another review there → `Broken` (a 64-bit collision, by name).

**Why a new crate.** Threads and posting are `yamt-review`'s one job (#117: "a component with a second job is growth
harm", vision 2 over 5); marks are keyed differently (per review, not per pair), stored differently and never posted.
`yamt-range` reads a range; storing user state there would be its second job.

**Merge requests.** `RangeToOpen` gains `project` and `iid`; `start_range` adds `--review-of=<project>!<iid>`
(documented in `--help`: "with --diff=<range>: remember Reviewed marks for this merge request; the merge-request page
passes it"); `args` parses it into `Invocation::Range { …, marks: MarksOf }` with
`MarksOf { SideNames | MergeRequest { project, iid } }` [vision 4: a sum, not an `Option` whose `None` means something];
RK42's round-trip test covers it (`second_window.rs:117-134`). A refusal: `--review-of` without `--diff=<range>`, or a
text without `!<number>`.

**Refusals and errors.** `reviewed.json` newer → `NewerFormat`, broken → `Broken` (serde's line and column), both before
any window, exit 2, file untouched — #117's rule for `threads.json` [vision 2: one rule for yamt's stored files; see
open question 1]. In the window: a failed write changes nothing in memory; `From<yamt_reviewed::Error> for IpcError`
uses existing variants only (`WriteFailed`, `ReadFailed`, `UnknownRangeFile`, `Git`), so no new TS failure kind.

**Files.** `crates/range/src/{lib,open,lock,spec,load}.rs` + new `side_names.rs`, `crates/range/AGENTS.md`;
`crates/reviewed/**` (new); `src-tauri/Cargo.toml` (path dep), `scripts/arch-check.sh`; root `Cargo.toml` (orchestrator);
`src-tauri/src/{reviewed.rs (new), range.rs, commands.rs, args.rs, second_window.rs, ipc_error.rs, lib.rs/window.rs where
`Invocation::Range` is matched}`, `crates/merge-requests/src/{lib,open}.rs`, `crates/merge-requests/tests/open.rs`;
`frontend/src/ipc/{ReviewedSource,reviewedDomain,tauriReviewed,fixtureReviewed}.ts` (new), `RangeSource.ts`,
`tauriRange.ts`, `fixtureRange.ts`, `index.ts`; `frontend/src/ui/{rangeReviewed,rangeVisited}.ts` (new), `nextFile.ts`,
`problem.ts`, `problemText.ts`, `rangeStore.ts`, `useRangeController.ts`, `RangeView.vue`, `RangeApp.vue`,
`RangeFileRow.vue`, `rangeText.ts`; `frontend/src/editor/range.ts`; `frontend/scripts/app-session/{args,startArgs}.ts`;
tests beside each. `just bindings` once (app slice).

**Risks.** (a) Two windows on one review show stale lists (open question 2). (b) A rebase that pulls in upstream
changes makes those changes appear in the since view (non-goal, request). (c) A search hit on the old side of a
since-review file cannot be shown there (open question 3). (d) `rangeStore.ts` at the line cap: the visited list
moves to `rangeVisited.ts`. (e) New risk row proposed: **RK79** "a mark follows the wrong review or loses its reviewed
text (a side named by its commit when it is a branch, a merge request keyed by commits, a blob id kept without its text,
two windows' writes overwriting each other)" — owner `yamt-reviewed` + `yamt-range` `side_names`, tests in §4.

**Tests.** §4. **Visions:** 2 (one owner per fact: the store file; the mark state derived once), 3 (arch-check row,
RK42 round trip), 4 (sum types for the review, the mark, the since reply, `MarksOf`), 1 (no clever caching), 5 (no
dependency: `File::lock` is std since 1.89, toolchain 1.99, `rust-toolchain.toml:2`).

**Cost.** 4 build slices (~2,900 changed lines with tests, `[INFERENCE]`) + verify; one crate, four IPC commands,
one CLI flag, one plan row pair.

### Option B — marks inside `yamt-review`, blob ids only, git as the text store

**Data structures.** A `ReviewedFile` beside `ThreadFile` in `yamt-review`, stored in the same per-review folder
layout but each mark only `{ path, left: {id, kind}?, right: {id, kind}? }`; the since view reads the reviewed blob
from git by its id (`Repo::blob_reader`); a blob git no longer has → the view says so and offers "Review from start".

**Files.** As A minus `crates/reviewed/**` (into `crates/review/src/reviewed_*.rs`), minus `texts/`, plus a blob read
in `yamt-range` for an arbitrary id (a new `Range::read_text(id)`, which reaches past the range's own files).

**Risks.** The requested case fails silently after two weeks for merge requests (§0: fetched without a ref) and after
~6 weeks for rebased branches; `yamt-review` gains a second job (#117's growth harm); `yamt-range` gains a read of
objects outside its range.

**Visions.** 5 (no copies, one crate fewer) against 2 (second job) and the request's own acceptance.

**Cost.** About 400 lines less than A; fails rule 5 for the owner's "new commit / push" case after gc.

### Option C — the window owns the marks (localStorage), Rust only names the review and diffs two texts

**Data structures.** `localStorage["yamt.reviewed.<key>"] = { marks: { path: { right: <text hash> , text } } }` per
review key Rust sends in `RangeStart`; classification in TS by hashing each file's right text after loading it; the
since view via a new `diff_texts` command for the range window (today only the AI's, `range.rs`/`ai.rs`).

**Files.** `crates/range` (key in `RangeStart`), `src-tauri` (a diff command), `frontend/src/ui/**`.

**Risks.** List marks need every file's text loaded at open (a hash per file) — the list cannot show marks until each
file is read; WebKit's localStorage quota (~5 MiB per origin, `[INFERENCE]`) against 8 MiB texts; #117 rejected
localStorage for threads for this size reason; two windows on one review race on one key with no lock.

**Visions.** Against 2 (the window would own durable state Rust also reasons about) and 4 (untyped storage).

**Cost.** Fewer Rust lines, more window lines, and the list marks are wrong or late at open.

## 3. Recommendation — option A

A is the only option that keeps rule 5's view working after the cases the owner named (a push to a merge request, a
rebase) whatever git's gc does, with one owner per fact: the store file in yamt's data folder, written through one crate,
mirrored by one window module. It costs a crate, four IPC commands, one CLI flag and ~2,900 lines `[INFERENCE]`.
Refinement to confirm (rule 4's detail): both sides are recorded by git's object id; only the right side's text is
copied, since no view shows the reviewed left side.

**Proposed plan rows (DR5, for the orchestrator):**

- **#195 Reviewed marks are the crate `yamt-reviewed`, per review in yamt's data folder** (request
  `request-range-reviewed.md` rules 1–7; design `briefs/range-reviewed-design.md` option A). Folder
  `<data_dir>/yamt/reviewed/<repo key>/<FNV-1a 64 of the review key>/` (`lock`, `reviewed.json` format 1, `texts/<blob id>`);
  review = repository + both sides by name (`refs/…` full name, else the commit id) and the dots, or a merge request's
  project and iid passed as `--review-of=<project>!<iid>`; a mark = path, both sides' `{ id, kind }`, the right side's
  text kept when the whole change is text; state at open by the right side's id and kind; each write locks, re-reads,
  applies one change; newer/broken refused by name before any window. Rejected: marks in `yamt-review` (second job,
  #117), blob ids only (gc prunes them: merge-request commits are fetched without a ref), localStorage (#117's size
  reason, list marks need every text), a folder under `range/<repo key>/` (`pair_folders` would list it), one lock for the
  window's life (two windows on one review after the branch moved). Visions 2, 3, 4, 5.
- **#196 Defaults decided with the reviewed design** (orchestrator, OR13; the owner may veto): the button's words
  "Reviewed", the count "N of M reviewed" after the collapse toggle, the since view's left heading "As you reviewed it"
  and note "Changed since you reviewed it", "Review from start" in the since view's header; no threads in the since view;
  a left-side search hit in a since-review file opens the file without moving; a changed-again file's list mark is
  lucide `refresh-ccw-dot` in the warning colour; the next file follows `start.files` order also in the tree view.

## 4. Tests (by slice; each name says the bug it catches)

- **core** (`crates/range` unit tests, `crates/reviewed/tests/reviewed.rs` over `yamt-conflict-repo` temp repositories):
  `side_names_follow_the_branch_head_names_and_keep_a_commit_id`,
  `a_detached_head_and_an_expression_are_the_commit_they_name_now`,
  `right_text_is_the_right_column_load_shows_and_none_when_load_shows_no_texts`,
  `sides_name_each_side_s_object_and_kind_and_none_for_a_missing_side`,
  `the_review_key_text_names_refs_commits_dots_and_merge_requests`,
  `the_folder_name_is_the_pinned_fnv_of_the_key_text`,
  `a_missing_file_is_no_marks_and_nothing_is_written`,
  `a_mark_is_reviewed_again_after_a_new_commit_that_leaves_its_right_side`,
  `a_moved_left_side_keeps_the_mark_reviewed`, `a_changed_right_side_is_changed_since_review`,
  `a_mark_on_a_path_no_longer_listed_is_dropped_written_and_its_text_swept`,
  `marking_again_records_the_current_contents`, `unmark_forgets_and_an_unmarked_file_writes_nothing`,
  `since_review_shows_the_kept_text_against_today_s_right_side`, `since_review_of_a_file_marked_as_binary_is_no_text`,
  `a_deleted_right_side_reviewed_compares_from_empty_text`,
  `two_stores_on_one_review_keep_both_changes`, `a_newer_format_is_refused_by_name_and_left_unchanged`,
  `a_broken_file_names_line_and_column_and_is_left_unchanged`, `a_file_naming_another_review_is_broken`,
  `a_failed_write_changes_nothing_in_memory`, `a_leftover_temp_file_is_ignored`,
  `the_reviewed_folder_is_not_a_pair_folder`.
- **app**: `--review-of` parse/refusals (`args.rs`), the RK42 round trip with `project`/`iid`
  (`second_window.rs`), `prepare_open` fills `project`/`iid` (`crates/merge-requests/tests/open.rs`), `list_reviewed`
  after `mark_reviewed` through `invoke`, a window on a new commit of the same review classifies, `load_since_review`,
  a newer `reviewed.json` refuses the range before any window.
- **store**: `rangeReviewed.test.ts` (toggle marks then opens the next unreviewed in list order, wraps, stays when none,
  unmark stays; "Review from start" forgets; a failed write keeps the marks and reports; one write at a time; the count
  counts only `reviewed`), `nextFile.test.ts` (both callers), the domain/tauri/fixture source tests.
- **view**: `useRangeController.test.ts` (since view loads `loadSinceReview`, shows no threads, never starts one, a
  `noText` reply is a sentence; the whole view unchanged), `rangeText.test.ts` (the words), `range.browser.test.ts`
  (`startsThreads: false`: a drag over the numbers starts nothing).
- **verify**: `range-reviewed-verify.md`.

## 5. Slices (recommended option)

| slice                   | agent     | owns                                                                                                                                                                                                     | needs                                       |
| ----------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `range-reviewed-core`   | rust-impl | `crates/range/**`, `crates/reviewed/**`, `src-tauri/Cargo.toml` (path dep line), `scripts/arch-check.sh`                                                                                                 | —                                           |
| `range-reviewed-app`    | rust-impl | `src-tauri/src/**`, `src-tauri/AGENTS.md`, `crates/merge-requests/src/{lib,open}.rs`, `crates/merge-requests/tests/open.rs`, `crates/merge-requests/AGENTS.md`                                           | core; runs `just bindings`                  |
| `range-reviewed-store`  | web-impl  | `frontend/src/ipc/**` (listed files), `frontend/src/ui/{rangeReviewed,rangeVisited,nextFile,problem,problemText,rangeStore}*`, `frontend/src/ui/rangeThreads.test.ts`, `frontend/scripts/app-session/**` | app (bindings)                              |
| `range-reviewed-view`   | web-impl  | `frontend/src/editor/range.ts`, `frontend/src/editor/range.browser.test.ts`, `frontend/src/ui/{useRangeController*,RangeView.vue,RangeApp.vue,RangeFileRow.vue,rangeText*}`, `frontend/src/ui/AGENTS.md` | store; **wires the window**                 |
| `range-reviewed-verify` | verifier  | none                                                                                                                                                                                                     | view committed (smoke), docs keeper (final) |

Sequential: core → app → store → view → verify (smoke after view, final after the docs keeper). No two build slices
run in parallel: each compiles against the previous one's output (the generated bindings, the store's API).
