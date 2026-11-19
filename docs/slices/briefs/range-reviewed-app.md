# Slice range-reviewed-app — the range window's reviewed commands, `--review-of`, and a merge request's marks

Feature "Range reviewed" slice 2 of 4; needs `range-reviewed-core` committed (crate `yamt-reviewed`, `yamt-range`'s
accessors). Rules: `docs/slices/request-range-reviewed.md` rules 4–7. Design: `docs/slices/briefs/range-reviewed-design.md`
option A, "Merge requests" and "Refusals and errors". Plan rows: #107, #117 (refusal before any window), #144, proposed #195.

Facts (given):

- `manage_range_in` takes the pair lock, lists, opens `ThreadStore`, manages `RangeState { range, threads, sending, _lock }`
  (`src-tauri/src/range.rs:19-69`); `app_folder` = `<data_dir>/yamt`; `RANGE_FOLDER` (`range.rs:17,71-73`); commands are
  registered in `src-tauri/src/commands.rs:55-57`; async commands go through `blocking_reply` (`ipc_error.rs:74-84`,
  `range.rs:86-104`).
- `Invocation::Range { spec, repo, ai, start }` (`args.rs:46-51`), parsed in `args.rs:111-153`, `USAGE` `args.rs:6-28`;
  matched in `lib.rs:67-72` → `range::run_range(repo, spec, ai, start)` (`range.rs:30-42`).
- `RangeToOpen { root, spec }` (`crates/merge-requests/src/lib.rs:202-209`); `prepare_open` has `full_path` and `iid`
  (`crates/merge-requests/src/open.rs:52-71`); `start_range`/`range_arguments` (`second_window.rs:11-16,44-55`); the RK42
  round-trip test `second_window.rs:117-134`; `crates/merge-requests/tests/open.rs:13,61` builds `RangeToOpen`.
  `MergeRequestIid(pub u32)` (`lib.rs:108`).
- `IpcError` variants (`ipc_error.rs:8-72`); the `From<yamt_review::Error>` mapping is the pattern (`ipc_error.rs:178-199`).
- From `range-reviewed-core` (its Contract, fixed): `ReviewOf { Range(SideNames) | MergeRequest { project, iid } }`,
  `ReviewedStore::{open, marks, mark, unmark, since_review}`, `FileReview`, `ReviewMark`, `SinceReview`,
  `yamt_reviewed::Error`, `Range::side_names()`.

## Target

Owned: `src-tauri/src/**`, `src-tauri/AGENTS.md`, `crates/merge-requests/src/lib.rs`, `crates/merge-requests/src/open.rs`,
`crates/merge-requests/tests/open.rs`, `crates/merge-requests/AGENTS.md`.

Read-only: everything else; `frontend/src/ipc/bindings.ts` is generated: run `just bindings` for your checks, the
orchestrator regenerates and commits it (never in your patch).

Non-goals: the window (`frontend/**`); the crate's rules (slice `core`); posting anything to GitLab.

## Contract (fixed; you may add, never change)

```rust
// crates/merge-requests/src/lib.rs
pub struct RangeToOpen {
    pub root: PathBuf,
    pub spec: String,
    /// The project's full path (`group/sub/project`) and the merge request: the marks' review (plan §2 #195).
    pub project: String,
    pub iid: MergeRequestIid,
}

// src-tauri/src/args.rs
pub(crate) enum MarksOf { SideNames, MergeRequest { project: String, iid: u32 } }
Invocation::Range { spec: RangeSpec, repo: PathBuf, ai: Ai, start: StartScreen, marks: MarksOf }
// `--review-of=<project>!<iid>`: split at the last `!`; project non-empty; iid a u32 > 0.
// Refusals (one line, exit 2): "--review-of=<text>: give <group/project>!<iid>",
// "--review-of goes with --diff=<range>" (with --diff, a merge, or none).
// USAGE gains: "  --review-of=<project>!<iid>  with --diff=<range>: remember Reviewed marks for this merge request
//               (the merge-request page passes it)"

// src-tauri/src/second_window.rs: range_arguments adds format!("--review-of={}!{}", range.project, range.iid.0)

// src-tauri/src/range.rs
const REVIEWED_FOLDER: &str = "reviewed";              // <data_dir>/yamt/reviewed/
pub(crate) struct RangeState { …, pub(crate) reviewed: Mutex<ReviewedStore>, … }
// run_range(repo, spec, ai, start, marks); manage_range_in builds ReviewOf (MarksOf::SideNames → ReviewOf::Range(range.side_names()?),
// MarksOf::MergeRequest → ReviewOf::MergeRequest) and opens the store after listing; any error → the window's
// one-line refusal before any window, exit 2 (as ThreadStore::open's).

// src-tauri/src/reviewed.rs (new), registered in commands.rs
#[tauri::command] #[specta::specta] fn list_reviewed(state: State<'_, RangeState>) -> Result<Vec<FileReview>, IpcError>;
#[tauri::command] #[specta::specta] async fn mark_reviewed<R: Runtime>(window: WebviewWindow<R>, file: RangeFileId) -> Result<(), IpcError>;
#[tauri::command] #[specta::specta] async fn unmark_reviewed<R: Runtime>(window: WebviewWindow<R>, file: RangeFileId) -> Result<(), IpcError>;
#[tauri::command] #[specta::specta] async fn load_since_review<R: Runtime>(window: WebviewWindow<R>, file: RangeFileId) -> Result<SinceReview, IpcError>;

// src-tauri/src/ipc_error.rs: impl From<yamt_reviewed::Error> for IpcError — existing variants only:
// WriteFailed → WriteFailed { path, message }; UnknownFile → UnknownRangeFile; ReadFailed → ReadFailed;
// Broken | NewerFormat → ReadFailed { path, message } (as yamt_compare's, ipc_error.rs:135-147); Range(e) → From<yamt_range::Error>.
```

Generated TS (after `just bindings`): `commands.listReviewed()`, `markReviewed(file)`, `unmarkReviewed(file)`,
`loadSinceReview(file)`; `FileReview { file: RangeFileId; mark: ReviewMark }`, `ReviewMark = "reviewed" |
"changedSinceReview"`, `SinceReview = { kind: "texts"; reviewed: string; current: string; differences: Difference[] } |
{ kind: "noText" }`. The `store` slice codes against these names: if specta names differ, report it.

## Change

1. `crates/merge-requests`: `RangeToOpen` gains `project`, `iid`; `prepare_open` fills them from `full_path` and `iid`;
   `tests/open.rs` asserts them; `AGENTS.md`'s `RangeToOpen` line.
2. `args.rs`: `MarksOf`, `--review-of`, `USAGE`, the refusals; `lib.rs` passes `marks`; `second_window.rs` adds the flag.
3. `range.rs`: `REVIEWED_FOLDER`, the store opened in `manage_range_in` (after `resolved.list()`; the pair lock still first),
   `RangeState.reviewed`; `reviewed.rs`: the four commands (mark/unmark/since through `blocking_reply`, the store locked
   only inside the worker); `commands.rs` registers them; `ipc_error.rs` the mapping. `src-tauri/AGENTS.md`.
4. `just bindings` locally; `just bindings-check` passes on your tree.

## Acceptance

- `args.rs` tests: `review_of_with_a_range_names_the_merge_request_s_marks`, `review_of_without_a_range_or_malformed_is_refused`
  (no `!`, empty project, iid `0`, `x`), `USAGE` names `--review-of`.
- `second_window.rs`: the RK42 test extended — `range_arguments` with `project`/`iid` parses back to
  `Invocation::Range { marks: MarksOf::MergeRequest { .. }, .. }` for both `Ai` values.
- `crates/merge-requests/tests/open.rs`: an opened merge request answers `project` = the logged-in project's full path, `iid`.
- `src-tauri/src/reviewed/tests.rs` (or `range.rs` tests) through `invoke_on`: `mark_reviewed_then_list_reviewed_answers_it`,
  `a_window_on_a_new_commit_of_the_same_branch_keeps_the_mark` (same data folder, commit on the right branch, reopen),
  `a_changed_right_side_lists_changed_since_review_and_load_since_review_answers_texts`,
  `two_merge_request_reviews_do_not_share_marks` (same commits, `--review-of` !1 vs !2),
  `unmark_reviewed_forgets`, `an_unknown_file_answers_unknown_range_file`,
  `a_newer_reviewed_file_refuses_the_range_before_any_window` (`manage_range_in` errs, the file untouched).
- Commands: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test -p yamt-app
  -p yamt-merge-requests`, `just bindings-check`, `just arch-check`, `just mutants HEAD`.

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK40, RK42, RK49), `skill://verification`.
