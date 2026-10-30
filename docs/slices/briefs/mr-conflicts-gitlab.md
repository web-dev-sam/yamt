# Slice MrConflictsGitlab — size, readiness and fork per row; the branches resolving needs (merge-requests)

Feature: merge-request conflicts (request `docs/slices/request-mr-conflicts.md` rules 1–3 — rule 2 with the owner's
"conflicts first" #1998 — and 5; design `docs/slices/briefs/mr-conflicts-design.md` option A — §1 "GitLab", §2
entirely, §4.1, §4.6 "yamt-merge-requests", §4.7 "merge-requests"). Runs first, beside `MrConflictsGit`.
`MrConflictsApp` composes `prepare_resolve`.

## Target

Owned: `crates/merge-requests/**`; `tests/glab/merge-requests/graphql-page-1.json`,
`tests/glab/merge-requests/graphql-page-2.json`, `tests/glab/merge-requests-timeout/graphql-page-1.json`;
`tests/glab/mr-conflicts/**` (new scenario); `tests/glab/README.md`;
`frontend/src/ipc/fixtureMergeRequestData.ts`, `frontend/src/ipc/fixtureMergeRequestData.test.ts` (new),
`frontend/src/ipc/mergeRequestDomain.test.ts`, `frontend/src/ipc/tauriMergeRequests.test.ts`.

Read-only: everything else. `frontend/src/ipc/bindings.ts` is generated (the orchestrator runs `just bindings` after
your patch); the four TS files are yours only so the new row fields keep the web typecheck green once the bindings
regenerate. Architecture, project map, risk register: lines in `deviations_from_brief`.

Non-goals: any git write, the local merge, commands, `src-tauri`, the page's display and the row's action rule
(`MrConflictsPage`), the resolve and continue fixture replies (`fixtureMergeRequests.ts`, `MrConflictsPage`).

## Contract

Fixed (add-only), `crates/merge-requests/src/lib.rs` (serde/specta attributes as `CiStatus` and `OpenReply`):

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)] #[serde(rename_all = "camelCase")]
pub struct ChangeSize { pub additions: u32, pub deletions: u32, pub files: u32 }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub enum Readiness {
    Ready,
    Conflicts { also: Vec<BlockedReason> },   // what else blocks it, in the order below; empty when nothing known
    NeedsRebase, Checking,
    Blocked { reason: BlockedReason },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub enum BlockedReason {
    Draft, Discussions, Approvals, PipelineMustPass, PipelineRunning, ChangesRequested, Dependencies, StatusChecks,
    JiraIssue, LockedFiles, LockedPaths, MergeTime, NotOpen, SourceBranch, SecurityPolicies, SecurityPipelines,
    TitleRule, Other { status: String },
}

// MergeRequestRow gains (after `page`):
pub size: Option<ChangeSize>,     // None when GitLab's diffStatsSummary is null
pub readiness: Readiness,
pub from_fork: bool,              // sourceProjectId != Some(targetProjectId)

/// The branches of merge request `iid` and the remote holding them, asked afresh (plan §2 #139).
pub struct ResolveTarget { pub root: PathBuf, pub iid: MergeRequestIid, pub remote: String, pub branch: String, pub target: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub enum ResolveRefusal { NotOpen, FromFork, NoRemote { project: String }, GlabMissing, NotLoggedIn { detail: String }, Failed { message: String } }

pub fn prepare_resolve(repository: &GitLabRepository, glab: Option<&Glab>, iid: MergeRequestIid) -> Result<ResolveTarget, ResolveRefusal>;
```

The fold of design §2 ("One fold, in `page.rs`"), exactly: `MERGEABLE` Ready; `CONFLICT` Conflicts; `NEED_REBASE`
NeedsRebase; `CHECKING`/`UNCHECKED`/`PREPARING`/`APPROVALS_SYNCING`/null Checking; `DRAFT_STATUS` Draft;
`DISCUSSIONS_NOT_RESOLVED` Discussions; `NOT_APPROVED` Approvals; `CI_MUST_PASS` PipelineMustPass; `CI_STILL_RUNNING`
PipelineRunning; `REQUESTED_CHANGES` ChangesRequested; `BLOCKED_STATUS` Dependencies; `EXTERNAL_STATUS_CHECKS`
StatusChecks; `JIRA_ASSOCIATION` JiraIssue; `LOCKED_LFS_FILES` LockedFiles; `LOCKED_PATHS` LockedPaths; `MERGE_TIME`
MergeTime; `NOT_OPEN` NotOpen; `COMMITS_STATUS` SourceBranch; `SECURITY_POLICIES_VIOLATIONS` SecurityPolicies;
`SECURITY_POLICY_PIPELINE_CHECK` SecurityPipelines; `TITLE_NOT_MATCHING` TitleRule; else `Other { status }` with a
`tracing::warn!` (as `ci_status`, `page.rs:222-245`). **Then conflicts first** (request rule 2, #1998): when the node's
`conflicts` is true or its status is `CONFLICT`, the readiness is `Conflicts { also }`: `also` = the reason when the
status folded to `Blocked { reason }`, then `Draft` when the row is a draft and `also` does not hold it yet; a status
that folded to Ready, NeedsRebase or Checking adds nothing. Otherwise the status's fold stands. Counts: GitLab's
`Int!` saturating into `u32`, below 0 → 0.

Queries (`query.rs`, one line each, balanced braces, as the existing two):

- the list query's node fields add `detailedMergeStatus conflicts diffStatsSummary { additions deletions fileCount }
  sourceProjectId targetProjectId`;
- a new `BRANCHES_QUERY`: `query MergeRequestBranches($fullPath: ID!, $iid: String!) { project(fullPath: $fullPath) {
  mergeRequest(iid: $iid) { state sourceBranch targetBranch sourceProjectId targetProjectId } } }` and
  `branches_args(full_path, iid)` = `api graphql -f query=… -f fullPath=<path> -f iid=<n>` (as `details_args`). The open
  details query stays as it is.

`prepare_resolve` order: no glab → `GlabMissing`; `auth_status` → `NotLoggedIn`/`Failed` (as `prepare_open`,
`open.rs:59-67`: one shared helper for both, not a copy); the project; the branches query: no merge request or state ≠
`opened` → `NotOpen`; `sourceProjectId != Some(targetProjectId)` → `FromFork`; either branch name holding `:` →
`Failed { message: "GitLab sent \"<name>\" as a branch name" }` (`open.rs:128-132`'s rule and constant, one copy);
`remote_for` (`remote.rs`) → `NoRemote { project }`; `ResolveTarget { root: repository.root(), … }`.

**Fake glab scenario `tests/glab/mr-conflicts/`** (used by `MrConflictsApp` and the real-app steps; project path and
branches match `scripts/mr-conflict-repo.sh` of `MrConflictsLocal`: project `taskboard/taskboard` at
`https://gitlab.example`, target `main`, branches `feature/due-dates` (conflicts with `main`), `feature/clean`
(merges clean), `feature/merged` (already contains `main`)):

- `project.json`: as `tests/glab/merge-requests/project.json`.
- `graphql-page-1.json`: `currentUser` `sam`, `queryComplexity` `{ "score": 119, "limit": 250 }`, no next page;
  nodes (each with the list's existing fields, any values; `conflicts` false unless stated):
  !21 "Due dates on cards", `CONFLICT`, conflicts, `{ additions: 120, deletions: 40, fileCount: 6 }`, project ids 1/1;
  !22 "Card colours", `CONFLICT`, conflicts, ids 2/1 (a fork); !23 "Swimlanes", `CONFLICT`, conflicts (stale: merges
  clean), ids 1/1; !24 "Board export", `NEED_REBASE`; !25 "Draft: Keyboard help", draft, `DRAFT_STATUS`; !26 "Archive
  cards", `UNCHECKED`; !27 "Reminder sounds", `MERGEABLE`, `diffStatsSummary` null; !28 "Due-date filter",
  `"MERGE_TRAIN_STUCK"` (unknown); !29 "Merged already", `CONFLICT`, conflicts (stale: already contains main), ids
  1/1; !31 "Draft: Calendar view", draft, `DRAFT_STATUS`, conflicts (→ `Conflicts { also: [Draft] }`); !32 "Board
  themes", draft, `CI_MUST_PASS`, conflicts (→ `Conflicts { also: [PipelineMustPass, Draft] }`).
- `graphql-merge-request-<iid>.json` for 21 (`opened`, `feature/due-dates` → `main`), 22 (`opened`, `feature/colours`
  → `main`, ids 2/1), 23 (`feature/clean`), 29 (`feature/merged`), 30 (`state: "merged"`), each answering the
  branches query's fields.
- `tests/glab/README.md`: the scenario and its purpose, in the existing list's style.

**TS fixture rows** (`fixtureMergeRequestData.ts` `row(index)`; MrConflictsPage's fixture script relies on it):
readiness by `index % 8`: 0 conflicts (`also: []`), 1 conflicts (`also: []`) with `fromFork: true`, 2 ready, 3
needsRebase, 4 conflicts with `also: [discussions]`, 5 checking, 6 blocked pipelineMustPass, 7 blocked other
`"MERGE_TRAIN_STUCK"`; a draft row (`index % 7 == 6`, today's `DRAFT_EVERY`) gets `draft` appended to `also` when the
cycle says conflicts, else is blocked draft; `fromFork` false elsewhere; `size` null when `index % 5 == 4`, else
`{ additions: 12 * (index + 1), deletions: 5 * (index % 4), files: (index % 6) + 1 }`.

## Change

1. `lib.rs` types; `page.rs` `Node` fields (`detailed_merge_status: Option<String>`, `conflicts: bool`,
   `diff_stats_summary: Option<…>`, `source_project_id: Option<i64>`, `target_project_id: i64`), `readiness`, size and
   fork in `row`.
2. `query.rs`: the list fields, `BRANCHES_QUERY`, `branches_args`.
3. `resolve.rs` (new) `prepare_resolve`; `open.rs` and `resolve.rs` share the glab/auth/project prelude and the `:`
   rule.
4. Recorded answers: `merge-requests/graphql-page-{1,2}.json` and `merge-requests-timeout/graphql-page-1.json` gain the
   five fields (values free, at least one of each readiness group across them, one conflicting draft); the new
   scenario.
5. TS: the fixture rows; the row literals in `mergeRequestDomain.test.ts` and `tauriMergeRequests.test.ts` gain the
   three fields; `fixtureMergeRequestData.test.ts` pins the cycle (iid 640 conflicts, 639 conflicts from a fork, 636
   conflicts also discussions and no size, 634 blocked draft, 620 conflicts also discussions and draft).
6. `AGENTS.md` of the crate: the new types, the fold, the query, `prepare_resolve`.

## Acceptance

- Unit tests (`page/tests.rs`, `query.rs`, `resolve.rs`): every one of GitLab's 24 values folds as the table (a table
  test, so a missed variant fails), null → checking, `"MERGE_TRAIN_STUCK"` → `Other`, a null summary → `size: None`,
  negative counts → 0, a fork row, a deleted source project (`sourceProjectId` null) → fork; conflicts first:
  `conflicts: true` with `DRAFT_STATUS` → `Conflicts { also: [Draft] }`, with `CI_MUST_PASS` on a draft →
  `Conflicts { also: [PipelineMustPass, Draft] }`, with `MERGEABLE` and with `CHECKING` → `Conflicts { also: [] }`,
  `CONFLICT` with `conflicts: false` → `Conflicts { also: [] }`, `"MERGE_TRAIN_STUCK"` with `conflicts: true` →
  `Conflicts { also: [Other { status }] }`; both queries one line with balanced braces; `branches_args` exact argv;
  the scenario's page parsed: !31 and !32 as above.
- `tests/resolve.rs` with the fake glab on `mr-conflicts/` and `scripts/range-repo.sh`'s repository (as `tests/open.rs`):
  !21 → `ResolveTarget { remote: "origin", branch: "feature/due-dates", target: "main", … }`; !22 → `FromFork`; !30 →
  `NotOpen`; a repository without the project's remote → `NoRemote`; glab missing → `GlabMissing`; logged out →
  `NotLoggedIn`; a `:` branch → `Failed`; the logged argv `-f fullPath=taskboard/taskboard -f iid=21`.
- `cargo nextest run -p yamt-merge-requests` (hermetic prefix), `cargo clippy -p yamt-merge-requests --all-targets --
  -D warnings`, `cargo fmt --check`, `cargo nextest run -p yamt-app merge_requests` (the list through the command still
  passes); after `just bindings` in your workspace: `pnpm -C frontend test src/ipc/fixtureMergeRequestData.test.ts
  src/ipc/mergeRequestDomain.test.ts src/ipc/tauriMergeRequests.test.ts src/ipc/fixtureMergeRequests.test.ts` and
  `pnpm -C frontend typecheck` green (paste the summary lines).
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://ts-conventions`, `skill://risk-register` (RK40, RK41),
`skill://verification`.
