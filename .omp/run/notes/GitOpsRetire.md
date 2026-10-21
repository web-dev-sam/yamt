# GitOpsRetire — notes (rust-impl, 3.J row 9)

Output fields verbatim.

Row 9 is finished: the three retired commands and everything that only served them are gone, `side_names` is a plain `SideNames` again, #1383 and #1391 are fixed, and every acceptance line was observed.

**summary**
- The commands `list_files`, `side_names` and `abort_merge` are removed, along with `Merge::abort`, `MergeSession::refresh`/`abort_merge`/`side_names()`, `FileList`, `merging.rs`, `Repo::abort_merge`, `Repo::rebase_in_progress` and `REBASE_STATE_DIRS`. On the window side, `ChunkSource.listFiles`/`sideNames`/`abortMerge`, their `tauri.ts`/`fixture.ts` code and the domain type `FileList` are gone.
- The close ending (`held_merge_ending`) now lists through `refresh_stop`. If git has moved on, it counts the new stop's files and stages nothing.
- **#1383:** each file's disk version now starts at the session's `first_disk_version`. When git moves on, `Merge::MovedOn` carries the old session's `highest_disk_version()`, and `list_stop` opens the new stop with `MergeSession::open_after(root, highest)`, so its versions start above that. A write carrying an older version gets `StopMovedOn` and nothing is written.
- `MergeSession.side_names` is a plain `SideNames` with a one-line doc comment; `read_side_names` became `SideNames::read`.
- **#1391** is fixed in `src-tauri/AGENTS.md`, and the session and gitio `AGENTS.md` files are updated.

**files_changed**
- `crates/gitio/{AGENTS.md, src/repo.rs, tests/abort.rs, tests/operations.rs}`
- `crates/session/{AGENTS.md, src/disk.rs, src/lib.rs, src/open.rs, src/operation.rs, src/session.rs, src/side_names.rs, src/writes.rs}`; deleted `src/merging.rs` and `tests/merging.rs`; new `tests/listing/mod.rs`
- `crates/session/tests/{all_or_nothing, deleted_side, disk_is_truth, finish_and_reset, git_view, left_as_is, operations, orientation, remembered, save, save_round_trip, side_names, start_from_disk, take}.rs`
- `src-tauri/{AGENTS.md, src/commands.rs, src/merge.rs, src/merge/tests.rs, src/outcome.rs}`
- `frontend/src/ipc/{ChunkSource.ts, domain.ts, fixture.ts, fixture.test.ts, fixtureOperations.ts, fixtureOperations.test.ts, index.ts, tauri.ts, tauri.test.ts}`; `bindings.ts` regenerated with `just bindings` in this copy
- `frontend/src/ui/{saving,store,stops,listing}.test.ts` (only the `ChunkSource` doubles)

**tests_added** (and where the old ones went)
- `merge::tests::after_the_next_stop_is_listed_a_save_with_the_old_stop_s_version_writes_nothing` (#1383): step 1 is settled to version 1, the rebase continues, `list_stop` lists step 2. A `save_file` with version 1 answers `StopMovedOn`, the file bytes and `ls-files -u` are unchanged, and the new load gives `disk_version` 2.
- `outcome::tests::closing_a_session_git_moved_on_from_counts_the_new_stop_s_files_and_stages_nothing`: a held session whose rebase was continued in a terminal ends with "1 of 1 files still unresolved", and `ls-files -u` is unchanged.
- `gitio tests/operations.rs::a_rebase_state_that_cannot_be_looked_at_fails_the_stop`: moved here from `rebase_in_progress_fails_…`; now proves `Repo::stop()` fails with `ReadFailed` on `rebase-merge`.
- `gitio tests/abort.rs::a_merge_abort_drops_resolutions_saves_and_merge_head_but_keeps_untracked_files`: the old `abort_merge` test, now run through `Repo::abort(&Operation)`. Of the other tests in that file:
  - The refusal test went: `abort_continue.rs::an_abort_git_refuses_is_git_s_text_and_changes_nothing` already proves it.
  - The `rebase_in_progress` true/false tests went: `each_rebase_backend_…` and `rebase_merges_redoing_a_merge_is_a_rebase_…` cover them.
- Migrated to `list_stop`: `commands::tests::list_stop_returns_every_conflicted_file_…`, `list_stop_stages_a_file_changed_on_disk_…` and `list_stop_names_both_branches_of_the_merge`.
- Migrated to `abort_operation` on a merge window, in `merge/tests.rs`: the three abort tests. A refused abort still lists `operation.kind == "Merge"`.
- Removed `session/tests/merging.rs`. Each of its claims is now covered elsewhere:
  - "a rebase stopped on a merge commit is not a merge to abort": gitio `rebase_merges_redoing_a_merge_is_a_rebase_with_redoing_merge_not_a_merge`.
  - "merge" and "aborted outside": `session/tests/operations.rs` (`each_operation_s_view_names_what_it_applies`, `a_rebase_aborted_in_a_terminal_lists_git_s_view_without_an_operation`).
  - "an unreadable rebase state never fails the list" is no longer true — see deviations.
- Frontend:
  - `tauri.test.ts`: "a string error from listStop rejects the call with that message" replaces the `listFiles` one.
  - `fixture.test.ts`: the `listFiles` assertions now read `listStop`, and the fixture `abortMerge` test is gone.
  - `fixtureOperations.test.ts`: the `merging` assertions are gone.

**smoke_evidence**
- **Search:** `rg -n 'list_files|side_names\(|abort_merge|listFiles|sideNames\(|abortMerge\b|FileList\b|is_merging|rebase_in_progress' crates src-tauri frontend/src --glob '!bindings.ts'` now hits only `ui/` files:
  ```
  frontend/src/ui/toolbarButtons.ts:10:  "abortMerge",
  frontend/src/ui/toolbarButtons.ts:24:type OperationButtonId = "continue" | "abortMerge";
  frontend/src/ui/toolbarButtons.ts:61:  abortMerge: true,
  frontend/src/ui/toolbarButtons.ts:73:    if (id !== "continue" && id !== "abortMerge") {
  frontend/src/ui/MergeToolbar.vue:56:  abortMerge: {
  frontend/src/ui/toolbarButtons.test.ts: 30 lines (toolbar id and stored decisions)
  frontend/src/ui/App.vue:7:import FileList from "./FileList.vue";
  frontend/src/ui/App.vue:70:    <FileList v-show="fileListShown" ...
  frontend/src/ui/AGENTS.md:9: … `FileList`'s handle uses `useColumnDrag` …
  ```
  The `FileList` hits are the `FileList.vue` component, not the IPC type (see deviations).
- **`cargo clippy --workspace --all-targets -- -D warnings`:** `Finished \`dev\` profile … in 0.92s`, no warnings.
- **`cargo test --workspace`:** 59 lines `test result: ok`, no `FAILED`. Among them:
  - `merge::tests::after_the_next_stop_is_listed_a_save_with_the_old_stop_s_version_writes_nothing ... ok`
  - `outcome::tests::closing_a_session_git_moved_on_from_counts_the_new_stop_s_files_and_stages_nothing ... ok`
  - `a_rebase_state_that_cannot_be_looked_at_fails_the_stop ... ok`
- **`cargo fmt --all -- --check`:** no output. **`just arch-check`:** `arch-check: ok`.
- **`just bindings-check`:** `diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts` printed no difference.
- **`pnpm -C frontend typecheck`:** `$ vue-tsc -b`, no errors.
- **`pnpm -C frontend test`:** `Test Files  125 passed (125)`, `Tests  1741 passed (1741)`.
- **`pnpm -C frontend lint`** and **`pnpm -C frontend unused`:** no findings. **`fmt:check`:** clean after `oxfmt` on the two edited test files.
- **Real app** (`cargo tauri build --debug --no-bundle`; `scripts/operations-repo.sh merge /tmp/yamt-test-retire-merge`; `just app-session start-app --binary <wrapper that saves exit status and stderr>`):
  - File list: `"assets/logo.bin | docs/notes.md | src/board.ts | src/card.ts"`
  - Headers: `"Local (yours): main | Remote (theirs): feature"`; screenshot at `/tmp/yamt-retire-smoke/before-abort.png`
  - Clicking "Abort merge", then "Abort Merge" in the question: the window closes, `status: 1`, last stderr line `yamt: merge aborted`, `git status --porcelain` empty, `no MERGE_HEAD`.

**deviations_from_brief**
- **`read_side_names` renamed to `SideNames::read`:** the acceptance pattern `side_names\(` also matches `read_side_names(`.
- **`FileList\b` still hits the `FileList.vue` component** (`ui/App.vue`, `ui/AGENTS.md`), which is row 8's read-only area and not the IPC type. The search cannot print only the toolbar id while that component keeps its name.
- **"An unreadable rebase state never fails the list" no longer holds.** The window's list is `list_stop`, and `refresh_stop` reads `Repo::stop()` first, which fails with `ReadFailed`. That has been the behaviour since row 6. I pinned it at the gitio level (`a_rebase_state_that_cannot_be_looked_at_fails_the_stop`) rather than keep a test of a property that is gone.
- **#1383 refusal shape:** a write whose version is below the session's first version answers `Error::StopMovedOn` → IPC `StopMovedOn` (one of the brief's options), not `ChangedOnDisk`. The window already reports `StopMovedOn` and lists again (`ui/problem.ts`).
  - `DiskVersion` now derives `PartialOrd`/`Ord`; its doc comment changed, so `bindings.ts` changed in that comment.
  - `MergeSession::open_after(cwd, previous)` and `highest_disk_version()` are new public methods.
- **Close ending change (the brief asked for it):** a held session whose stop git has left now counts the new stop and stages nothing; before, it settled the old stop's files.
- **Shared test helper:** session tests list through a new `tests/listing/mod.rs` (`listed`). It replaces the duplicate `listed` helpers in `operations.rs` and `remembered.rs`.
  - The 11 files' `x.refresh().unwrap()` → `listed(&mut x)` and `FileList` → `StopList` swaps were done with one `sed`.
  - The assertion `assert_eq!(&list.sides, session.side_names())` in `operations.rs` went with the accessor.
- **Mock window test helper:** `resolved_step` in `merge/tests.rs` now loads the file's version instead of sending 0, because versions after a move no longer restart at 0.
- **Docs I could not change (read-only):** `docs/architecture.md`, `.omp/skills/ipc-contract/SKILL.md` and `.omp/skills/project-map/SKILL.md` still describe `list_files`, `side_names`, `abort_merge`, `FileList.merging` and `merging.rs`. They need the same cutover.

**open_risks**
- **`just map-check` already fails** on this branch for things outside this slice: `fixtureOperations.ts`, `OperationBar.vue`, `StopView.vue`, `continuing.ts`, `currentStop.ts`, `emptyStop.ts`, `gitRun.ts`, `operationText.ts`, `scripts/operations-repo.sh`, and `list_stop`/`continue_operation`/`abort_operation` missing from `docs/architecture.md` and the ipc-contract skill. These need doc updates outside my ownership.
- **`src-tauri/src/merge.rs:155`:** after a worker panic, `MovedOn` takes the highest version from before the hand-over. That is right while abort and continue never settle; if a future worker settles, take the version from the worker's session.
- **`crates/session/src/writes.rs:139`:** a version above every version the session gave out, with no settle yet, still writes as before. Only versions below the first one are refused.
- **Mutation testing:** `just mutants` has not run. The three new Rust tests are meant to catch the mutations of `open_after`'s `+1`, the `<` check and the fold in `highest_disk_version`.

## Mutants (`just mutants be98230`)

Rust 27 - 5 caught, 22 unviable, 0 missed. TS changed lines (fixtureOperations.ts:42, :139): all killed.

## Boundary review (GitOpsRetireBoundary): pass, shoulds #1427-#1431

```json
{
  "verdict": "pass",
  "lens": "boundary-reviewer",
  "findings": [
    {
      "severity": "should",
      "file": "crates/session/src/lib.rs",
      "line": 43,
      "rule_id": null,
      "problem": "`Error::StopMovedOn` now has two meanings. It still means \"git has moved on since this session opened\" (abort/continue). `changed_on_disk` (writes.rs:139) now also raises it for a version left by an earlier session, and its `#[error]` text (\"git has moved on to another stop since this one was opened\") is wrong for that case: the refusing session was opened at the stop git is still at. As more callers come, a reader of the variant learns only the first meaning.",
      "fix": "Reword the `#[error]` text so it covers both cases, e.g. \"git has moved on from the stop this request was made at\"."
    },
    {
      "severity": "should",
      "file": "crates/session/src/open.rs",
      "line": 36,
      "rule_id": null,
      "problem": "The rule for the next disk version, `DiskVersion(x.0.saturating_add(1))`, is written twice: here in `open_after` and in `settled_as` (session.rs:333). Disk-version numbering now has two copies of one decision, and a third place that needs it would copy it again.",
      "fix": "Add `impl DiskVersion { pub(crate) fn next(self) -> DiskVersion }` in disk.rs and call it from both `open_after` and `settled_as`."
    },
    {
      "severity": "should",
      "file": "crates/session/src/session.rs",
      "line": 54,
      "rule_id": "CP2",
      "problem": "The new field doc \"Both panes' names, read once at open.\" repeats the type's own doc (side_names.rs:35, \"Both panes' names, read once when the session opens\"). Deleting it loses nothing, and the comment policy forbids restating a type. Nothing else gets harder.",
      "fix": "Delete the `///` line on `side_names`; the plain `SideNames` field needs no comment."
    },
    {
      "severity": "should",
      "file": "crates/gitio/tests/abort.rs",
      "line": 1,
      "rule_id": null,
      "problem": "The one test kept here now runs through `Repo::abort`, so `Repo::abort` has tests in two files: `abort.rs`, named after the retired `abort_merge`, and `abort_continue.rs`, the home its AGENTS.md names. `output_text` and the `stop().operation.unwrap()` step repeat `abort_continue.rs`'s `text` and `operation` helpers. Someone looking for what an abort proves has to find both files.",
      "fix": "Move `a_merge_abort_drops_resolutions_saves_and_merge_head_but_keeps_untracked_files` (with its `files()` fixture) into `abort_continue.rs` using its `text`/`operation` helpers, delete `abort.rs`, and fold its sentence in `crates/gitio/AGENTS.md` into the `tests/abort_continue.rs` sentence."
    },
    {
      "severity": "should",
      "file": "docs/architecture.md",
      "line": 250,
      "rule_id": "PM6",
      "problem": "These files were read-only for this slice (the implementer flagged them), but they still describe the retired surface. `docs/architecture.md:250-253,299,313-314,340-357` describes `rebase_in_progress`, `abort_merge`, `refresh()`, `list_files() -> FileList` and `side_names()`. `.omp/skills/ipc-contract/SKILL.md:39,46-47` lists `list_files`/`side_names`/`abort_merge`. `.omp/skills/project-map/SKILL.md:182` still names `FileList.merging` as where git's \"merging\" comes from. The plan §2 #53 row still says `refresh()` sits behind `list_files`. Agents reading these will look for code that no longer exists.",
      "fix": "Orchestrator: give these docs the same cutover. Replace the retired commands with `list_stop`/`abort_operation`, the state row with `Listing.operation`, and `refresh()` with `refresh_stop`. Add a disk-version baseline row (`first_disk_version`, `Merge::MovedOn.highest_disk_version`) to architecture §5.1."
    }
  ],
  "checked": [
    "Acceptance search re-run over crates, src-tauri and frontend/src: it hits only the `abortMerge` toolbar id and its stored decisions (toolbarButtons.ts, toolbarButtons.test.ts, MergeToolbar.vue) and the `FileList.vue` component (App.vue:7,70, ui/AGENTS.md:9). The component's name is outside this slice and not the IPC type, so that deviation is accepted. No `.refresh()` caller is left.",
    "Clean cutover with no alias, re-export or shim. The three commands are gone from `specta_builder` and bindings.ts; `Merge::abort`, `MergeSession::refresh`/`abort_merge`/`side_names()`, `FileList`, merging.rs, `Repo::abort_merge`/`rebase_in_progress`/`REBASE_STATE_DIRS` are removed. On the ipc side, `ChunkSource`, tauri.ts, fixture.ts, fixtureOperations.ts (`FixtureStops` Pick), domain.ts `FileList`/`toFileList` and the index.ts export are removed too.",
    "ipc/AGENTS.md names none of the removed items, so no edit was needed. crates/cli uses none of them (grep).",
    "Ownership: every file in the diffstat is inside `Owned`. In ui/, only the four test doubles changed, and only by removing methods.",
    "One owner of disk-version numbering. The session alone computes it: `open`/`open_after`/`open_from` (open.rs:29-57), `highest_disk_version` (session.rs:99-106), `FileState::disk_version(first)`, `settled_as`, and the `<` check in `changed_on_disk` (writes.rs:139). src-tauri only carries the value in `Merge::MovedOn.highest_disk_version`.",
    "Every `MovedOn` is built by the one `moved_on(&session)` (merge.rs:140), called from list_stop, the worker-panic path and Continue's Stopped. The only `open_after` caller is `Merge::list_stop`.",
    "Versions keep rising across stops: a chain of `MovedOn`s carries each session's highest, which is at least its first, so each new session starts above all earlier ones. A session with no files keeps `first` through the fold's start value.",
    "Accepted open risk (merge.rs:155): after a worker panic, the highest version is taken before the hand-over. Abort and continue never settle, so it is right today.",
    "Accepted open risk (writes.rs:139): a version above every one given out, with no settle yet, still writes as before. That behaviour is unchanged.",
    "Accepted deviation: #1383's refusal shape is `StopMovedOn`, which the brief allows (\"or a refusal\"). The window already handles it: `ui/problem.ts:111` lists again and problemText.ts:15 has the words. It does not contradict plan §2 #53/#88/#89, and no plan row says versions restart per stop.",
    "The #1383 test merge/tests.rs:253 settles to version 1, continues, lists step 2, and checks that `save_file` with version 1 gets `StopMovedOn`, the bytes and `ls-files -u` are unchanged, and the next load gives `disk_version` 2. The brief named version 0; version 1 also exercises `highest > first` and is accepted. The rule is tested only through src-tauri; test strength is the correctness lens's job.",
    "`held_merge_ending` (outcome.rs:90-99) now lists through `refresh_stop`, and on `MovedOn` it counts through `moved_on_ending`, as brief item 1 asks (#41's git view). Covered by `closing_a_session_git_moved_on_from_counts_the_new_stop_s_files_and_stages_nothing`.",
    "`SideNames::read` is a `pub(crate)` associated fn on the public type. The rename is accepted: the acceptance pattern `side_names\\(` also matched `read_side_names(`. The `name_or_warn` doc's reference to `read` still holds. `MergeSession.side_names` is a plain `SideNames`, and the Box comment and the `(*…).clone()` are gone.",
    "tests/listing/mod.rs follows the pattern of the other shared test modules (window/, samples/, every_kind/): a `//!` header, one pub fn, and `mod listing; use listing::listed;` in each user. It replaces the two duplicate `listed` helpers in operations.rs and remembered.rs, and session/AGENTS.md names it.",
    "Coverage moved, not lost. Rebase-merges with MERGE_HEAD not being a merge: gitio `rebase_merges_redoing_a_merge_is_a_rebase_with_redoing_merge_not_a_merge`. An abort git refuses: `abort_continue.rs::an_abort_git_refuses_is_git_s_text_and_changes_nothing`. An unreadable rebase state fails `Repo::stop()`: new gitio operations.rs:114. The \"never fails the list\" property has been gone since row 6, and that deviation is accepted. The three src-tauri abort tests now go through `abort_operation`, the commands tests through `list_stop`, and the frontend `listFiles` string-error test through `listStop`.",
    "#1391: src-tauri/AGENTS.md's mock_window entry says `ending()` calls `outcome::ending_when_git_is_done`, which matches mock_window.rs:71-72, and the outcome.rs entry names `ending_when_git_is_done` (outcome.rs:54).",
    "src-tauri/AGENTS.md no longer names `list_files`/`side_names`/`abort_merge`/`Merge::abort` and describes `MovedOn { root, highest_disk_version }`. session/AGENTS.md describes `first_disk_version`/`open_after`/`highest_disk_version` and `SideNames::read`. gitio/AGENTS.md names the remaining tests/abort.rs.",
    "Dependency direction is unchanged: src-tauri reaches only `yamt_session` (`DiskVersion`, `Refreshed`); no new crate edge and no new frontend import edge.",
    "Issue-number references in comments (#1383) follow the existing pattern in session/src/remembered.rs:232-290 and editor/AGENTS.md.",
    "Not reported: `FileState::disk_version(first)` takes the session's baseline as a parameter, so 5 call sites copy `self.first_disk_version` before borrowing. It reads plainly, and a per-file version field would change the shape of `Settled`.",
    "Not reported: the frontend test helper is copied (`listedBy` in fixture.test.ts next to `filesListed` in fixtureOperations.test.ts). It is a test helper, not a product rule."
  ]
}
```


## Correctness review (GitOpsRetireCorrectness): fail, block #1433; shoulds #1434, #1435

**Verdict: fail.** One finding is a `block`; there are also two `should` findings. The #1383 version logic is correct: a stale write from an earlier stop cannot land on the next stop's file. The block is a test that would not notice a wrong close count.

```json
{
  "verdict": "fail",
  "lens": "correctness-reviewer",
  "findings": [
    {
      "severity": "block",
      "file": "src-tauri/src/outcome.rs",
      "line": 227,
      "rule_id": null,
      "problem": "The test `closing_a_session_git_moved_on_from_counts_the_new_stop_s_files_and_stages_nothing` cannot tell the old stop's count from the new stop's: both stops have the single unresolved file `steps.txt`, and `refresh_stop` returns `MovedOn` before it settles anything. So if the moved-on arm at line 93 counted the old session (`Ok(Refreshed::MovedOn) => unresolved_ending(session)`), the test would still see \"1 of 1 files still unresolved\" and an unchanged `ls-files -u`, and pass. Yet that bug changes the exit status git callers act on: a user who resolved every file in yamt, then continued in a terminal into a new conflict, would close with exit 0 and no message. This test is the only evidence for brief Change 1's moved-on close ending.",
      "fix": "In that test, resolve the step-1 file through the session (`session.finish(STEP_TWO_FILE, \"resolved\\n\", DiskVersion(0))`) instead of `fs::write` + `git add`, then run `git rebase --continue`. The old session then counts 0 unresolved and the new stop counts 1, so the assertion `\"1 of 1 files still unresolved\"` only passes when the new stop is counted."
    },
    {
      "severity": "should",
      "file": "crates/session/src/session.rs",
      "line": 101,
      "rule_id": null,
      "problem": "Two parts of `highest_disk_version` have no test. (1) It must take the maximum over every file: the only test with a raised version (merge/tests.rs:253) has one file, so taking just the first or last file's version would pass. (2) The fold must start at `first`: no test chains through a stop without conflicts, so `.fold(DiskVersion(0), max)` would pass, letting versions after an empty stop restart at 1 and repeat an earlier stop's versions. cargo-mutants generated neither change, nor the `+1` in `open_after` (it only replaced whole bodies with `Default::default()`, which is unviable for `DiskVersion`). As more stop kinds get opened, the rule \"versions never repeat within a run\" rests on code nothing checks.",
      "fix": "Add a session test in `crates/session/tests`: open with two files, settle only the second one twice, then assert `highest_disk_version() == DiskVersion(2)`. Also assert that `open_after(root, v).highest_disk_version() == DiskVersion(v.0 + 1)` for a stop whose unmerged list is empty (`edit_stop_repo`)."
    },
    {
      "severity": "should",
      "file": "src-tauri/src/merge.rs",
      "line": 166,
      "rule_id": null,
      "problem": "This gap predates the patch. After a worker panic, the window gets `Git`, and `continuing.ts` `refused` lists again. `list_stop` then opens the new stop and answers `Files`, so `nextStop` never runs and the old stop's views stay open. Before this patch, their writes with version 0 landed on the new stop's same-path file. Now every Save, Mark resolved, Take or Reset from them answers `StopMovedOn` (#1383), and `reportFailure` lists again, gets `Files` again, and stays stuck. Nothing is written, but the window never reaches the new stop. As more Rust paths answer `StopMovedOn` to a window stop that is still live, each will loop the same way, because the window's recovery expects a list that says `MovedOn`.",
      "fix": "Orchestrator: open a row so that `Listing::Files` carries the stop's identity (`Stop::id()`, already in gitio) and `ui/listing.ts` `refreshFiles` calls `nextStop` when that identity differs from the shown stop's. Until then, `on_worker` could answer `IpcError::StopMovedOn` after a panic so Continue's `refused` goes to `nextStop`."
    }
  ],
  "checked": [
    "#1383 inside the app: `changed_on_disk` is the first step of every write (writes.rs:28,56,72,99). Every version the window can hold comes from `FileState::disk_version(first)`, which is `settled.version` or `first`, and goes up by +1 per settle. So every version an old session gave out is ≤ `highest_disk_version()` < the next session's `first`, and `disk_version < first` refuses it with `StopMovedOn` before any look or write.",
    "The only place a new session is created mid-run is `Merge::list_stop` from `MovedOn` → `open_after(root, highest)` (merge.rs:91). If `open_after` fails, the state stays `MovedOn` with the same `highest`. A new session that immediately lists `MovedOn` hands on its own `first` (old + 1), so versions keep rising across a chain of stops.",
    "merge.rs:155, `after_a_panic` taken before the hand-over: correct. `abort_operation` and `continue_operation` (operation.rs:119-145) never settle, so the version cannot rise on the worker. A panicked worker sends no reply, so no version it handled reaches the window. The `Stopped` arm recomputes `moved_on(&session)` after the worker anyway.",
    "Window reload paths: `nextStop` drops the stop synchronously in `clearStop` (stops.ts:34-50) before it awaits anything. Every write and reload goes through `landed(stop, …)`, so an old stop's late Save or its `StopMovedOn` answer changes nothing (`saving.test.ts:684-690`, `aborting.test.ts:172-176`). A `listStop` racing a `MovedOn` list reads `target.stop` after its await (listing.ts), so its disk changes land under the new stop. No path sends an old version against a new-stop view, except the worker-panic gap in finding 3.",
    "Not reported, outside this slice: writes to a session still held, made after git moved on in a terminal but before the next list, do not re-read the stop. The look before the write catches git's rewrite of an unmerged path; this behaviour is unchanged by this patch (non-goal: no behaviour change).",
    "Mutants: `<` → `<=`, `==` and `>` at writes.rs:139 were generated and caught. With `<=` or `==`, any fresh-session write at version 0 is refused.",
    "The `+1` removed from `open_after`: not generated, because cargo-mutants does not mutate the argument of `saturating_add(1)`. The #1383 test would catch it: old version 1 == first 1 passes the check, the new file has no `Settled` and the look finds nothing, so the Save writes (`Written`, not `StopMovedOn`), and `disk_version` is 1, not 2. The brief's version-0 variant would not have caught it; the test's version 1 does.",
    "The fold in `highest_disk_version`: not generated. A `max` → `min` swap or always returning `first` would be caught by the #1383 test (new first 1, Save lands). Taking only the first or last file, or starting the fold at `DiskVersion(0)`, would not be caught; see finding 2.",
    "Deleting the feature: before this patch (`open` for the new stop, first 0), the #1383 test's Save with version 1 would answer `Written`, so the test fails. That makes it a real proof of #1383.",
    "`held_merge_ending` (outcome.rs:90-100): on `Files` it counts after `refresh_stop`'s settle, as `refresh` did. On `MovedOn` it opens a new session only to count (`MergeSession::open`, nothing settled). On `Err` it warns and counts the held statuses. The old settle-at-close behaviour is caught by the new test's `ls-files -u` assertion (an edited file without markers would have been staged).",
    "`refresh_stop` at an unchanged stop does exactly what `refresh` did (`settle_and_mark`, then `files()`). The 11 test files moved to `listing::listed` panic on `MovedOn`, so none of them silently lists a stop git has left.",
    "Coverage moved: `merging` for merge/squash/rebase/cherry-pick/revert → `each_operation_s_view_names_what_it_applies` (operations.rs:197, incl. SquashMerge). Rebase-merges with `MERGE_HEAD` → gitio operations.rs `rebase_merges_redoing_a_merge_is_a_rebase_with_redoing_merge_not_a_merge`. Aborted outside → `a_rebase_aborted_in_a_terminal_lists_git_s_view_without_an_operation`, which exercises the same `has_moved_on_to` rule (operation none = not moved on).",
    "Coverage moved, continued: `abort_merge` runs git's abort → gitio abort.rs through `Repo::abort` plus `merge/tests.rs` `after_an_abort_every_merge_command_answers_merge_aborted_and_writes_nothing`. The abort refusal → `abort_continue.rs:125`, which checks the repository state, `ls-files -s` and that the operation is still Merge. The unreadable rebase state → gitio operations.rs `a_rebase_state_that_cannot_be_looked_at_fails_the_stop`; the deviation is accepted, since row 6 already made the window list through `list_stop`.",
    "Migrated commands tests (commands.rs:203-246) assert the same files, disk changes and names through `list_stop`. The `merging: true` assertion is replaced by `listed[\"operation\"][\"kind\"] == \"Merge\"` in the abort-refusal test (merge/tests.rs:117).",
    "Window `DiskVersion` handling: `toDiskVersion` only validates the number (domain.ts:201). No code outside the tests assumes a version of 0, so versions starting above 0 cross the IPC unchanged.",
    "Risk register: RK24 (owner writes.rs) — its proving tests are untouched, and the new check runs before the look. RK1/RK17/RK23 owners are not touched in behaviour.",
    "No test was run; every claim above comes from reading the code and tests."
  ]
}
```
