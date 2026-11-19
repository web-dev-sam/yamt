# Slice range-reviewed-core — the crate `yamt-reviewed` and `yamt-range`'s accessors for it

Feature "Range reviewed" slice 1 of 4 (then `app`, `store`, `view`, `verify`). Rules: `docs/slices/request-range-reviewed.md`
(rules 1–7, read it whole). Design: `docs/slices/briefs/range-reviewed-design.md` option A (§0 facts, §1, §2 A, §4) — read
§1 and §2 A before starting. Plan rows: #104, #105, #107, #117 (the stored-file rule), and the proposed #195. Base `b42a6c6b`.

Facts (given, from the design §0):

- `RangeSpec { text, left, dots, right }`, typed names kept, an empty side `"HEAD"` (`crates/range/src/spec.rs:6-11,71-77`);
  `Dots { Two, Three }` is `pub(crate)` (`spec.rs:14`). `Range` holds its `Resolved` (with the `Repo`) privately
  (`open.rs:15-34`); `FileAt`/`BlobAt` + `BlobAt::kind()` (`entries.rs:13-40`); `load_file` = `decide` → `read_sides` →
  `decoded` → `compare` (`load.rs:14-29`); `repo_key`, `fnv1a_64` private in `lock.rs:107-131`; `pair_folders` lists every
  folder under `range/<repo key>/` (`lock.rs:71-79`).
- `Repo::symbolic_full_name(name) -> Result<Option<Vec<u8>>>`: `refs/heads/x` for a branch and for `HEAD` on a branch,
  `HEAD` when detached, `None` for a commit id or `HEAD~2` (`crates/gitio/src/names.rs:56-65`); `Repo::commit_named`
  (`repo.rs:73`), `Repo::common_dir` (`repo.rs:107`).
- `yamt_merge_core::{compare, Difference, MAX_TEXT_BYTES}` (`merge-core/src/compare.rs:22,62`, `lib.rs:26`: 8 MiB).
- Stored-file pattern: `crates/review/src/thread_file.rs` (`format`, `NewerFormat`, `Broken` with serde's line and column,
  temp file + rename, a leftover temp file ignored, nothing written on a refusal) and `crates/compare/src/{index,files}.rs`.
- `std::fs::File::lock` (blocking, std ≥ 1.89; toolchain 1.99, `rust-toolchain.toml:2`) — no new dependency.
- New crate membership (precedent `docs/slices/briefs/3.RV-threads-store.md:19-22`): own the path dependency line
  `yamt-reviewed = { path = "../crates/reviewed" }` in `src-tauri/Cargo.toml`; the orchestrator adds `"crates/reviewed"` to
  the root `members` and `yamt-reviewed = { path = "crates/reviewed" }` to `[workspace.dependencies]` (root `Cargo.toml` is
  shared: report the two lines in `deviations_from_brief`). Workspace deps: `serde`, `serde_json`, `specta`, `thiserror`,
  `tracing`; dev `tempfile`, `yamt-conflict-repo`.

## Target

Owned: `crates/range/**`, `crates/reviewed/**` (new: `Cargo.toml`, `AGENTS.md`, `src/{lib,review_of,stored,store,since}.rs`
or a split of your choice, `tests/reviewed.rs`), `src-tauri/Cargo.toml` (only the path dependency line),
`scripts/arch-check.sh`.

Read-only: everything else.

Non-goals: Tauri commands, CLI arguments, merge requests' `RangeToOpen` (slice `app`); anything in `frontend/`; threads.

## Contract (fixed; you may add, never change)

```rust
// crates/range — new pub items (re-exported from lib.rs); its one job stays "read a range"
pub use crate::spec::Dots;                       // now pub: Two, Three (Clone, Copy, Debug, PartialEq, Eq)
pub fn fnv1a_64(bytes: &[u8]) -> u64;            // lock.rs's function, unchanged, now pub (two users: repo key, review folder)

/// One side of the range as a review remembers it (plan §2 #195, request rule 4).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SideName {
    /// The full ref `symbolic_full_name` gives when it starts with `refs/` (`HEAD` on a branch → that branch).
    Ref { full_name: String },
    /// Otherwise (a commit id, a detached HEAD, `HEAD~2`): the commit the typed name names now.
    Commit { id: Oid },
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SideNames { pub left: SideName, pub dots: Dots, pub right: SideName }   // the typed left, never the merge base

/// A listed file's side as git lists it: the object id (a blob, or a gitlink's commit) and its kind.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SideObject { pub id: Oid, pub kind: RangeEntryKind }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FileSides { pub left: Option<SideObject>, pub right: Option<SideObject> }  // None: no such side

impl Range {
    pub fn side_names(&self) -> Result<SideNames>;                       // git asked once per call
    pub fn repo_key(&self) -> Result<OsString>;                          // the same key PairLock::take uses (#107)
    pub fn sides(&self, file: RangeFileId) -> Result<FileSides>;         // UnknownFile past the list
    /// The right column's text exactly as `load` shows it; `None` when `load` answers anything but `Texts`.
    /// Reads both sides through `decide` / `read_sides` / `decoded` (the one rule), never runs `compare`.
    pub fn right_text(&self, file: RangeFileId) -> Result<Option<String>>;
}
```

```rust
// crates/reviewed (package yamt-reviewed; #![forbid(unsafe_code)]); depends on yamt-range, yamt-gitio (Oid only),
// yamt-merge-core (compare) among yamt-*, never tauri.

/// What a window's marks belong to (rule 4).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ReviewOf {
    Range(SideNames),
    MergeRequest { project: String, iid: u32 },
}
impl ReviewOf {
    /// `range ref:refs/heads/dev...ref:refs/heads/feature-x`, `range commit:<hex>..ref:refs/heads/x`,
    /// `merge-request group/project!12`: the folder name is `format!("{:016x}", fnv1a_64(key_text))`.
    pub fn key_text(&self) -> String;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ReviewMark { Reviewed, ChangedSinceReview }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct FileReview { pub file: RangeFileId, pub mark: ReviewMark }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SinceReview {
    /// The right side's text at the mark (left column) against today's right side (right column).
    Texts { reviewed: String, current: String, differences: Vec<Difference> },
    /// Either text is missing: the mark kept none (not text then) or today's file is not text.
    NoText,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    ReadFailed { path: PathBuf, message: String },
    Broken { path: PathBuf, message: String },        // serde's line and column; also `review` naming another review
    NewerFormat { path: PathBuf, format: u32 },        // "written by a newer yamt (format N)", by name
    WriteFailed { path: PathBuf, message: String },
    UnknownFile { file: RangeFileId },
    Range(#[from] yamt_range::Error),
}

pub struct ReviewedStore { /* private: folder, review, per-file state for this range */ }
impl ReviewedStore {
    /// `<reviewed_dir>/<range.repo_key()>/<16 hex>/`: under its lock, reads `reviewed.json` (missing = no marks, nothing
    /// written), refuses newer/broken (file untouched), drops marks on paths `range` does not list and sweeps
    /// `texts/` files no mark names (writing only when something was dropped or swept), then classifies each listed file.
    pub fn open(reviewed_dir: &Path, review: ReviewOf, range: &Range) -> Result<ReviewedStore, Error>;
    /// Marked files in list order; a file not in it is unreviewed.
    pub fn marks(&self) -> Vec<FileReview>;
    /// Records the file's current two sides (and its right text in `texts/<right id>` when `right_text` is `Some`
    /// and the file is missing there); the file becomes `Reviewed`.
    pub fn mark(&mut self, range: &Range, file: RangeFileId) -> Result<(), Error>;
    /// Forgets the file's mark ("Unmark" and "Review from start"); a file with no mark writes nothing.
    pub fn unmark(&mut self, range: &Range, file: RangeFileId) -> Result<(), Error>;
    /// For a `ChangedSinceReview` file (any marked file answers the same way): reviewed text = `""` when the mark's right
    /// side was `null` (deleted), `texts/<id>` when `keptText`, else `NoText`; current = `range.right_text(file)`.
    pub fn since_review(&self, range: &Range, file: RangeFileId) -> Result<SinceReview, Error>;
}
```

`reviewed.json` format 1 is exactly the design §2 A JSON (`format`, `review` with `kind` `range` | `mergeRequest`, sides
`{ kind: "ref", name }` | `{ kind: "commit", id }`, `dots` `two` | `three`; `marks[]` sorted by path with `path`, `left`,
`right` = `{ id, kind }` | `null`, `kind` ∈ `file | executable | link | submodule`, `keptText`). Each write: take
`<folder>/lock` with `File::lock`, re-read `reviewed.json`, apply this one change by path, write temp + rename (text file
first), release; a failed write changes nothing in memory. The lock is never held between calls.

## Change

1. `crates/range`: `Dots` pub; `fnv1a_64` pub; new `side_names.rs` (`SideName`, `SideNames`, `Range::side_names` — for each
   typed side: `symbolic_full_name`; UTF-8 starting with `refs/` → `Ref`, else `Commit` from `commit_named`, an unknown name
   → `UnknownName`); `Range::repo_key` (through `lock.rs`'s `repo_key` and the repo's common dir); `Range::sides` (from
   `FileAt`); `Range::right_text` (`decide` → `None` on `Some(_)`; else `read_sides` + `decoded` → right on `Texts`).
   Update `crates/range/AGENTS.md`.
2. `crates/reviewed`: the contract above; `AGENTS.md` naming its one job, its folder, its format and its refusals.
3. `src-tauri/Cargo.toml`: the path dependency line. `scripts/arch-check.sh`: `yamt-reviewed` depends on `yamt-range`,
   `yamt-gitio` and `yamt-merge-core` only among `yamt-*`, never on tauri (its own block, as `yamt-review`'s,
   `scripts/arch-check.sh:58-62`); `yamt-app` may depend on `yamt-reviewed` (line 88's list and its message).
4. Measure: on a `scripts/range-repo.sh` repository (`main...feature`), mark every file through a test or a throwaway
   `cargo test -- --ignored` run, report `du -sb` of the review folder and the largest `reviewed.json` write time in
   `open_risks` (design §2 A asks for it). Delete the throwaway.

## Acceptance

- `crates/range` unit tests: `side_names_follow_the_branch_head_names_and_keep_a_commit_id` (`dev...HEAD` on `feature-x`
  → `Ref refs/heads/dev`, `Three`, `Ref refs/heads/feature-x`; `main..<abbrev id>` → `Commit <full id>`),
  `a_detached_head_and_an_expression_are_the_commit_they_name_now`,
  `right_text_is_the_right_column_load_shows_and_none_when_load_shows_no_texts` (text, binary, too large, submodule,
  deleted → `Some("")`), `sides_name_each_side_s_object_and_kind_and_none_for_a_missing_side`,
  `repo_key_is_the_pair_lock_s_repository_folder`.
- `crates/reviewed/tests/reviewed.rs` — every name of design §4 "core" (from `the_review_key_text_…` to
  `the_reviewed_folder_is_not_a_pair_folder`), with real temp repositories (`yamt-conflict-repo`) where a new commit on
  the right branch, a moved left branch, a rename and a deletion are made with git; `two_stores_on_one_review_keep_both_changes`
  opens two stores on two commit pairs of one review, marks a different file in each, reopens: both marked.
  `the_folder_name_is_the_pinned_fnv_of_the_key_text` pins one vector.
- Commands: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo test -p yamt-range -p yamt-reviewed`, `just arch-check` (also its failing path: a temporary `tauri` dep in
  `yamt-reviewed` fails it), `just mutants HEAD` (SP11).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK49; the proposed RK79 in the design §2 A
"Risks"), `skill://principles`. Read `crates/review/src/thread_file.rs` and `crates/compare/src/{index,files}.rs` first.
