# Merge-request conflicts — design: change size, merge readiness, resolve conflicts in your own checkout (with abort)

Designer: `MrConflictsDesign`, 2026-10-30, on `main` after `abcb805`. Request: `docs/slices/request-mr-conflicts.md`
(rules 1–10, the owner's answers #1995 "your own checkout", #1996 "ask before pushing", #1997 "Continue merging" and
#1998 "conflicts first"). Brief: `docs/slices/briefs/mr-conflicts-design-brief.md`. Builds:
`docs/slices/briefs/mr-conflicts-{git,gitlab,local,app,window,page}.md`.

Every fact carries its source (file:line at `abcb805`, a document, a plan row) or `[INFERENCE]`.

## 0. Recommendation in one paragraph

Option A: a new crate **`yamt-local-merge`** (gitio only) owns the whole life of "a merge yamt started in your checkout":
the checks of rule 4, the fetch, the checkout, the merge, a **record in the git dir** that survives a restart, the
restore after Abort and the push. `yamt-merge-requests` only asks GitLab for the two branch names (`prepare_resolve`);
`src-tauri` composes the two and starts the merge window as `yamt --repo <root>` through #132's second-process start.
The merge window finds the record on every list, so Abort restores and Continue ("Commit merge") asks to push without
a flag or a second mode; while a merge is unfinished its row offers "Continue merging !12", which starts that window
again. Six builds: `git` ∥ `gitlab` → `local` → `app` → `window` → `page`.

## 1. Facts this design stands on

**The page and its Rust side.**

- The row type: `MergeRequestRow { iid, title, created_at, draft, assignees, reviewers, labels, open_discussions,
  approvals, pipeline, page }` (`crates/merge-requests/src/lib.rs:115-138`), built once in `page.rs` `row`
  (`crates/merge-requests/src/page.rs:156-181`); GitLab's pipeline status is folded into the window's seven in Rust,
  an unknown one becomes `Pending` with a warning (`page.rs:222-245`) — the precedent for folding a GitLab enum.
- The list query is one line, about 112 of GitLab's 250 complexity (`crates/merge-requests/src/query.rs:9-32`, plan §2
  #131). The details query asks `state targetBranch diffRefs { baseSha headSha }` (`query.rs:5-7`).
- Opening changes: glab present, `glab auth status`, the project, the details asked afresh, a fetch only when a commit
  is missing (`crates/merge-requests/src/open.rs:53-78`, `113-138`); a branch name holding `:` is refused because a
  refspec would read it as a destination (`open.rs:128-132`); the remote is the first GitLab remote whose URL ends in
  the project's path (`crates/merge-requests/src/remote.rs`, plan §2 #132).
- The fake glab answers `glab api graphql` carrying a field `iid=<n>` from `graphql-merge-request-<n>.json`, any
  other GraphQL call from `graphql-page-<n>.json` (`tests/glab/README.md:35-36`).
- The window's state for the page: `MergeRequestState { gitlab: Option<GitLabRepository>, range_dir, pages }`
  (`src-tauri/src/merge_requests.rs:31-35`); `GitLabRepository::root()` is where glab and git run
  (`crates/merge-requests/src/detect.rs:68-72`).
- A second yamt is started by `range_window::start` — `$APPIMAGE` or `current_exe`, its own process group, stdin and
  stdout null, a reaper thread (`src-tauri/src/range_window.rs:8-37`, `62-88`; plan §2 #132).
- Row layout: title and meta, discussions `w-12`, approvals `w-12`, the CI box `w-7`, the open-changes button
  (`frontend/src/ui/MergeRequestRow.vue:55-111`); a refusal shows as one `role="status"` line under the row
  (`MergeRequestRow.vue:113-115`); per-row state is a map `openings: Map<iid, Opening>` (`ui/mergeRequests.ts:42-44`,
  `160-183`).
- A disabled button with a hover is a `<span :title>` around a `disabled:pointer-events-none` button
  (`frontend/src/ui/OperationButtons.vue:21-35`).

**The merge window.**

- `Merge = Held | Running | MovedOn | Aborted | Finished` (`src-tauri/src/merge.rs:16-28`); Continue and Abort run on
  a worker (`merge.rs:150-201`); the commands destroy the window when `has_ended()` (`src-tauri/src/commands.rs:183-203`,
  `merge.rs:115-120`).
- git's Continue for a merge is `merge --continue` with `GIT_EDITOR=:` — git's prepared message, comments stripped
  (`crates/gitio/src/abort_continue.rs:22-34`, `48-57`); Abort for a merge is `merge --abort` (`abort_continue.rs:37-46`).
  So rule 6's "git's default merge message" is exactly today's "Commit merge" (plan §2 #89).
- A merge is `Operation::Merge { merging: Oid }` read from `MERGE_HEAD`; a stop is `Stop { operation, head }`
  (`crates/gitio/src/operation.rs:14-17`, `47-51`, `160-161`).
- Start-up exits with "nothing to merge" when the stop lists no file (`src-tauri/src/outcome.rs:42-51`); a stop with an
  operation and no files shows the empty-stop view with Continue and Abort (`frontend/src/ui/emptyStop.ts:18-26`, plan
  §2 #89).
- The question dialog always has two buttons (`frontend/src/ui/QuestionDialog.vue:42-58`); its bullet list kind is
  named `servers` (`QuestionDialog.vue:38-40`, `frontend/src/ui/question.ts:36-39`).
- `ContinueReply` and `Listing` are PascalCase-tagged (`merge.rs:33-55`); `toListing` maps the fields by name
  (`frontend/src/ipc/domain.ts:276-282`).

**git and the tools.**

- `fetch_without_refs` writes no ref and no `FETCH_HEAD`, with `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`,
  `SSH_ASKPASS_REQUIRE=force` + `SSH_ASKPASS=false`, killed at `FETCH_TIMEOUT` 120 s, `Err` = git's first stderr line
  (`crates/gitio/src/fetch.rs:7-53`).
- `Repo::git_path` exists but is crate-private (`crates/gitio/src/repo.rs:92-95`); paths are joined to the root
  (`repo.rs:99-113`). `current_branch`, `commit_named`, `head_commit`, `checkout_detached`, `unmerged`, `stop`, `abort`
  exist (`docs/architecture.md` §3.2; `crates/gitio/src/checkout.rs:58-83`).
- `git checkout -B <branch> <start>` creates the branch or resets it, then checks it out (git-checkout(1) `-B`);
  `git branch -D`/`--force` refuse a branch checked out in any worktree (git-branch(1)); `git reset --keep` refuses
  when local changes are in the way (git-reset(1)); `git push --porcelain` prints one line per ref,
  `<flag> \t <from>:<to> \t <summary> (<reason>)`, flag `!` for a rejected ref (git-push(1) "OUTPUT"); `--refmap=`
  stops the configured refspec from updating other refs (git-fetch(1) "CONFIGURED REMOTE-TRACKING BRANCHES").
- The compare window's tab store holds `File::try_lock` on a lock file (plan §2 #97) — the precedent for a lock.

**GitLab (GraphQL reference, `gitlab.com/gitlab-org/gitlab` `doc/api/graphql/reference/{objects,enums}.md`, read
2026-10-30).**

- `MergeRequest.detailedMergeStatus: DetailedMergeStatus` (nullable), `diffStatsSummary: DiffStatsSummary` (nullable),
  `sourceBranch: String!`, `targetBranch: String!`, `sourceProjectId: Int` (nullable), `targetProjectId: Int!`,
  `conflicts: Boolean!` (objects.md, `## MergeRequest` fields).
- `DiffStatsSummary { additions: Int!, changes: Int!, deletions: Int!, fileCount: Int! }` (objects.md
  `## DiffStatsSummary`).
- `DetailedMergeStatus`, 24 values: `APPROVALS_SYNCING BLOCKED_STATUS CHECKING CI_MUST_PASS CI_STILL_RUNNING
  COMMITS_STATUS CONFLICT DISCUSSIONS_NOT_RESOLVED DRAFT_STATUS EXTERNAL_STATUS_CHECKS JIRA_ASSOCIATION
  LOCKED_LFS_FILES LOCKED_PATHS MERGEABLE MERGE_TIME NEED_REBASE NOT_APPROVED NOT_OPEN PREPARING REQUESTED_CHANGES
  SECURITY_POLICIES_VIOLATIONS SECURITY_POLICY_PIPELINE_CHECK TITLE_NOT_MATCHING UNCHECKED` (enums.md
  `## DetailedMergeStatus`, with GitLab's one-line meaning of each; the REST list at docs.gitlab.com/api/merge_requests/
  "detailed_merge_status" agrees).
- The added list fields cost about 7 more complexity points per query: about 119 of 250 `[INFERENCE: GitLab counts 1
  per field; the implementer logs the score the fake records, the real one is the owner's check]`.
- GitLab reports one `detailedMergeStatus` per merge request, so a merge request that conflicts may report a blocking
  status instead (`DRAFT_STATUS`, …), and one reporting `CONFLICT` names no other blocker
  `[INFERENCE: GitLab's check order is not documented]`; `conflicts: Boolean!` is GitLab's separate flag (above).

## 2. What every option shares: the rows (rules 1–3, 9)

These shapes are the same in A, B and C; the options differ in where the merge, its record and the push live.

**Query.** The list query (#131) adds, per node: `detailedMergeStatus conflicts diffStatsSummary { additions deletions
fileCount } sourceProjectId targetProjectId`. A second, separate details query asks what resolving needs, afresh at the
click: `query MergeRequestBranches($fullPath: ID!, $iid: String!) { project(fullPath: $fullPath) { mergeRequest(iid:
$iid) { state sourceBranch targetBranch sourceProjectId targetProjectId } } }` — one line, as the others. It is not
folded into the open details query: each asks what its job needs, and the recorded `graphql-merge-request-1x.json`
answers of the `merge-requests/` scenario stay untouched (vision 5).

**Row types** (`crates/merge-requests/src/lib.rs`, IPC, camelCase):

```rust
pub struct ChangeSize { pub additions: u32, pub deletions: u32, pub files: u32 }        // GitLab's counts, saturating
pub enum Readiness {                                                                    // tag "kind"
    Ready, Conflicts { also: Vec<BlockedReason> }, NeedsRebase, Checking, Blocked { reason: BlockedReason },
}
pub enum BlockedReason {                                                                // tag "kind"
    Draft, Discussions, Approvals, PipelineMustPass, PipelineRunning, ChangesRequested, Dependencies,
    StatusChecks, JiraIssue, LockedFiles, LockedPaths, MergeTime, NotOpen, SourceBranch, SecurityPolicies,
    SecurityPipelines, TitleRule, Other { status: String },
}
MergeRequestRow { …, size: Option<ChangeSize>, readiness: Readiness, from_fork: bool }
```

**One fold, in `page.rs`** (as `ci_status`). First GitLab's status alone: `MERGEABLE`→`Ready`; `CONFLICT`→`Conflicts`;
`NEED_REBASE`→`NeedsRebase`; `CHECKING`, `UNCHECKED`, `PREPARING`, `APPROVALS_SYNCING` and a missing
status→`Checking`; `DRAFT_STATUS`→`Draft`; `DISCUSSIONS_NOT_RESOLVED`→`Discussions`; `NOT_APPROVED`→`Approvals`;
`CI_MUST_PASS`→`PipelineMustPass`; `CI_STILL_RUNNING`→`PipelineRunning`; `REQUESTED_CHANGES`→`ChangesRequested`;
`BLOCKED_STATUS`→`Dependencies`; `EXTERNAL_STATUS_CHECKS`→`StatusChecks`; `JIRA_ASSOCIATION`→`JiraIssue`;
`LOCKED_LFS_FILES`→`LockedFiles`; `LOCKED_PATHS`→`LockedPaths`; `MERGE_TIME`→`MergeTime`; `NOT_OPEN`→`NotOpen`;
`COMMITS_STATUS`→`SourceBranch`; `SECURITY_POLICIES_VIOLATIONS`→`SecurityPolicies`;
`SECURITY_POLICY_PIPELINE_CHECK`→`SecurityPipelines`; `TITLE_NOT_MATCHING`→`TitleRule`; anything else→`Other {
status }` with a warning (rule 2's orchestrator default: blocked, GitLab's own word). **Then conflicts first (rule 2,
#1998):** when `conflicts` is true, or the status is `CONFLICT`, the readiness is `Conflicts { also }`, where `also` is
the blocked reason the status folded to (if it folded to `Blocked`), then `Draft` when the row is a draft and `also`
does not hold it yet — GitLab never merges a draft, so it is a blocker known without GitLab's status. A conflicting
row whose status says ready, needs rebase or checking has an empty `also` (none of those blocks). Exactly one state per
row (rule 2). `size`: `None` when `diffStatsSummary` is null (rule 1: "unknown counts show nothing"), negative counts 0.
`from_fork`: `sourceProjectId != Some(targetProjectId)` — a deleted source project counts as a fork (its branch is not
in this project either).

**Words** live in the self-contained `frontend/src/mergeRequests/` (as `ciBox.ts`): `sizeText` → `+120 −40 · 6 files`
(`−` is U+2212; "1 file"), `sizeTitle` → "120 lines added, 40 removed in 6 files" ("1 line added, 1 removed in 1
file"); `readinessText`: "Ready to merge", "Has conflicts" (with `also`: "Has conflicts. Also blocked: " + the reasons
joined by "; ", e.g. "Has conflicts. Also blocked: it is a draft; the pipeline must pass"), "Needs a rebase", "GitLab
is still checking whether it can be merged", "Blocked: " + the reason — "it is a draft", "discussions are unresolved",
"approvals are missing", "the
pipeline must pass", "the pipeline is still running", "a reviewer requested changes", "merge requests it depends on
must be merged first", "status checks must pass", "the title or description must name a Jira issue", "it changes LFS
files someone locked", "it changes paths someone locked", "it may not be merged at this time", "it is not open", "its
source branch is missing or has no commits", "security policies are not satisfied", "security policy pipelines must
pass", "its title does not match the project's rule", `GitLab says "<status>"`.

**Icons** (Lucide, checked in `frontend/node_modules/@iconify-json/lucide/icons.json`): ready `circle-check`, conflicts
`git-merge-conflict`, needs rebase `git-compare-arrows`, checking `hourglass`, blocked `circle-slash`; the resolve button
`git-merge`, the continue button `step-forward`. Column: a fixed `w-7` right of the CI box (rule 2), the row's action
button left of the open-changes button (rule 3).

**The row's action rule** (pure, `mergeRequests/internal/rowAction.ts`), first match wins:

1. the unfinished merge yamt started is this row's (`localMerge` is `merging` with this `iid`, rule 9) → **Continue**
   "Continue merging !12": its window already open → disabled, hover "Its merge window is already open"; a click of
   this row running → spinner, disabled; else enabled. Shown whatever the row's readiness says now.
2. readiness is not `conflicts` → no button.
3. **Resolve** "Resolve conflicts of !12": `fromFork` → disabled, hover "Resolving a fork's merge request is not
   supported"; another merge yamt started is unfinished in this checkout → disabled, hover "The merge of !21 is not
   finished in this repository"; a click of this row running → spinner, disabled; else enabled.

The label is also the tooltip of an enabled button and the accessible name of every state.

## 3. Options

### Option A — one new crate owns the merge yamt starts; the window finds it on every list (recommended)

**Data structures first.**

- On disk: `<git dir>/yamt-merge-request.json` (through `rev-parse --git-path`, so per worktree, beside `MERGE_HEAD`),
  format 1, written with temp file, `sync_all`, rename **before the first change**:
  `{ "format": 1, "iid": 21, "remote": "origin", "branch": "feature/due-dates", "target": "main",
  "returnTo": { "kind": "branch", "name": "develop" } | { "kind": "detached", "commit": "<oid>" },
  "branchBefore": { "kind": "created" } | { "kind": "movedFrom", "commit": "<oid>" } | { "kind": "unchanged" },
  "head": "<oid: the branch tip yamt checked out>", "merging": "<oid: the target tip it merged>" }`.
  Private Rust types (`MergeRecord`, `RecordedReturn`, `RecordedBranch`), never on the IPC.
- **Live** = `Repo::stop()` is `Merge { merging }` with `merging == record.merging`, `stop.head == record.head`, and the
  current branch is `record.branch`. Otherwise the record is **stale** (committed, aborted or moved by hand) and is
  dropped at the next start.
- A lock file `<git dir>/yamt-merge-request.lock`, held with `File::try_lock` for a start's duration.
- A second lock file `<git dir>/yamt-merge-window.lock`, held by the merge window of a recorded merge for its whole
  life (`WindowClaim`); the kernel releases it when that process ends, crash included. It answers "is its window open"
  for rule 9 and keeps a second window off the same merge.
- IPC types of the crate: `Started`, `Refusal`, `Leftover`, `ReturnTo`, `BranchBefore`, `MergeView`, `LocalMerge`,
  `PushReply` (full text in §4.6).

**Files.** New `crates/local-merge/**`; `crates/gitio/src/{branch.rs,push.rs,fetch.rs,repo.rs,lib.rs}`;
`crates/merge-requests/src/{lib.rs,query.rs,page.rs,resolve.rs,open.rs}`; `src-tauri/src/{merge.rs,commands.rs,
outcome.rs,merge_requests.rs,second_window.rs (was range_window.rs),lib.rs}`; the window's `ipc/` and `ui/` files of
§4.5; `scripts/arch-check.sh`, `scripts/mr-conflict-repo.sh`, `tests/glab/mr-conflicts/`.

**Risks.** A new crate is a new PM1 rule and §7 entry (cost, not risk). The merge window runs one more git read per
list while a record exists (`stop` + `current_branch`, a few ms) `[INFERENCE]`. The IPC change of `abort_operation`
(`()` → `AbortReply`) breaks the window's TS until the `window` build lands (§5).

**Tests.** Real repositories from `scripts/mr-conflict-repo.sh` in `crates/local-merge/tests`: every rule-4 refusal
changes nothing; the three local-branch cases; abort after a restart; partial restore; push accepted and rejected;
stale and unreadable records; the lock. Command-level tests in `src-tauri`. Pure TS tests for words and the button
rule; WebKit and real-app steps (§4.7).

**Visions.** 2 (one owner of the record: its writer and every reader are one crate), 3 (arch-check: the crate depends
on gitio only; merge-requests keeps "read GitLab" without writing refs, #117's "a second job is growth harm"), 4 (sum
types for every refusal and leftover; liveness is one pure function), 1 (the git steps read top to bottom in two files,
`start.rs` and `restore.rs`).

### Option B — no new crate: merge-requests starts the merge, session finishes it

**Data structures.** The record moves into gitio as a typed line file (`Repo::read_merge_request_record` /
`write_…`, `key value` lines, no serde in gitio); `MergeSession` gains `merge_request: Option<StartedMerge>` decided
once at open, like `Orientation` (#86).

**Files.** `crates/merge-requests/src/resolve.rs` (GitLab half and every git step: lock, checks, fetch, checkout,
merge, record write); `crates/session/src/merge_request.rs` (read at open, restore inside `abort_operation`, a new
`MergeSession::push`); gitio record file; src-tauri thin commands. No arch-check change.

**Risks.** `yamt-merge-requests` gains a second job — writing the user's refs and worktree — next to reading GitLab
(#117, OR12: growth harm). `session`, the merge window's state machine, learns GitLab's remote and pushes. The record
format spreads over three crates (gitio defines, merge-requests writes, session reads) and gitio ("subprocess only,
bytes in and out", architecture §3.2) owns a yamt-domain file. The record is decided once at open, so a record written
by a start in another window while this window is open is never seen (a second source of truth for "is this merge
yamt's").

**Tests.** The same scenarios, split: start tests in merge-requests (which then needs a real-repository fixture with a
pushable remote), restore and push tests in session.

**Visions.** 5 (no new crate, fewer files) — against 2 and 3.

### Option C — no record: git's reflog is the "before" state

**Data structures.** None of yamt's on disk. Every ref update yamt makes carries `GIT_REFLOG_ACTION="yamt resolve !21"`;
Abort reads `HEAD@{n}` and the branch's reflog back to the first such entry to find where HEAD was, whether the branch
was created (its first reflog line) or moved (its previous value). The merge window knows the merge is yamt's when
HEAD's newest reflog entries are yamt's.

**Files.** `crates/gitio/src/reflog.rs` (read entries), the start in merge-requests, the restore in session.

**Risks.** `core.logAllRefUpdates=false`, `git reflog expire` or `gc` lose the before state (rule 7: a restart must not
lose it); any checkout by the user in between adds entries the parser must skip; "created vs moved" depends on the
branch reflog's first line; parsing reflog messages is the clever code vision 1 calls a defect; nothing is typed until
parsed (vision 4). Rule 8 has no fact to read except the reflog.

**Tests.** As A, plus reflog-off and expired-reflog repositories, which would fail rule 7 by construction.

**Visions.** 2 (git as the only source) in name; against 1 and 4.

## 4. Option A in detail

### 4.1 Who owns what (Q2)

| crate / module                                      | job                                                                                                                                                                                              | depends on                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `yamt-local-merge` (new, `crates/local-merge`)      | rule 4's checks, the fetch, checkout, merge, the record, restore, push, "is a merge in progress here, whose, is its window open", the window claim                                               | `yamt-gitio` only; serde, serde_json, specta, thiserror, tracing (all in §7 already) |
| `yamt-merge-requests` `resolve.rs`                  | `prepare_resolve`: glab, logged in, project, the branches query, open?, fork?, the remote; a branch with `:` refused (#132's rule, `open.rs:128-132`)                                            | unchanged (`gitio`, `range`)                                                         |
| `src-tauri` `merge_requests.rs`                     | `resolve_merge_request(iid)`: `prepare_resolve` → `yamt_local_merge::start` → `second_window::start_merge`; `continue_merge_request(iid)`: the live record → `start_merge`; `find_local_merge()` | adds `yamt-local-merge`                                                              |
| `src-tauri` `merge.rs`, `outcome.rs`, `commands.rs` | the merge window: the window claim at start-up, `Listing.merge_request`, Abort's restore, Continue's push offer, `push_merged_branch`, `close_ended_merge`, start-up on a clean recorded merge   | adds `yamt-local-merge`                                                              |

`scripts/arch-check.sh`: a rule for `yamt-local-merge` (only `yamt-(local-merge|gitio)` among `yamt-*`, no tauri) and
`local-merge` in yamt-app's allowed list (`scripts/arch-check.sh:72-84` pattern). The root `Cargo.toml` gains the member
and `yamt-local-merge = { path = "crates/local-merge" }` (orchestrator, shared path, before the `local` build).

### 4.2 The start, step by step (rules 4 and 5)

`yamt_local_merge::start(root, &MergeRequestBranches { iid, remote, branch, target }) -> Result<Started, Refusal>`.
Every git run goes through gitio (explicit argv, `LC_ALL=C`, cwd = root, architecture §3.2). Nothing in the checkout
changes before step 11; steps 1–10 refuse with nothing changed (the fetch in step 6 updates only GitLab's two
remote-tracking refs, as `git fetch` would; Abort leaves them — request rule 10).

1. `Repo::discover(root)`.
2. Open `<git dir>/yamt-merge-request.lock` and `try_lock` it → would block: `AlreadyMerging { iid: None }`. Held
   until `start` returns.
3. Read the record: live → `AlreadyMerging { iid: Some(record.iid) }`; unreadable or a newer format →
   `RecordUnreadable { path, message }`, file
   untouched; stale → removed (info log).
4. `Repo::stop()`: any operation → `Busy` (a merge, rebase, cherry-pick, revert, `am`, squash merge).
5. `Repo::has_tracked_changes()` (`status --porcelain=v1 -z --untracked-files=no`: staged, unstaged, unmerged) →
   `UncommittedChanges`. Untracked files pass; git refuses later if it would overwrite one (step 11/13 → restore).
6. `Repo::fetch_branches(remote, [branch, target], FETCH_TIMEOUT)`: `git fetch --no-tags --no-write-fetch-head
   --no-recurse-submodules --no-auto-maintenance --refmap= --quiet --end-of-options <remote>
   +refs/heads/<branch>:refs/remotes/<remote>/<branch> +refs/heads/<target>:refs/remotes/<remote>/<target>` with #132's
   no-prompt environment, killed at 120 s → `FetchFailed { message }` (git's first stderr line). Remote-tracking refs
   (not #132's ref-less fetch) because the created branch must track GitLab's (rule 5) and git names the merged branch
   in its default message ("Merge remote-tracking branch 'origin/main' into feature/due-dates").
7. `source = commit_named("refs/remotes/<remote>/<branch>")`, `goal = commit_named("refs/remotes/<remote>/<target>")`.
8. `local = commit_named("refs/heads/<branch>")`: none → `created`; `== source` → `unchanged`;
   `is_ancestor(local, source)` → `movedFrom(local)` (only behind: fast-forward); else → `LocalAhead { branch }`
   (yamt never drops a local commit — ahead or diverged alike).
9. `is_ancestor(goal, source)` → `AlreadyContains { branch, target }`: nothing to merge, GitLab's status is stale.
10. `returnTo`: `current_branch()` → `branch { name }` (not UTF-8 → `GitRefused`), detached → `detached { head_commit }`.
11. Write the record (sync + rename). Then `git checkout --quiet -B <branch> <source>`: creates, fast-forwards (we
    proved `local` is an ancestor) or re-checks-out the branch, and updates the worktree. Refused (another worktree has
    the branch, an untracked file in the way) → record removed, `GitRefused { message, left: [] }`: nothing changed.
12. Created → `git config branch.<branch>.remote <remote>` and `git config branch.<branch>.merge refs/heads/<branch>`
    (what `--track` writes, without depending on the remote's fetch refspec).
13. `git merge --no-ff --no-commit refs/remotes/<remote>/<target>` (no deadline, as Continue: a large merge takes
    long). Then `stop()` again: `Merge { merging: goal }` → `Started { branch, target, conflicts: !unmerged().is_empty() }`
    — `conflicts: false` is rule 5's stale "has conflicts". Anything else (git refused before writing `MERGE_HEAD`) →
    restore (§4.3) and `GitRefused { message, left }`.

Then `src-tauri` starts the merge window: `second_window::start_merge(root)` runs `yamt --repo <root>` exactly as #132
starts `--diff=` (same program rule, process group, reaper). Reusing it: one lifecycle for "yamt starts another yamt",
and the merge window is yamt's existing default mode, so no new flag (a flag would also be unknown to a later plain
`yamt` started by hand, which must find the merge too — §4.3). A spawn failure keeps the merge and the record:
`ResolveReply::WindowFailed { started, message }` ("… Run yamt in this repository to finish or abort it").

`outcome::startup` opens the window also when the stop lists no file **and** a live record exists, so a clean merge
yamt started shows the empty-stop view with "Commit merge" and Abort (rule 5's "the merge window still opens").
With a live record it first takes the window claim (`claim_window`, retrying `try_lock` every 50 ms for up to 1 s, so
a page's momentary probe never turns a starting window away); another window holding it → exit 2 "the merge of !21 is
already open in another yamt window" (a click of Continue racing the window that Resolve just started lands here,
harmlessly). The claim lives in the window's managed state until the process ends.

### 4.3 The record, Abort and a restart (rule 7)

- **Where:** the git dir of the checkout, through `rev-parse --git-path yamt-merge-request.json` — where git keeps its
  own `MERGE_HEAD`, so it lives exactly as long as the checkout, per worktree, and any yamt started later in that
  folder (a restart, a reboot, `yamt` typed in a terminal) finds it. Written before the first change with `sync_all`
  and rename, so a crash leaves the old file or the new one.
- **How the merge window knows:** `merge.rs` calls `yamt_local_merge::find_live(root)` on every `list_stop` and before
  Continue and Abort (derive, don't sync: principle 2). `Listing::Files.merge_request: Option<MergeView>`; the window
  never decides it.
- **Abort** (`merge.rs::abort_operation`): read the live record, then on the worker git's `merge --abort` (#88,
  unchanged), then `LiveMerge::restore()`:
  1. **Return:** if `returnTo` is the branch itself, nothing. Else, if HEAD is still on `branch` at `record.head`:
     `git checkout --quiet <name> --` or `checkout_detached(<commit>)`; refused → `ReturnRefused { to, message }`.
     HEAD elsewhere → `NotReturned { to }` (the user moved it; yamt leaves it).
  2. **Branch:** created → if `refs/heads/<branch>` is still `record.head` and not checked out: `git branch --quiet -D
     <branch>` (also drops the `branch.<branch>.*` config; git refuses it while any worktree has it); still
     `record.head` but checked out (the return was refused or not done) → `BranchCheckedOut { branch }` (#2012); moved →
     if still `record.head`: `git branch --quiet --force <branch> <from>`, or `git reset --quiet --keep <from>` when it
     is the checked-out branch; anything else → `BranchKept { branch }`; git's refusal → `BranchRefused { branch,
     message }`; unchanged → nothing.
  3. The record is removed.
     `AbortReply { leftovers }`: empty → the window is destroyed as today (#88); not empty → `Merge::Aborted` stays and
     the page shows a one-button notice listing them, whose Close calls `close_ended_merge`. Remote-tracking refs stay
     where the fetch put them; nothing reaches GitLab.
- **A start that fails after step 11** runs the same `restore` (no `merge --abort`: there is no merge).
- **Restart:** the record is read fresh from disk by every list; no state in memory carries it.
- **Changed by hand meanwhile:** only what still matches (`record.head`) is put back; the rest is listed, never forced.

### 4.4 Finishing and pushing (rule 6, #1996)

`merge.rs::continue_operation` reads the live record before handing the session to the worker. On
`Continued::Finished` with a live record: `LiveMerge::committed()` removes the record and returns a `PushOffer { remote,
branch }`; the state becomes `Merge::Committed { offer }` (not ended: the window stays) and the reply is
`ContinueReply::ReadyToPush { branch }`. The window asks (question `push`): "Push feature/due-dates to GitLab?" —
**Push** (confirm, focused) / **Keep Local**; Escape counts as Keep Local (never a push not asked for, RK45).

- Push → `push_merged_branch()` on a worker: `git push --porcelain --no-follow-tags --recurse-submodules=no
  --end-of-options <remote> refs/heads/<branch>:refs/heads/<branch>` — no `+`, no `--force`, the remote it came from,
  the no-prompt environment, 120 s (`PUSH_TIMEOUT`). `Pushed` → `Merge::Finished(Merge)`, the window is destroyed,
  exit 0 "merge finished". `Failed { message }` (the ref's porcelain summary such as "[rejected] (fetch first)", else
  git's first `fatal:`/`error:` line) → the state stays `Committed`; the window asks again (question `pushFailed`, git's
  words, **Push Again** / **Keep Local**).
- Keep Local → `close_ended_merge()`: `Committed` → `Finished`, the window is destroyed, exit 0.
- Either way the checkout stays on the merge request's branch (rule 6). Closing the window with its × while the
  question shows ends like Keep Local (exit 0 "merge finished").

### 4.5 Rules 8 and 9 and the window (Q4, Q5)

- `yamt_local_merge::local_merge(root) -> LocalMerge` = `Merging { iid, window_open }` while a live record exists
  (`window_open`: the window lock is held by another process, probed by one `try_lock` released at once), else `Free`
  (a git or record read problem → `Free` with a warning; rule 4 still refuses at the click). Command
  `find_local_merge()`; the page asks when it shows, when its window gains focus while the page is shown, and after
  every resolve or continue reply, so a merge started from another window, or a merge window closed meanwhile, shows
  as soon as the user comes back to the page. Another git operation in progress is not a "merge yamt started": it
  refuses at the click (rule 4), the button stays enabled.
- **Continue (rule 9, #1997).** `continue_merge_request(iid)`: `find_live(root)` none, or a record of another
  merge request → `Ended`; its window open → `AlreadyOpen`; else `second_window::start_merge(root)` → `Opened { branch,
  target }` or `WindowFailed { message }`. Nothing in git changes. A row that is not listed (filtered out, or no longer
  open on GitLab) offers no Continue; running `yamt` in the folder still finds the merge (§4.3).
- **Sources.** `MergeRequestSource` gains `resolveMergeRequest(iid) → ResolveReply`, `continueMergeRequest(iid) →
  ContinueMergeReply`, `findLocalMerge() → LocalMerge`. `ChunkSource.abortOperation()` answers `AbortReply`; it gains
  `pushMergedBranch() → PushReply` and `closeEndedMerge() → null`.
- **Page state** (`ui/mergeRequests.ts`): `actions: Map<MergeRequestIid, RowActing>` with `RowActing = { kind:
  "running" } | { kind: "replied"; reply: RowReply }`, `RowReply = { kind: "resolve"; reply: ResolveReply } | { kind:
  "continue"; reply: ContinueMergeReply }` (as `openings`), `localMerge: LocalMerge`, `resolve(iid)`,
  `continueMerge(iid)`, `checkLocalMerge()`.
- **Components.** `MergeRequestRow.vue` (size in the meta part, the readiness column, the row's action button, the
  reply line — `role="status"`, error colour only for refusals); new `MergeRequestReadiness.vue` (the icon with its
  hover and accessible name); `MergeRequestsView.vue` (passes `localMerge` and `actions`; focus listener).
- **Merge window.** `ui/listing.ts` keeps `mergeRequest: MergeView | null` beside `operation`; `ui/aborting.ts` asks
  `{ kind: "abort", operation, mergeRequest }` and after an `AbortReply` with leftovers asks `abortLeftovers`, then
  `closeEndedMerge`; `ui/continuing.ts` hands `ReadyToPush` to new `ui/pushing.ts`; `ui/question.ts` gains `push`,
  `pushFailed`, `abortLeftovers`, `QuestionText.cancel: string | null` (one button), the list kind `servers` renamed
  `lines` (it is any bullet list); `QuestionDialog.vue` draws one button when `cancel` is null; new `ui/leftoverText.ts`
  (the one wording of a leftover, used by the merge window and the page's `gitRefused` line).
- **Texts** (final; the briefs quote them): row replies — "Merging main into feature/x in a new window."; "main merges
  into feature/x without conflicts after all; check and commit it in the new window."; "Merging main into feature/x,
  but its window did not start: <message>. Run yamt in this repository to finish or abort it."; `alreadyMerging` —
  "The merge of !21 is not finished in this repository; continue or abort it first." (a live record) or "Another
  merge is starting in this repository; try again in a moment." (the start lock held); "git is in the middle of
  another operation (a merge, rebase, cherry-pick, …) in this
  repository; finish or abort it first."; "This checkout has uncommitted changes to tracked files; commit or stash them
  first."; "Could not fetch the branches of !12: <message>"; "Your local feature/x has commits that GitLab's feature/x
  does not have; yamt never drops a local commit. Push or move them first."; "feature/x already contains main: there
  is nothing to merge."; "git refused to start the merge: <message>" (+ " yamt could not put everything back: " and the
  leftovers joined by "; "); "yamt cannot read its record of an earlier merge (<path>): <message>. Delete it if no merge
  is in progress."; "!12 is no longer open."; "Resolving a fork's merge request is not supported."; "No remote of this
  repository points to <project>, so !12 cannot be fetched."; glab missing / logged out / failed: the page's existing
  sentences. Continue replies — "Merging main into feature/x in a new window." (`opened`); "The merge window of !12 is
  already open." (`alreadyOpen`); "The merge of !12 is no longer in progress." (`ended`); "The merge window did not
  start: <message>. Run yamt in this repository to finish or abort it." (`windowFailed`).
  Abort question — "Abort the merge of main into feature/x and return to develop?" ("… return to commit
  3f1c2a9?"; "Abort the merge of main into feature/x?" when it was already checked out), note "yamt deletes
  feature/x, which it created for this merge." / "feature/x goes back to 3f1c2a9, where it was before." / none.
  Leftovers — title "Merge Aborted", "The merge of main into feature/x is aborted, but yamt did not put everything
  back:", lines "HEAD moved after the merge started, so yamt did not check out develop again.", "git did not check out
  develop again: <message>", "feature/x changed after the merge started, so yamt left it as it is.", "feature/x is
  still checked out, so yamt did not delete it.", "git did not put feature/x back: <message>", button "Close". Push —
  title "Push to GitLab", "Push feature/x to GitLab?", note "The
  merge is committed on feature/x. Keep Local leaves it there; you can push it later.", "Push" / "Keep Local"; failed —
  title "Push Failed", "git did not push feature/x: <message>", note "The merge commit stays on your feature/x.",
  "Push Again" / "Keep Local".
- **Fixture scripts.** Page (`?mr=<script>`, every script): rows from `fixtureMergeRequestData.ts` get readiness by
  `index % 8` (0 conflicts, 1 conflicts from a fork, 2 ready, 3 needs rebase, 4 conflicts also blocked by
  discussions, 5 checking, 6 blocked pipeline must pass, 7 blocked other `"MERGE_TRAIN_STUCK"`); a draft row
  (`index % 7 == 6`) is conflicts with `draft` added to `also` when the cycle says conflicts, else blocked draft;
  size `null` when `index % 5 == 4`, else `{ additions: 12 * (index + 1), deletions: 5 * (index % 4), files: (index %
  6) + 1 }`. Resolve replies by iid (`fixtureMergeRequests.ts`): 640 started with conflicts, 632 started clean, 624
  refused `localAhead`, 616 `windowFailed`, other conflicts rows started; after a started or windowFailed reply
  `findLocalMerge` answers `merging { iid, windowOpen: false }`; `continueMergeRequest` of that iid answers `opened`
  and from then `windowOpen: true`, of another iid `ended`. Merge window
  (`?operation=merge&mergeRequest=<created|moved|unchanged|detached|same>`, plus `&clean` for an empty file list,
  `&push=rejected` for one failed push first, `&leftovers` for an abort that leaves two).

### 4.6 The IPC contract (full)

`yamt-local-merge` (`crates/local-merge/src/lib.rs`):

```rust
/// What resolving needs from GitLab: the merge request's branch, the branch it goes into and the remote holding both.
pub struct MergeRequestBranches { pub iid: u32, pub remote: String, pub branch: String, pub target: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(rename_all = "camelCase")]
pub struct Started { pub branch: String, pub target: String, pub conflicts: bool }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub enum Refusal {
    AlreadyMerging { iid: Option<u32> },            // Some: a live record's; None: another start holds the lock
    Busy, UncommittedChanges,
    FetchFailed { message: String },
    LocalAhead { branch: String },
    AlreadyContains { branch: String, target: String },
    GitRefused { message: String, left: Vec<Leftover> },
    RecordUnreadable { path: String, message: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub enum ReturnTo { Branch { name: String }, Commit { id: String } }          // id: the first 7 hex characters

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub enum Leftover {
    NotReturned { to: ReturnTo },
    ReturnRefused { to: ReturnTo, message: String },
    BranchKept { branch: String },
    BranchCheckedOut { branch: String },   // a created branch yamt could not delete: still checked out (#2012)
    BranchRefused { branch: String, message: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub enum BranchBefore { Created, MovedFrom { id: String }, Unchanged }        // id: 7 hex characters

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(rename_all = "camelCase")]
pub struct MergeView { pub branch: String, pub target: String, pub return_to: Option<ReturnTo>, pub branch_before: BranchBefore }
// return_to: None when the branch itself was checked out before

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub enum LocalMerge { Free, Merging { iid: u32, window_open: bool } }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub enum PushReply { Pushed, Failed { message: String } }

pub struct PushOffer { /* remote, branch: private */ }   impl PushOffer { pub fn branch(&self) -> &str; }
pub struct LiveMerge { /* root, record: private */ }
pub struct WindowClaim { /* the locked File: private */ }  // dropping it (or the process ending) releases the claim
#[derive(Debug, thiserror::Error)] pub enum Error { #[error(transparent)] Git(#[from] yamt_gitio::Error) }

pub fn start(root: &Path, branches: &MergeRequestBranches) -> Result<Started, Refusal>;
pub fn local_merge(root: &Path) -> LocalMerge;
pub fn find_live(root: &Path) -> Result<Option<LiveMerge>, Error>;   // an unreadable or newer record: Ok(None) + warn
/// Takes `<git dir>/yamt-merge-window.lock`, retrying `try_lock` every 50 ms for up to 1 s; Ok(None) when another
/// process still holds it.
pub fn claim_window(root: &Path) -> Result<Option<WindowClaim>, Error>;
/// One `try_lock` of the window lock, released at once: true when another process holds it.
pub fn window_is_open(root: &Path) -> bool;
impl LiveMerge {
    pub fn view(&self) -> MergeView;
    pub fn iid(&self) -> u32;
    pub fn restore(self) -> Vec<Leftover>;          // after git's merge abort; removes the record
    pub fn committed(self) -> PushOffer;            // after the merge commit; removes the record
}
pub fn push(root: &Path, offer: &PushOffer) -> PushReply;
```

`yamt-merge-requests`: §2's row types, plus

```rust
pub struct ResolveTarget { pub root: PathBuf, pub iid: MergeRequestIid, pub remote: String, pub branch: String, pub target: String }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub enum ResolveRefusal { NotOpen, FromFork, NoRemote { project: String }, GlabMissing, NotLoggedIn { detail: String }, Failed { message: String } }
pub fn prepare_resolve(repository: &GitLabRepository, glab: Option<&Glab>, iid: MergeRequestIid) -> Result<ResolveTarget, ResolveRefusal>;
```

`src-tauri`:

```rust
// merge_requests.rs
#[derive(Debug, serde::Serialize, specta::Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum ResolveReply {
    Started { started: Started },
    WindowFailed { started: Started, message: String },
    Refused { refusal: Refusal },
    GitLabRefused { refusal: ResolveRefusal },
}
#[derive(Debug, serde::Serialize, specta::Type)] #[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum ContinueMergeReply { Opened { branch: String, target: String }, AlreadyOpen, Ended, WindowFailed { message: String } }
async fn resolve_merge_request(window, iid: MergeRequestIid) -> Result<ResolveReply, IpcError>;
async fn continue_merge_request(window, iid: MergeRequestIid) -> Result<ContinueMergeReply, IpcError>; // no project → Ended
async fn find_local_merge(window) -> Result<LocalMerge, IpcError>;                 // no GitLab project → Free
// second_window.rs (range_window.rs renamed; clean cutover)
pub(crate) fn start_range(range: &RangeToOpen) -> OpenReply;                        // today's `start`
pub(crate) fn start_merge(root: &Path) -> Result<(), String>;                       // `yamt --repo <root>`
// merge.rs
pub(crate) enum Merge { Held(..), Running(..), MovedOn { .. }, Aborted(..), Committed { offer: PushOffer }, Finished(..) }
// MergeState also holds `_claim: Option<WindowClaim>` from start-up: held only to keep the lock, dropped with the process
pub enum Listing { Files { files, disk_changes, operation, sides, merge_request: Option<MergeView> }, MovedOn }
pub enum ContinueReply { Finished, ReadyToPush { branch: String }, Stopped { message: String } }   // tag "kind", PascalCase as today
#[derive(Debug, PartialEq, Eq, serde::Serialize, specta::Type)] pub struct AbortReply { pub leftovers: Vec<Leftover> }
// commands
abort_operation() -> Result<AbortReply, IpcError>        // destroys the window when ended and leftovers is empty
continue_operation() -> Result<ContinueReply, IpcError>  // destroys only on Finished (Committed is not ended)
push_merged_branch() -> Result<PushReply, IpcError>      // Committed only, else NoOperation; Pushed → Finished + destroy
close_ended_merge() -> ()                                // Committed → Finished; destroys when ended; else nothing
```

`Merge::session()` maps `Committed` to `MergeFinished`; `has_ended()` is false for `Committed`; the close ending of
`Committed` is `Finished`'s (exit 0 "merge finished").

TS (`frontend/src/ipc`): `domain.ts` aliases `MergeView`, `ReturnTo`, `BranchBefore`, `Leftover`, `AbortReply`,
`PushReply` (Readonly of the generated) and `Listing`'s `Files` gains `readonly mergeRequest: MergeView | null`
(`toListing` maps `merge_request`); `mergeRequestDomain.ts` aliases `Readiness`, `BlockedReason`, `ChangeSize`,
`Started`, `Refusal`, `ResolveRefusal`, `ResolveReply`, `ContinueMergeReply`, `LocalMerge`; `index.ts` exports all of
them.

### 4.7 Tests per layer, each with the bug it catches (Q6)

**gitio** (`crates/gitio/tests/branch.rs`, `push.rs`, `fetch.rs`; real tempdir repositories, hermetic git, RK19):
`fetch_branches_writes_only_the_two_remote_tracking_refs` (a configured refspec or `FETCH_HEAD` written behind our back);
`fetch_branches_never_prompts` (the env of #132 lost); `checkout_branch_at_creates_fast_forwards_and_keeps_upstream`
(a reset branch losing its `branch.*` config); `is_ancestor_answers_both_ways_and_fails_on_an_unknown_commit` (exit 1
read as an error, or 128 as false); `has_tracked_changes_ignores_untracked_files_and_sees_staged_and_unmerged`;
`branch_force_keeps_the_upstream_config` `[measures the INFERENCE of §4.3]`; `a_rejected_push_names_the_ref_and_reason`
(stderr's "To …" line shown instead); `a_push_never_forces` (a diverged remote stays as it was).

**local-merge** (`crates/local-merge/tests/`, repositories from `scripts/mr-conflict-repo.sh`):

- rule 4: `uncommitted_tracked_changes_refuse_and_change_nothing`, `an_untracked_file_does_not_refuse`,
  `another_operation_in_progress_refuses` (a rebase stop), `a_failed_fetch_refuses_with_gits_sentence`,
  `a_local_branch_with_its_own_commit_is_refused_and_nothing_changes` (HEAD, branches, index, worktree, no record —
  RK43), `a_branch_that_already_contains_the_target_is_refused`.
- rule 5: `a_missing_branch_is_created_tracking_gitlab_and_the_merge_stops_with_conflicts`,
  `a_branch_only_behind_is_fast_forwarded`, `a_stale_has_conflicts_merges_clean_and_still_stops` (MERGE_HEAD, no
  unmerged entry), `an_untracked_file_the_merge_would_overwrite_puts_everything_back` (RK44).
- rule 7: `abort_after_a_restart_returns_to_develop_and_deletes_the_created_branch` (the record read by a fresh
  `find_live`, nothing in memory), `abort_moves_a_fast_forwarded_branch_back`, `abort_from_a_detached_head_returns_to_the_commit`,
  `abort_keeps_a_branch_that_moved_after_the_merge_started` (RK43), `abort_leaves_head_where_the_user_moved_it`.
- rule 8: `a_second_start_while_a_merge_is_in_progress_is_refused` (`AlreadyMerging { iid: Some(21) }`),
  `a_start_while_another_holds_the_lock_is_refused` (`iid: None`),
  `local_merge_is_merging_only_while_git_is_in_the_recorded_merge`, `a_stale_record_is_dropped_at_the_next_start`,
  `an_unreadable_record_refuses_and_stays_untouched`.
- rule 9: `local_merge_names_the_merge_request_and_whether_its_window_is_open`,
  `a_second_claim_fails_while_the_first_is_held_and_succeeds_once_it_is_dropped`,
  `window_is_open_probe_never_turns_away_a_claim` (a probe in a loop on another thread beside `claim_window`: the
  claim succeeds). (A lock held by an ended process is free: flock(2) releases it with the last descriptor, the
  kernel's guarantee, not a test.)
- rule 6: `committed_removes_the_record_and_push_sends_only_the_branch`, `a_rejected_push_leaves_gitlab_and_the_commit`
  (RK45).
- unit: `is_live` (each mismatch: another `merging`, another `head`, another branch, no operation); record round-trip
  and a newer `format` refused.

**merge-requests** (`page.rs` units over recorded pages; `tests/resolve.rs` with the fake glab on scenario
`mr-conflicts/` and `scripts/range-repo.sh`'s repository, whose `origin` is the project): every `DetailedMergeStatus`
value folds as §2 (a missed variant), null status → checking, an unknown → `Other` (a silent `Ready`), a null summary
→ no size, a fork row; conflicts first: `conflicts: true` with `DRAFT_STATUS` → `Conflicts { also: [Draft] }`, with
`CI_MUST_PASS` on a draft → `Conflicts { also: [PipelineMustPass, Draft] }`, with `MERGEABLE`/`CHECKING` → `also: []`,
`CONFLICT` with `conflicts: false` → `Conflicts` (GitLab's status still wins over a stale flag) (a blocked row hiding
its conflicts); `prepare_resolve`: `NotOpen` (merged !30), `FromFork` (!22), `NoRemote`, glab missing, logged
out, a `:` branch refused, the exact argv of the branches query (`-f fullPath=… -f iid=21`).

**src-tauri** (`merge/tests.rs`, `merge_requests/tests.rs`, `outcome.rs`): `abort_of_a_merge_yamt_started_restores_and_closes`
(RK44); `abort_with_leftovers_keeps_the_window_and_answers_them`; `continue_on_a_recorded_merge_answers_ready_to_push_and_keeps_the_window`;
`push_merged_branch_pushes_and_ends_with_exit_0`; `a_rejected_push_keeps_the_merge_committed_and_the_window`;
`push_merged_branch_refuses_unless_a_recorded_merge_was_just_committed` (RK45); `close_ended_merge_after_keep_local_ends_with_exit_0`;
`startup_opens_a_clean_merge_yamt_started` (and still "nothing to merge" without a record);
`startup_refuses_a_second_window_on_a_recorded_merge` (exit 2 while a claim is held);
`list_names_the_recorded_merge` (and `null` for a user's own merge); resolve through the command: each `GitLabRefused`
and `Refused` reaches the reply, `Started` with an injected window start; continue through the command: `Ended` (no
record, another iid), `AlreadyOpen` (a claim held), `Opened` and `WindowFailed` with an injected window start;
`start_merge` arguments `--repo <root>`.

**Web, node** (`pnpm -C frontend test <file>`): `readiness.test.ts` (every reason's words; conflicts with and without
`also`; one state per row), `size.test.ts` (singular forms, the minus sign), `rowAction.test.ts` (Continue on the
merging row whatever its readiness, disabled while its window is open; none unless conflicts; fork before another
merge; another merge names its iid), `mergeRequests.test.ts` (a resolve's and a continue's running/replied map,
`localMerge` re-read at show, focus and after every reply),
`mergeRequestsText.test.ts` (every `ResolveReply` and `ContinueMergeReply` sentence), `leftoverText.test.ts`, `question.test.ts` (abort words
for each `BranchBefore` and return place; push, pushFailed, leftovers; one-button text), `pushing.test.ts` (Push →
pushes once; Escape and Keep Local never push, RK45; a failure asks again with git's words), `aborting.test.ts`
(leftovers → notice → `closeEndedMerge`), `continuing.test.ts` (`ReadyToPush` → push question, no window end),
`fixtureOperations.test.ts`, `fixtureMergeRequests.test.ts`.

**WebKit fixture steps** (`just app-session start-fixture`): page — `--diff --mr list`, open the page, read row !640's
size and readiness hover, !636's "Has conflicts. Also blocked: discussions are unresolved", the fork row's disabled
hover, click Resolve on !640 → the row's sentence and its button now "Continue merging !640", every other conflicts
row's button disabled with rule 8's hover, click Continue → "Merging main into feature/fixture-640 in a new window."
and Continue disabled "Its merge window is already open", screenshot; merge window — `start-fixture --name w`, then
`read "location.assign('/?operation=merge&mergeRequest=created')"`, Abort → the question's words; `…&leftovers` →
the one-button notice; `…&mergeRequest=created&clean&push=rejected` → Commit merge → push question → Push → the
failed question with "[rejected] (fetch first)" → Keep Local.

**Real app** (`cargo tauri build --debug --no-bundle`, then `just app-session`, private display, #136), on
`scripts/mr-conflict-repo.sh /var/tmp/yamt-mrc`. A merge window the app starts itself is not an `app-session` window;
to drive one, end it with `pkill -f 'yamt --repo /var/tmp/yamt-mrc'` and start `start-app --repo` instead (the claim
lets only one window hold the merge):

1. `start-app --name c --diff --dir /var/tmp/yamt-mrc --glab mr-conflicts`; open the page: !21 shows `+120 −40 · 6
   files` and "Has conflicts"; !22 (fork) shows a disabled Resolve; !27 shows no size (rules 1–3).
2. Click "Resolve conflicts of !21" → "Merging main into feature/due-dates in a new window."; `git -C … status` shows
   unmerged paths on `feature/due-dates`, `git -C … rev-parse --abbrev-ref feature/due-dates@{u}` →
   `origin/feature/due-dates`; `shot --display` shows the second window; every other Resolve is disabled with rule 8's
   hover and !21 offers "Continue merging !21", disabled "Its merge window is already open" (rules 5, 8, 9).
   Close the second window (`pkill -f 'yamt --repo /var/tmp/yamt-mrc'`: a crash must free its claim too), focus the
   compare window → "Continue merging !21" enabled; click → the merge window opens again, on the same unmerged files
   (rule 9). !31 (a draft that conflicts) shows "Has conflicts. Also blocked: it is a draft" and a Resolve (rule 2).
3. Rule 4: with a tracked file edited, Resolve on a fresh repository → the uncommitted sentence, `git status` unchanged.
4. `pkill -f 'yamt --repo /var/tmp/yamt-mrc'` (the merge window gone, as after a crash or reboot), then `start-app
   --name m --repo /var/tmp/yamt-mrc` (a restart); a second `start-app --name m3 --repo /var/tmp/yamt-mrc` now exits 2
   "the merge of !21 is already open in another yamt window" (RK47). In `m`: Abort → "Abort the merge of main into
   feature/due-dates and return to develop?" → confirm → window gone; `git branch --show-current` → `develop`,
   `feature/due-dates` gone, no record (rule 7).
5. Resolve !21 again, `pkill` its window, `start-app --name m2 --repo …`, take a side for each file, Commit merge →
   "Push
   feature/due-dates to GitLab?" → Push → `git --git-dir …/.git/fake-gitlab.git log -1 --format=%s feature/due-dates`
   → "Merge remote-tracking branch 'origin/main' into feature/due-dates"; the checkout stays on the branch (rule 6).
6. Resolve !23 (`feature/clean`) → "main merges into feature/clean without conflicts after all; …"; the merge window
   opens on the empty-stop view with Commit merge and Abort (rule 5).
7. A commit added to `feature/due-dates` in the fake GitLab before Push → the failed question with "[rejected]" →
   Keep Local; the fake GitLab's branch unchanged (rule 6, RK45).

### 4.8 Risk register rows and plan rows to propose (Q7, DR5)

Risk rows (append to `skill://risk-register`):

| id   | risk                                                                                                                                                              | owner                                                                                                                                                                                                                           | proving test                                                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RK43 | resolving or aborting loses a local commit: a branch with its own commits reset to GitLab's, or a branch moved or deleted by Abort after the user committed on it | `yamt-local-merge` `start` (ahead check before any write; `checkout -B` only to a commit containing the local tip) + `restore` (moves or deletes only a tip equal to the recorded `head`)                                       | `a_local_branch_with_its_own_commit_is_refused_and_nothing_changes`, `abort_keeps_a_branch_that_moved_after_the_merge_started`                                                                       |
| RK44 | after Abort (or a failed start) the user's checkout is left on the wrong branch, or a restart loses what Abort must restore                                       | `yamt-local-merge` record (git dir, synced and renamed before the first change; read fresh by every list) + `restore` order (merge abort, return, branch) + `src-tauri` `merge.rs`                                              | `abort_after_a_restart_returns_to_develop_and_deletes_the_created_branch`, `an_untracked_file_the_merge_would_overwrite_puts_everything_back`, `abort_of_a_merge_yamt_started_restores_and_closes`   |
| RK45 | a push the user did not ask for, or a forced push                                                                                                                 | `yamt-local-merge` `push` + gitio `push_branch` (explicit `refs/heads/<b>:refs/heads/<b>`, no `+`, no `--force`, no prompt) + `src-tauri` `push_merged_branch` (Committed only) + `ui/pushing.ts` (only the Push answer pushes) | `a_push_never_forces`, `a_rejected_push_leaves_gitlab_and_the_commit`, `push_merged_branch_refuses_unless_a_recorded_merge_was_just_committed`, `pushing.test.ts` "Escape and Keep Local never push" |
| RK46 | two windows start merges in one checkout at once and one record overwrites the other's "before"                                                                   | `yamt-local-merge` lock file (`File::try_lock`) + live-record check                                                                                                                                                             | `a_start_while_another_holds_the_lock_is_refused`, `a_second_start_while_a_merge_is_in_progress_is_refused`                                                                                          |
| RK47 | two merge windows on one recorded merge (Continue clicked twice, or racing the window Resolve started) and one's saves overwrite the other's                      | `yamt-local-merge` window claim (`claim_window`, released by the kernel at process end) + `src-tauri` `outcome::startup` (refuses without the claim) + `continue_merge_request` (`AlreadyOpen`)                                 | `a_second_claim_fails_while_the_first_is_held_and_succeeds_once_it_is_dropped`, `startup_refuses_a_second_window_on_a_recorded_merge`, `window_is_open_probe_never_turns_away_a_claim`               |

Plan §2 rows to propose (the orchestrator records them; numbers as the next free ones):

- **#138 Each merge-request row shows its size and GitLab's merge status** (owner 2026-10-30, #1995, #1998, request
  `docs/slices/request-mr-conflicts.md` rules 1–3; design `briefs/mr-conflicts-design.md` option A). The list query
  (#131) adds `detailedMergeStatus conflicts diffStatsSummary { additions deletions fileCount } sourceProjectId
  targetProjectId`; `MergeRequestRow` gains `size: Option<ChangeSize>` (none for a null summary), `readiness:
  Readiness` (ready | conflicts { also } | needsRebase | checking | blocked { reason }: GitLab's 24
  `DetailedMergeStatus` values folded once in `page.rs`, missing/CHECKING/UNCHECKED/PREPARING/APPROVALS_SYNCING →
  checking, an unknown value → blocked with GitLab's word and a warning; conflicts first — GitLab's `conflicts` flag
  or `CONFLICT` make it conflicts, `also` holding the blocked reason of the status and draft) and `fromFork`
  (`sourceProjectId ≠ targetProjectId`). Words and the row's action rule in `frontend/src/mergeRequests/`; one icon in
  a fixed column right of the CI box; "Resolve conflicts of !12" only on a conflicts row, disabled for a fork. |
  Rejected: `mergeStatusEnum` (no reasons); the status alone (a draft that conflicts gets no Resolve, #1998); two
  icons per row (rule 2: one state); REST (a call per MR); words in Rust (the window owns words). | 2, 4, 1
- **#139 Resolving a merge request's conflicts is the crate `yamt-local-merge`** (owner #1995: in your own checkout;
  amends §7, PM1, `scripts/arch-check.sh`): gitio only; `yamt-merge-requests` `prepare_resolve` asks GitLab for the
  branches; `src-tauri` composes and starts `yamt --repo <root>` through #132's start (`second_window.rs`). The
  order of §4.2: lock, record, any git operation, tracked changes, the fetch into `refs/remotes/<remote>/` with
  `--refmap=` and #132's no-prompt environment, the local branch (created / unchanged / fast-forwarded / ahead
  refused), target already contained refused, the record, `checkout -B`, upstream for a created branch, `merge
  --no-ff --no-commit`; a refusal after the checkout puts everything back. | Rejected: a module of merge-requests
  (#117: a second job that writes refs); session (the merge window's state machine learns GitLab); the new window
  starting the merge (a refusal could not reach the row); #132's ref-less fetch (no upstream; the message names a
  commit id); `update-ref` for moves (ignores a branch checked out in another worktree); git's reflog as the record
  (option C). | 2, 3, 4, 1
- **#140 Abort's "before" is a record in the git dir; the merge window finds it on every list** (owner "with abort"):
  `yamt-merge-request.json` format 1 through `rev-parse --git-path`, synced and renamed before the first change, live
  only while git is in that merge at that head on that branch; Abort = `merge --abort`, then back to the branch or
  commit before while HEAD is still the branch, then the created branch deleted or the moved one moved back while it is
  still at the recorded head; what does not match stays and is listed in a one-button notice; one start at a time by a
  lock file and the live record; one merge window per recorded merge by a second lock file held for the window's life;
  the page reads `find_local_merge` at show, focus and after a reply. | Rejected: the
  app data folder (keyed by a path; git keeps its own merge state in the git dir); a `refs/yamt/*` ref (#132); the
  reflog (off or expired loses it); a `--resolve` window flag (a later plain `yamt` would not know); deciding it once
  at open (a second source for "is this yamt's"). | 2, 4, 1
- **#141 Finishing a merge yamt started commits, then asks to push** (owner #1996): Continue answers `ReadyToPush`,
  the record goes, the window asks "Push feature/x to GitLab?" (Push / Keep Local; Escape keeps it local); Push is
  `push --porcelain --no-follow-tags --recurse-submodules=no <remote> refs/heads/<b>:refs/heads/<b>`, never forced, no
  prompt, 120 s; pushed → the window closes, exit 0; refused → asked again with git's words; Keep Local → closes; the
  checkout stays on the branch. | Rejected: pushing inside Continue (not asked); `push.default`/the upstream (one
  explicit branch); the question in the page's window (it does not hold the commit). | 4, 1, 2
- **#142 Defaults decided with the conflicts design** (orchestrator, OR13; the owner may veto): the fetch updates
  `origin/<branch>` and `origin/<target>` as `git fetch` would and Abort leaves them; git's default message for a
  remote-tracking branch; a branch already containing the target is refused; a stale record is dropped at the next
  start; an unreadable record refuses resolving and counts as none in the merge window; another git operation refuses
  at the click but does not disable the buttons; leftovers show in a one-button notice, then the window closes; a
  successful push closes the window; closing it during the push question keeps the merge local. | — | 1, 5
- **#143 An unfinished merge yamt started is continued from its row** (owner #1997, request rule 9): `LocalMerge`
  is `merging { iid, windowOpen }`; that row offers "Continue merging !12" in place of Resolve, whatever its readiness,
  disabled while its window is open; a click runs `continue_merge_request(iid)`, which starts `yamt --repo <root>`
  again when the record is still live and no window holds the claim (`opened` / `alreadyOpen` / `ended` /
  `windowFailed`). Nothing in git changes. | Rejected: a pid file (stale after a crash; a lock is released by the
  kernel); focusing the open window from another process (no channel between yamt processes); Continue in the merge
  window's own menu (the user is on the page). | 1, 2, 4

## 5. Builds and the slice graph

| build    | agent     | owns (summary; full lists in the briefs)                                                                                                                                                                                                                                                                                          | needs             | estimate `[INFERENCE]` |
| -------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------- |
| `git`    | rust-impl | `crates/gitio/**` changes and tests                                                                                                                                                                                                                                                                                               | —                 | ~700 lines, 8 files    |
| `gitlab` | rust-impl | `crates/merge-requests/**`, `tests/glab/merge-requests/graphql-page-*.json`, `tests/glab/merge-requests-timeout/graphql-page-1.json`, `tests/glab/mr-conflicts/**`, `tests/glab/README.md`, `frontend/src/ipc/{fixtureMergeRequestData.ts,fixtureMergeRequestData.test.ts,mergeRequestDomain.test.ts,tauriMergeRequests.test.ts}` | —                 | ~1,200 lines, 22 files |
| `local`  | rust-impl | `crates/local-merge/**`, `scripts/mr-conflict-repo.sh`, `scripts/arch-check.sh`                                                                                                                                                                                                                                                   | `git`             | ~1,450 lines, 15 files |
| `app`    | rust-impl | `src-tauri/**` changes, `frontend/src/ipc/{domain.ts,mergeRequestDomain.ts,index.ts}`                                                                                                                                                                                                                                             | `gitlab`, `local` | ~1,350 lines, 16 files |
| `window` | web-impl  | the merge window's `ipc/` sources and `ui/` files                                                                                                                                                                                                                                                                                 | `app`             | ~1,200 lines, 26 files |
| `page`   | web-impl  | the page's `ipc/` sources, `ui/` files, `frontend/src/mergeRequests/**`, `ui/AGENTS.md`, `ipc/AGENTS.md`                                                                                                                                                                                                                          | `window`          | ~1,500 lines, 22 files |

`git` ∥ `gitlab` first (at most two implementers). `local` starts once `git` is committed (beside `gitlab` if it still
runs). `app` waits for both. `window` follows `app`: `app` changes `abort_operation`'s reply and `Listing`, so between
`app`'s commit and `window`'s the web typecheck and `tauri.test.ts` fail in `window`'s own files (`ipc/tauri.ts`,
`ipc/fixtureOperations.ts`, `ui/store.test.ts`, …), which `window` repairs first. `page` follows `window` (it uses
`ui/leftoverText.ts` and starts on a green tree). The `page` build wires the page together end to end; its commit
starts the verifier's smoke pass (§4.7 real-app steps).

## 6. Cost of the recommendation

- About 7,400 changed lines over six builds (§5 per build `[INFERENCE]`); one new crate (13 files), one new script,
  one new fake-glab scenario. The owner's answers #1997/#1998 add about 600 of them (the window claim, Continue,
  conflicts first); the rest replaces the first rough total of ~5,500 by a per-build estimate.
- One more PM1 rule and §7 entry; architecture §3.2 (gitio's new runs), §3.5 (commands, `Merge::Committed`, the window
  claim, the second process now starts two kinds of window), §3.10 (the new crate), §4 and the IPC-contract skill
  (seven commands changed or new), §5.4 (page and merge-window components) — the docs keeper's pass.
- A transient red web typecheck between the `app` and `window` commits (§5).
- `local` and `page` sit near the implementer budget; if either reports over 1,500 changed lines, `local` splits its
  tests' shared helpers out first and `page` moves `rowAction.ts` and its test into a separate build.

## 7. Owner answers (formerly open questions)

1. Continue merging (#1997, request rule 9): yes — §2 "The row's action rule", §4.5 "Continue", plan row #143.
2. Conflicts first (#1998, request rule 2): GitLab's `conflicts` flag decides; the hover lists the other blockers —
   §2 "One fold", plan row #138.
3. Remote-tracking branches (request rule 10, orchestrator default): Abort leaves `origin/<target>` and
   `origin/<branch>` where the fetch put them — §4.2, plan row #142.

No product question is open.
