# Slice MrConflictsLocal — the crate `yamt-local-merge`: start, record, restore, push

Feature: merge-request conflicts (request `docs/slices/request-mr-conflicts.md` rules 4–10; design
`docs/slices/briefs/mr-conflicts-design.md` option A — §3 "Option A", §4.1, §4.2, §4.3, §4.4, §4.5 first two bullets,
§4.6 "yamt-local-merge", §4.7 "local-merge", §4.8 RK43–RK47). Starts when `MrConflictsGit` is committed. Before it
starts the
orchestrator adds `crates/local-merge` to the root `Cargo.toml` members and `yamt-local-merge = { path =
"crates/local-merge" }` to its workspace dependencies (shared paths).

## Target

Owned: `crates/local-merge/**` (new: `Cargo.toml`, `AGENTS.md`, `src/{lib.rs,record.rs,start.rs,restore.rs,push.rs}`,
`tests/**`), `scripts/mr-conflict-repo.sh` (new), `scripts/arch-check.sh`.

Read-only: everything else; `crates/gitio/**` as `MrConflictsGit` left it. Architecture §7/§3, PM1's text, the
project map and the risk register: lines in `deviations_from_brief` (the docs keeper applies them).

Non-goals: GitLab (no glab, no merge-requests dependency), commands, starting a window, words (the window's), a
merge that is not a merge request's.

## Contract

Fixed: design §4.6 "yamt-local-merge" exactly (types with their derives and serde attributes — `Refusal::AlreadyMerging
{ iid: Option<u32> }`, `LocalMerge::{Free, Merging { iid: u32, window_open: bool }}`, `WindowClaim` — and the
functions and methods `start`, `local_merge`, `find_live`, `claim_window`, `window_is_open`, `LiveMerge::{view, iid,
restore, committed}`, `push`). Dependencies: `yamt-gitio`, `serde`, `serde_json`, `specta`, `thiserror`, `tracing`;
dev: `tempfile`, `yamt-conflict-repo` (hermetic `git_ok`). No other crate.

The record (private types, serde): `<git dir>/yamt-merge-request.json` via `Repo::git_path("yamt-merge-request.json")`:

```json
{ "format": 1, "iid": 21, "remote": "origin", "branch": "feature/due-dates", "target": "main",
  "returnTo": { "kind": "branch", "name": "develop" } | { "kind": "detached", "commit": "<full oid>" },
  "branchBefore": { "kind": "created" } | { "kind": "movedFrom", "commit": "<full oid>" } | { "kind": "unchanged" },
  "head": "<full oid>", "merging": "<full oid>" }
```

Written to `yamt-merge-request.json.tmp`, `File::sync_all`, renamed over the record. A `format` above 1 or unparsable
JSON is unreadable: `start` refuses `RecordUnreadable { path, message }` and leaves the file; `find_live` and
`local_merge` treat it as none with a warning. The start lock: `<git dir>/yamt-merge-request.lock`, `File::try_lock`
(std), held for the whole of `start`; would block → `AlreadyMerging { iid: None }`; a live record → `AlreadyMerging {
iid: Some(record.iid) }`.

The window lock (request rule 9, design §4.2 last paragraph, §4.5): `<git dir>/yamt-merge-window.lock`.
`claim_window` opens it (creating it) and calls `try_lock` every 50 ms for up to 1 s; acquired → `Some(WindowClaim)`
holding the `File`; still held elsewhere → `None`. `window_is_open` opens it and calls `try_lock` once: acquired →
released at once (drop), `false`; would block → `true`; any other error → `false` with a warning. The file is never
removed (removing a locked path would let a second process lock a new file of the same name).

`is_live(record, stop, current_branch)` (pure): `stop.operation == Some(Operation::Merge { merging })` with
`merging.as_str() == record.merging`, `stop.head` equal to `record.head`, and `current_branch == Some(record.branch
bytes)`.

**`start`** — the thirteen steps of design §4.2 in that order, each refusal with nothing changed before step 11
(`AlreadyMerging` from the lock or a live record; a stale record removed; `Busy` for any `stop()` operation;
`UncommittedChanges`; `FetchFailed`; `LocalAhead`; `AlreadyContains`; `GitRefused { message, left: [] }` for a refused
checkout, the record removed; after the checkout a failure runs `restore` and answers `GitRefused { message, left }`).
`message` is git's first stderr line (`yamt_gitio::first_line`) or, for `merge_no_commit`, the first line of its output.
`Started.conflicts` = `!repo.unmerged()?.is_empty()` after the merge.

**`restore`** — design §4.3 "Abort" steps 1–3 (return while HEAD is the branch at `record.head`; created branch deleted
/ moved branch moved back only while at `record.head`, `reset_keep` when it is checked out; leftovers for the rest;
record removed). Used by `LiveMerge::restore` and by `start`'s failure path.

**`local_merge`**: `Merging { iid: record.iid, window_open: window_is_open(root) }` iff a live record; any error →
`Free` with a warning. **`committed`**: removes the record,
returns `PushOffer { remote, branch }`. **`push`**: `push_branch(remote, branch, PUSH_TIMEOUT)` → `Pushed` / `Failed {
message }`.

`MergeView` from the record: `return_to: None` when `returnTo` is the branch itself; ids as their first 7 characters.

**`scripts/mr-conflict-repo.sh <dir>`** (bash, as `scripts/range-repo.sh`: `git-sandbox.sh`, `require_empty_dir`,
`isolate_git_config`, fixed names and dates so ids never change): `main` holds a small project (`src/board/card.ts`,
`README.md`); `develop` branches from it with one more commit (`docs/develop.md`) and is checked out at the end;
`feature/due-dates` branches from `main`'s first commit and, in two commits (so a test can put a local branch one
commit behind), adds a new file and changes the same lines of `src/board/card.ts` as a later `main` commit does (a
conflict); `feature/clean` changes only a file `main` never touches;
`feature/merged` branches from `main`'s tip; the fake GitLab is the bare `<dir>/.git/fake-gitlab.git` holding `main`,
`develop` and the three `feature/*` branches; the checkout keeps only `main` and `develop` as local branches, has no
`refs/remotes`, and its `origin` is `https://gitlab.example/taskboard/taskboard.git` through `url.<bare>.insteadOf`
(range-repo.sh:102-123). Prints the compare-window command that shows the page. Names fixed by this contract (used by
`tests/glab/mr-conflicts/` and the real-app steps): `main`, `develop`, `feature/due-dates`, `feature/clean`,
`feature/merged`, `origin`.

**`scripts/arch-check.sh`**: a block for `yamt-local-merge` (only `yamt-(local-merge|gitio)` among `yamt-*`, no
`tauri`), as the merge-requests block (`arch-check.sh:72-77`); `local-merge` added to yamt-app's allowed list
(`arch-check.sh:79-80`).

## Change

1. The crate (`lib.rs` types and functions, `record.rs` read/write/remove/lock/`is_live`, `start.rs`, `restore.rs`,
   `push.rs`), `AGENTS.md` as the other crates'.
2. The script; `arch-check.sh`.
3. Tests (below), with a shared `tests/common/mod.rs` that runs the script into a tempdir and offers `git` helpers.

## Acceptance

- The tests of design §4.7 "local-merge", by those names (rule 4: five refusals each asserting HEAD, every
  `refs/heads/*`, `git status --porcelain=v1` and the absence of the record before = after; rule 5: created and
  tracking (`branch.feature/due-dates.remote`/`.merge`), fast-forward, stale-clean, overwritten-untracked put back;
  rule 7: abort after a restart (a fresh `find_live` on a new `Repo`), moved back, detached return, branch kept, HEAD
  moved; rule 8: live record (`iid: Some(21)`), lock held by another open file handle (`iid: None`), `local_merge`,
  stale dropped, unreadable kept; rule 9: `local_merge` names the iid and `window_open` follows a `WindowClaim` held
  through another open file handle, a second claim fails while the first is held and succeeds once it is dropped,
  `window_is_open` probing in a loop on another thread never makes a concurrent `claim_window` give up;
  rule 6: push accepted (the bare repo's branch is the merge commit), rejected (a commit added to the bare branch first:
  `Failed` with "[rejected]", bare unchanged, local commit kept)); `is_live` and record round-trip units.
- `cargo nextest run -p yamt-local-merge` (hermetic prefix), `cargo clippy -p yamt-local-merge --all-targets -- -D
  warnings`, `cargo fmt --check`, `scripts/arch-check.sh` → `arch-check: ok`, `bash -n scripts/mr-conflict-repo.sh` and
  one run of it into `/var/tmp` with `git -C <dir> branch -a` and `git --git-dir <dir>/.git/fake-gitlab.git branch`
  pasted.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK15, RK19, RK40; the new RK43–RK47 of the design are yours to
prove), `skill://verification`.
