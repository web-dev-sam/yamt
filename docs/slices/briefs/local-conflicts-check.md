# Slice LocalConflictsCheck — each listed row's conflicts by yamt's own merge (merge-requests, src-tauri)

Feature: the merge-request list checks conflicts locally (request `docs/slices/request-local-conflict-check.md`
rules 1–8, Acceptance "Rust"; design `docs/slices/briefs/local-conflicts-design.md` option A, §2.1, §2.2, §3 A).
Runs after `LocalConflictsGitio` has landed (it uses `Repo::merge_tree`, `remote_refs`, `missing_commits`,
`MergeTreeRun`, `MergeOutcome`, `RemoteRef`, `Oid: Hash` from that brief's Contract). `LocalConflictsPage` starts
once this slice has landed and the orchestrator has run `just bindings`.

## Target

Owned: `crates/merge-requests/src/**` (new: `readiness.rs`, `check.rs`), `crates/merge-requests/tests/**` (new:
`local_conflicts.rs`), `crates/merge-requests/AGENTS.md`, `src-tauri/src/merge_requests.rs`,
`src-tauri/src/merge_requests/**`, `tests/glab/local-conflicts/**` (new), `tests/glab/merge-requests/graphql-page-1.json`,
`tests/glab/merge-requests/graphql-page-2.json`, `tests/glab/mr-conflicts/graphql-page-1.json`,
`tests/glab/merge-requests-timeout/graphql-page-1.json`, `tests/glab/README.md`, `scripts/local-conflicts-repo.sh` (new).

Read-only: everything else — `crates/gitio/**`, `crates/*/Cargo.toml` (no new dependency: `std::thread::scope`,
`std::sync::mpsc` and `HashMap` suffice), `scripts/mr-conflict-repo.sh` (called, not changed), `scripts/fake-glab/**`,
`frontend/**`, `frontend/src/ipc/bindings.ts` (the orchestrator regenerates it after this slice; run
`just bindings-check` only to see the diff), `docs/**` (put the lines §3.5, §3.9, §4, §5.1, `tree.md`, `state.md`
and the risk register need in `deviations_from_brief`; the design's "Shared edits" lists them).

Non-goals: the page (words, icon, applying results: `LocalConflictsPage`); asking GitLab to recheck; a local "needs
rebase"; approvals, pipelines or discussions computed locally; results kept across restarts; the merge and compare
windows; changing `prepare_open`/`prepare_resolve`.

## Contract

Sourced facts, given: GraphQL `MergeRequest.diffHeadSha` (`String`, nullable) and `targetBranch` (`String!`)
(`gitlabhq` v17.10.0 `app/graphql/types/merge_request_type.rb:25-26, 57-58`); `refs/merge-requests/<iid>/head` is
written in the target project before the diff whose head is `diffHeadSha` (`app/models/merge_request.rb:1521-1522,
2207-2221`), so the two differ while GitLab processes a push (rule 5); `ls-remote` sends no ref prefix for
patterns, so one call costs the whole advertisement, 1.1 s on gitlab.com; one `--quiet` merge ≈ 10 ms, ≈ 41 MB, on a
1,466-file repository (facts file `.omp/run/notes/PlanLocalConflictFacts.md`).

Fixed (add-only) — IPC, `crates/merge-requests/src/lib.rs`:

```rust
pub enum Readiness {
    Ready, Conflicts { also: Vec<BlockedReason> }, NeedsRebase, Checking, Blocked { reason: BlockedReason },
    /// yamt's own merge of GitLab's two commits is clean, and GitLab's status says nothing of the other blockers:
    /// it still checks, or keeps a conflict that hides them (request rule 3).
    MergesCleanly,
}

/// A row's readiness once yamt merged GitLab's two commits itself; sent only when it differs from GitLab's answer.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CheckedRow { pub iid: MergeRequestIid, pub readiness: Readiness }
```

Generated TS (for `LocalConflictsPage`): `{ kind: "mergesCleanly" }` in `Readiness`; `CheckedRow = { iid:
MergeRequestIid; readiness: Readiness }`; `ListMessage = { kind: "page"; page } | { kind: "end"; end } | { kind:
"checked"; row: CheckedRow }`.

Fixed — the crate's API:

```rust
// list.rs
/// How a load ended, and the rows it sent, for the local check.
pub struct Listed {
    pub end: ListEnd,
    /// `None` when no project was reached (no glab, logged out, no project); else every row of every page sent.
    pub to_check: Option<ConflictCheck>,
}
pub fn list_merge_requests(repository: &GitLabRepository, glab: Option<&Glab>, on_page: &dyn Fn(MergeRequestPage)) -> Listed;

// check.rs
/// The rows one load sent, as the check needs them (project path; per row its iid, target branch, `diffHeadSha`
/// and GitLab's merge status); made only by `list_merge_requests`.
pub struct ConflictCheck { /* private */ }

/// The merges this app's run has done: (target commit, source commit) → outcome. Held by the shell for the run and
/// lent to each check (architecture §3.9 as amended, plan #149); never cleared.
#[derive(Debug, Default)]
pub struct MergedPairs { /* private: HashMap<(Oid, Oid), MergeOutcome> */ }

/// What one load's check did: its one log line and what the tests read. Every row is counted once in
/// `remembered`, `moving`, `kept`, or (the rest) decided by a merge run now.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct CheckSummary {
    pub rows: u32,          // rows in the check
    pub merges: u32,        // `merge-tree` runs started
    pub fetched_refs: u32,  // refspecs in the one fetch; 0 without a fetch
    pub remembered: u32,    // rows decided from `MergedPairs`
    pub moving: u32,        // rows whose `refs/merge-requests/<iid>/head` ≠ `diffHeadSha` (rule 5)
    pub kept: u32,          // other rows keeping GitLab's answer: no head, a ref not advertised, a failed, timed-out
                            // or unstarted merge, a stopped check
    pub problem: Option<String>, // the first thing that went wrong (git too old, no remote, ls-remote, fetch, a merge)
}
impl std::fmt::Display for CheckSummary { /* the log line's words */ }

/// Request rules 4–8 for one load: GitLab's commits only, one `ls-remote`, at most one fetch, merges two at a
/// time; each row whose readiness changes goes to `on_checked` as soon as its pair is decided (on the calling
/// thread). Writes no ref, no `FETCH_HEAD`, no index, no working tree; logs one line.
pub fn check_conflicts(repository: &GitLabRepository, check: &ConflictCheck, memory: &mut MergedPairs, on_checked: &dyn Fn(CheckedRow)) -> CheckSummary;
```

`pub use` of `check_conflicts`, `CheckSummary`, `ConflictCheck`, `MergedPairs`, `Listed` in `lib.rs`.

Fixed — `readiness.rs` (crate-private; `page.rs:296-356` moves here, behaviour for a row without a local result
unchanged, plan #138):

```rust
pub(crate) struct GitLabMerge { status: MergeStatus, conflicts: bool, draft: bool }
pub(crate) enum MergeStatus { Mergeable, Conflict, NeedsRebase, Unchecked, Blocked(BlockedReason) }
impl GitLabMerge {
    pub(crate) fn read(status: Option<&str>, conflicts: bool, draft: bool) -> GitLabMerge; // unknown status: today's warning
    pub(crate) fn readiness(&self) -> Readiness;                         // GitLab's answer alone (today's fold)
    pub(crate) fn readiness_after(&self, merged: MergeOutcome) -> Readiness; // rules 2, 3: design §2.1's table
}
```

Fixed — `src-tauri/src/merge_requests.rs`:

```rust
pub(crate) enum ListMessage { Page { page: MergeRequestPage }, End { end: ListEnd }, Checked { row: CheckedRow } }
pub(crate) struct MergeRequestState { gitlab, range_dir, ai, pages: Mutex<BTreeSet<WebPage>>,
    /// The run's merged pairs; locked for a whole check, so a second load's check waits and then merges nothing
    /// twice (rule 7); never locked together with `pages`.
    merged: Mutex<MergedPairs> }
```

`list()`: pages, then `End` exactly as today, then — when the window has a project and `to_check` is `Some` — lock
`merged` and run `check_conflicts`, sending each row as `ListMessage::Checked`; a failed `Checked` send is not logged
(rule 8: one line per load, the check's own). The command answers after the check. No new command.

The check's numbers, as constants beside their only user in `check.rs` (design §2.2 "Numbers"):
`REMOTE_REFS_TIMEOUT` 20 s, `MERGE_TIMEOUT` 10 s, `MERGES_AT_ONCE` 2, `MERGE_PHASE_LIMIT` 60 s; the fetch uses
`yamt_gitio::FETCH_TIMEOUT`.

## Change

1. `query.rs`: the list query asks `targetBranch diffHeadSha` after `sourceProjectId targetProjectId`; its tests
   follow.
2. `readiness.rs`: the fold moved from `page.rs`, plus `readiness_after`. `page.rs`: `Node` gains `target_branch:
   String` and `diff_head_sha: Option<String>`; `row` builds the row's `readiness` through `GitLabMerge::readiness`
   and, beside the row, its check input (a `diffHeadSha` that is not an `Oid` → no head); `ParsedPage` carries them.
3. `list.rs`: `Listed`; every sent page's check inputs collected with the project's `full_path`.
4. `check.rs`, design §2.2 steps 1–9 in order: nothing to check → no git run at all; `Repo::version` →
   `MergeTreeRun::for_version` (`None` → stop); `remote::remote_for` (none → stop); one `remote_refs` of `refs/heads/<t>`
   per distinct target (`open::require_branch_name` refuses one holding `:`; that row is kept) and
   `refs/merge-requests/*/head`; per row: kept / moving / its pair; remembered pairs folded and sent first; one
   `missing_commits` over the other pairs' commits; at most one `fetch_without_refs` of `refs/heads/<t>` for each
   missing target tip and `refs/merge-requests/<iid>/head` for each missing head (deduplicated; a failed fetch keeps
   only the rows that needed it); the remaining distinct pairs merged `MERGES_AT_ONCE` at a time in scoped threads,
   none started after `MERGE_PHASE_LIMIT`, each outcome inserted into `memory` and then every row of that pair
   folded and sent when changed; one `tracing` line at the end — `info` with the summary, `warn` when `problem` is
   set. A small private merge-scheduling function over a merge closure is welcome so that "two at a time" and "none
   after the limit" are unit-tested without git.
5. `lib.rs`: `MergesCleanly`, `CheckedRow`, re-exports, crate docs. `AGENTS.md`: the new files and the amended
   "nothing cached" sentence.
6. `src-tauri/src/merge_requests.rs`: `ListMessage::Checked`, `merged`, `manage` builds it empty, `list()` as above.
7. `scripts/local-conflicts-repo.sh <dir>`: runs `scripts/mr-conflict-repo.sh <dir>` (unchanged), then in its bare
   `.git/fake-gitlab.git` writes `refs/merge-requests/<iid>/head` for the scenario below, and makes the fork's commit
   in a throwaway clone of the bare (fixed names and dates, based on `main`'s tip, adding `src/board/colours.ts`),
   pushed only to `refs/merge-requests/45/head` of the bare, the clone removed: that commit is in no branch and not
   in the checkout. Prints the same "Open its merge-request page with:" lines; RK19 sandbox as its callee.
8. `tests/glab/local-conflicts/`: `project.json` (as `mr-conflicts/`'s) and `graphql-page-1.json` (one page, the
   last, user `sam`), the rows below, with the commit ids the script makes. `tests/glab/README.md`: the scenario.
9. The four recorded pages in Owned gain `"targetBranch": "main"` on every node (non-null in GitLab's schema; no
   `diffHeadSha`, so their rows are never checked and every existing expectation holds).

Scenario `local-conflicts` (all from project 1 into `main` unless said; heads are `scripts/mr-conflict-repo.sh`'s
branch tips):

| iid | GitLab says                                 | `diffHeadSha`       | bare's `refs/merge-requests/<iid>/head` | sent after the check                       |
| --- | ------------------------------------------- | ------------------- | --------------------------------------- | ------------------------------------------ |
| 41  | `CONFLICT`, `conflicts: true`               | `feature/clean`     | same                                    | `mergesCleanly`                            |
| 42  | `MERGEABLE`                                 | `feature/due-dates` | same                                    | `conflicts { also: [] }`                   |
| 43  | `CHECKING`                                  | `feature/merged`    | same                                    | `mergesCleanly`                            |
| 44  | `MERGEABLE`                                 | `feature/clean`     | `feature/due-dates` (a push in flight)  | nothing (moving)                           |
| 45  | `UNCHECKED`, from a fork (source project 2) | the fork's commit   | same, the only place it exists          | `mergesCleanly` (fetched)                  |
| 46  | `NEED_REBASE`                               | `feature/clean`     | same                                    | nothing (`needsRebase` either way)         |
| 47  | a draft, `DISCUSSIONS_NOT_RESOLVED`         | `feature/due-dates` | same                                    | `conflicts { also: [discussions, draft] }` |
| 48  | `CHECKING`, into `develop`                  | `feature/clean`     | same                                    | `mergesCleanly`                            |
| 49  | `PREPARING`                                 | `null`              | none                                    | nothing (kept)                             |

## Acceptance

- `crates/merge-requests/tests/local_conflicts.rs` on a fresh `scripts/local-conflicts-repo.sh` repository and
  `Fake::new("local-conflicts")`, calling `list_merge_requests` then `check_conflicts` with one `MergedPairs`:
  - `the_local_merge_decides_conflicts_and_gitlab_the_rest` — the sent rows are exactly the table's (41 → rule 3's
    state though GitLab says `CONFLICT`; 42 → "has conflicts" though GitLab says `MERGEABLE`; 43 `CHECKING` + clean →
    rule 3's state; 47 keeps GitLab's blocker beside the conflict); summary `rows 9, merges 5, fetched_refs 1,
    remembered 0, moving 1, kept 1, problem None`;
  - `a_head_ref_ahead_of_gitlabs_head_keeps_gitlabs_answer` — nothing sent for 44, `moving 1`;
  - `a_second_load_with_the_same_pairs_merges_and_fetches_nothing` — the same rows sent again, `merges 0,
    fetched_refs 0, remembered 7`;
  - `the_check_leaves_refs_status_head_and_fetch_head_byte_identical` — `git for-each-ref`, `git status
    --porcelain`, `.git/HEAD`'s bytes and `.git/FETCH_HEAD` (absent) the same before the first load and after the
    second;
  - `an_unreachable_remote_keeps_every_gitlab_answer` — the bare moved away before the check: nothing sent, `problem`
    names git's `ls-remote` line, `merges 0`.
- Unit tests: `readiness_after` over design §2.1's table (every `MergeStatus` × both outcomes, draft and the
  `conflicts` flag); today's `page/tests.rs` expectations unchanged; `Display` of a summary with and without a
  problem; the merge scheduler (never more than two at once, none started after the limit, results in finishing
  order); a target holding `:` is kept without an `ls-remote` pattern.
- `src-tauri/src/merge_requests/tests.rs` (the existing `list` helper, `through_glab` as its siblings, the script's
  repository and scenario `local-conflicts`): `a_load_sends_its_pages_then_its_end_then_the_checked_rows` (order and
  iids 41, 42, 43, 45, 47, 48) and `a_second_load_sends_the_same_checked_rows`.
- `cargo nextest run -p yamt-merge-requests -p yamt-app` (the justfile's hermetic prefix), `cargo clippy --all-targets
  -- -D warnings` on both, `cargo fmt --check`, `just bindings-check` (expected diff: only `Readiness`, `CheckedRow`,
  `ListMessage` — paste it), `just arch-check`: paste the summary lines.
- `just mutants HEAD` in your workspace (SP11); survivors kept only with a reason.

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK19, RK40, RK52), `skill://verification`.
