# Local conflict check — design

Request: `docs/slices/request-local-conflict-check.md` (rules 1–8 settled; this design refines only the details it
names). Measured facts: `.omp/run/notes/PlanLocalConflictFacts.md` (git 2.56, gitlab.com, 2026-11-02; used as given).
Designer: `LocalConflictsDesign`, 2026-11-02. Recommended: option A, slices `local-conflicts-gitio.md` →
`local-conflicts-check.md` → `local-conflicts-page.md` (the last one wires the window together).

## 1. The request's "to be measured", closed

| item                                                                 | answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | source                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GraphQL head-commit field                                            | **`diffHeadSha`** (`String`, nullable, `calls_gitaly`), "Diff head SHA of the merge request". `sha` is the REST name of the same value (`[].sha`, "Diff head SHA of the merge request"); GraphQL's `MergeRequest` has no `sha` field among its fields. The list query also needs **`targetBranch`** (`String!`), which it does not ask today (`query.rs:27-38`).                                                                                                                                                                                                                   | `gitlabhq` v17.10.0 `app/graphql/types/merge_request_type.rb:25-26` (`diff_head_sha`), `:57-58` (`target_branch`, `null: false`); docs.gitlab.com/api/merge_requests (`sha`). No `field :sha` matched in that file: `[INFERENCE]` none exists |
| What `diffHeadSha` is                                                | `merge_request_diff.head_commit_sha` once the diff exists, else the source branch's head                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `app/models/merge_request.rb:1301-1305` (master)                                                                                                                                                                                              |
| `refs/merge-requests/<iid>/head` moves on every push, forks included | Yes, by the same step that makes the new diff: `create_merge_request_diff` first runs `fetch_ref!`, which writes `refs/merge-requests/<iid>/head` in the **target** project's repository from the **source** project's branch (a fork's too), then creates the diff whose head becomes `diffHeadSha`. `RefreshService#reload_merge_requests` calls `reload_diff` on every push to an open merge request's branch ("we should update merge requests from forks too"). The ref is written _before_ the diff, so between the two the ref is ahead of `diffHeadSha`: rule 5's mismatch | `merge_request.rb:1521-1522`, `:2207-2209`, `:2220-2221`; `app/services/merge_requests/refresh_service.rb:183-218` (master)                                                                                                                   |
| `ls-remote` sees it                                                  | Yes on gitlab.com (`refs/merge-requests/6008/head`, 1.1 s, branch and glob patterns in one call). GitLab documents the head ref as "available for each merge request … even if the source project is a fork (even a private fork)"                                                                                                                                                                                                                                                                                                                                                 | facts file §ls-remote; docs.gitlab.com `user/project/merge_requests/merge_request_troubleshooting` "Check out merge requests locally through the head ref"                                                                                    |
| Self-hosted setups hiding it                                         | No GitLab document found that hides it; an administrator can hide refs from upload-pack through git's `uploadpack.hideRefs`/`transfer.hideRefs` in Gitaly's git config `[INFERENCE]`. Then `ls-remote` prints no such line → the row keeps GitLab's answer (rule 8), counted in the load's log line                                                                                                                                                                                                                                                                                | —                                                                                                                                                                                                                                             |
| What one `ls-remote` costs                                           | git sends no ref prefixes for `ls-remote` patterns (they tail-match), so the server advertises all its refs and git filters them: the cost is the whole advertisement, whatever the patterns                                                                                                                                                                                                                                                                                                                                                                                       | Jeff King, "[PATCH 1/2] ls-remote: do not send ref prefixes for patterns", git mailing list 2018-10-31 (public-inbox `20181031042405.GA5503@sigill.intra.peff.net`); measured 1.1 s on gitlab-runner (facts file)                             |
| `merge-tree --write-tree`                                            | first in **git 2.38.0** ("learned a new mode where it takes two commits and computes a tree …")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `Documentation/RelNotes/2.38.0.txt:16-18`                                                                                                                                                                                                     |
| `merge-tree --quiet` (merge without writing objects)                 | first in **git 2.50.0** ("learned an option to see if it resolves cleanly without actually creating a result"); absent from git-scm's 2.49.0 page, present on 2.50.0's. Measured: 0 objects written (facts file)                                                                                                                                                                                                                                                                                                                                                                   | `Documentation/RelNotes/2.50.0.adoc:82-83`; git-scm.com/docs/git-merge-tree/2.49.0 vs /2.50.0                                                                                                                                                 |
| `merge-tree --stdin`                                                 | present in the 2.49.0 page; refuses `--quiet` (exit 128, facts file); writes objects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | git-scm.com/docs/git-merge-tree/2.49.0                                                                                                                                                                                                        |
| `fetch --no-write-fetch-head`                                        | **git 2.29.0**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `Documentation/RelNotes/2.29.0.txt:47-48`                                                                                                                                                                                                     |
| `fetch --no-auto-maintenance`                                        | **git 2.29.0** (`--[no-]auto-gc` its synonym)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | git-scm.com/docs/fetch-options/2.29.0 `--[no-]auto-maintenance`                                                                                                                                                                               |
| yamt's minimum git                                                   | **None stated.** plan §2 has no minimum; README names Git for Windows without a version (`README.md:64-65`); CI uses each runner image's git unpinned (`.github/workflows/ci.yml:20-25`: ubuntu-22.04, macos-15, windows-2025). The one version gate is `session/src/start.rs:19-23` (`HISTOGRAM_SINCE` 2.44, plan #53). In practice the merge-request page needs 2.29 already (`fetch.rs:10-19`, #132). Debian 13 ships 2.47.3 (manpages.debian.org listing); macOS's Apple git is 2.39.5 (the string `version.rs:42` parses) `[INFERENCE]` for stock Xcode tools                 | as cited                                                                                                                                                                                                                                      |
| One fetch rule                                                       | `open.rs:117-138` `fetch_unless_local` → `Repo::fetch_without_refs` (`fetch.rs:26-33`: no ref, no `FETCH_HEAD`, no maintenance, no prompt, 120 s) of `refs/merge-requests/<iid>/head` and `refs/heads/<target>`. `fetch_branches` (`fetch.rs:39-51`) writes `refs/remotes/<remote>/<b>` and belongs to resolving (#139, #142) only. The check uses `fetch_without_refs` with the same two refspec forms: one rule                                                                                                                                                                  | facts file §git fetch                                                                                                                                                                                                                         |
| Fit with #132                                                        | Same rule: no fetch when every commit of the pairs to merge is local (one `cat-file --batch-check` decides), else one `fetch_without_refs` from `remote_for` (the remote #132 uses). Fetching by name is rule 6's own wording                                                                                                                                                                                                                                                                                                                                                      | `open.rs:123-137`                                                                                                                                                                                                                             |
| Fit with #131                                                        | The query gains `targetBranch diffHeadSha`, stays one line; `queryComplexity` stays logged at info on the first page. Score change `[INFERENCE]` +1 or +2 (`calls_gitaly` on `diffHeadSha`); read in the owner check's log                                                                                                                                                                                                                                                                                                                                                         | `list.rs:45-51`, `query.rs:15-41`                                                                                                                                                                                                             |
| Fit with #138                                                        | GitLab's fold (`page.rs:296-328`) is unchanged for a row without a local result; it moves to its own file and gains the local fold (rules 2, 3). "Words in the window" (#138) holds: the new state's words live in `frontend/src/mergeRequests/`                                                                                                                                                                                                                                                                                                                                   | plan §2 #138                                                                                                                                                                                                                                  |
| Fit with #135 / #131 loads                                           | Refresh is disabled only while a load runs (#135); the load still ends at `end`, so a Refresh can start while the previous load's check runs — handled in §3                                                                                                                                                                                                                                                                                                                                                                                                                       | plan §2 #131, #135                                                                                                                                                                                                                            |
| Fit with #94/#130                                                    | The compare window "runs git … only for the merge-request page"; the check adds `version`, `ls-remote`, `cat-file`, `merge-tree` on each load (not at start; #130's offline start is unchanged) — §3.5's sentence is amended                                                                                                                                                                                                                                                                                                                                                       | `docs/architecture.md:492-496`                                                                                                                                                                                                                |
| Cost of one merge                                                    | gitlab-runner (1,466 files, 719 MiB pack), `--quiet`: 9–10 ms for a merge 2,049 commits behind that conflicts, 3–5 ms for a clean one changing 1,524 files; 11–12 ms without `--quiet`; peak ≈ 41 MB per git child. A monorepo: `[INFERENCE]` tens to hundreds of ms                                                                                                                                                                                                                                                                                                               | facts file, last section                                                                                                                                                                                                                      |

## 2. What every option shares

### 2.1 Data structures (vision 4, `skill://principles` §3)

```rust
// yamt-gitio
pub enum MergeOutcome { Clean, Conflicts }                 // git's answer for two commits
pub enum MergeTreeRun { Quiet /* ≥ 2.50: no object */, Writing /* 2.38–2.49: unreferenced objects */ }
impl MergeTreeRun { pub fn for_version(version: GitVersion) -> Option<MergeTreeRun>; } // None before 2.38
pub struct RemoteRef { pub name: Vec<u8>, pub id: Oid }    // one advertised ref

// yamt-merge-requests — IPC
pub enum Readiness { Ready, Conflicts { also }, NeedsRebase, Checking, Blocked { reason }, MergesCleanly }
pub struct CheckedRow { pub iid: MergeRequestIid, pub readiness: Readiness }

// yamt-merge-requests — not IPC
pub(crate) struct GitLabMerge { status: MergeStatus, conflicts: bool, draft: bool } // read once per row
pub(crate) enum MergeStatus { Mergeable, Conflict, NeedsRebase, Unchecked, Blocked(BlockedReason) }
pub(crate) struct RowToCheck { iid, target_branch: String, head: Option<Oid> /* diffHeadSha */, gitlab: GitLabMerge }
pub struct ConflictCheck { full_path: String, rows: Vec<RowToCheck> } // made only by a listing that reached a project
pub struct MergedPairs(HashMap<(Oid, Oid), MergeOutcome>);           // (target commit, source commit)
pub struct CheckSummary { rows, merges, fetched_refs, remembered, moving, kept: u32, problem: Option<String> }
```

**Readiness shape (rule 3).** One new variant, `mergesCleanly`, no payload. Rejected: `checking { cleanLocally:
bool }` (a flag that changes what the variant means — a bag of fields, principles §1); a second row field
`local: LocalConflicts` beside `readiness` (two sources for the one icon #138 asks for, and the fold would move into
the window, vision 2); a payload `also` with `draft` (a draft's title already starts "Draft: ", `lib.rs:200`, and GitLab's
blockers are exactly what is unknown in this state). A row reaches `mergesCleanly` only from `readiness_after(Clean)`
with GitLab's status `Unchecked` or `Conflict` — the one constructor besides tests (vision 4).

**The fold (rules 2, 3; one place, vision 2)** — `readiness.rs`, moved out of `page.rs:296-356`:

| GitLab's status (`MergeStatus`)                                          | no local result (today, unchanged)                                           | local `Conflicts`                 | local `Clean`       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------- | ------------------- |
| `Mergeable`                                                              | `ready` (or `conflicts { also: [draft?] }` when the `conflicts` flag is set) | `conflicts { also: [draft?] }`    | `ready`             |
| `Conflict`                                                               | `conflicts { also: [draft?] }`                                               | `conflicts { also: [draft?] }`    | **`mergesCleanly`** |
| `NeedsRebase`                                                            | `needsRebase` / flag → `conflicts`                                           | `conflicts { also: [draft?] }`    | `needsRebase`       |
| `Unchecked` (CHECKING, UNCHECKED, PREPARING, APPROVALS_SYNCING, missing) | `checking` / flag → `conflicts`                                              | `conflicts { also: [draft?] }`    | **`mergesCleanly`** |
| `Blocked(r)`                                                             | `blocked { r }` / flag → `conflicts { also: [r, draft?] }`                   | `conflicts { also: [r, draft?] }` | `blocked { r }`     |

`draft?` = `Draft` when the row is a draft and `r` is not already `Draft` (today's rule, `page.rs:311-313`). With a
local result GitLab's `conflicts` flag is ignored (rule 2).

**Words and icon (rule 3, the page's style, `readiness.ts:70-89`, `MergeRequestReadiness.vue:16-22`).** Text: **"No
conflicts (checked locally). GitLab has not checked the rest yet"**. Icon: Lucide **`circle-dashed-check`** in
`text-fg-muted` (the checking row's tone): a dashed ring, so it never reads as the green solid `circle-check` of
"Ready to merge" (rule 3: no false Ready); `git-merge` is taken by the Resolve button (`ui/AGENTS.md:49`). The icon
ships in the installed `@iconify-json/lucide` (`icons.json` has `circle-dashed-check`): no dependency. A local
conflict keeps today's words and icon. Consequence the owner will see: a row GitLab called conflicting that merges
clean loses its "Resolve conflicts" button when the result lands (`rowAction.ts:55`, unchanged rule).

### 2.2 One load's check (rules 4–8)

1. No row has a head commit → nothing runs; the log line says so.
2. `Repo::version()` → `MergeTreeRun::for_version`; `None` (git < 2.38) → stop: "git <v> cannot merge without a
   checkout (needs 2.38)".
3. `remote_for(repository.gitlab_remotes(), full_path)` (the remote #132 and #139 use) → none: stop.
4. **One `ls-remote`**: `git ls-remote --refs --end-of-options <remote> refs/heads/<t>… 'refs/merge-requests/*/head'`,
   each distinct target once (a target holding `:` is skipped by `require_branch_name`, `open.rs:108-113`); prompts
   refused (`run_without_prompts`), 20 s. Failure → stop (every row keeps GitLab's answer).
5. Per row: no `diffHeadSha` → kept; the target's or the head ref's line missing → kept; **`refs/merge-requests/<iid>/head`
   ≠ `diffHeadSha` → moving (rule 5)**, kept; else the pair (target tip, `diffHeadSha`).
6. Pairs in `MergedPairs` → folded and sent at once (remembered).
7. The other pairs' commits: one `cat-file --batch-check`; missing ones → **at most one fetch**:
   `fetch_without_refs(remote, refs/heads/<t> for each missing target tip, refs/merge-requests/<iid>/head for each
   missing head)`, `FETCH_TIMEOUT`. A failed fetch drops only the pairs that needed it.
8. Merges, **two at a time** (`MERGES_AT_ONCE`), each `merge-tree --write-tree [--quiet] <target> <source>` killed at
   **10 s** (`MERGE_TIMEOUT`); no merge starts after **60 s** of merging (`MERGE_PHASE_LIMIT`); each outcome goes into
   `MergedPairs`, then every row of that pair is folded and sent if its readiness changed.
9. **One log line (rule 8)**: `info` with the summary, or `warn` with the problem when one happened (stop, fetch,
   first failed merge); no other line from the check at info or above; no problem box.

**Numbers.** Two at a time: measured 10 ms per merge (≈ 41 MB each), so a moved target re-checking 500 rows costs
≈ 2.5 s on a mid-size repository and 50 rows ≈ 0.25 s, with at most ≈ 82 MB of git children while the user may work
in a merge window that runs git too; four would halve the time for double the memory on a check that is already in
the background. 10 s per merge: 1,000× the measured cost, room for a monorepo `[INFERENCE]`; 60 s per load bounds a
pathological repository (pairs not merged are not remembered, so the next load continues). 20 s for `ls-remote`: 18×
the measured 1.1 s, the same order as glab's 20 s (`GLAB_TIMEOUT`); a separate constant beside its only user, since
it is its own tunable. Per-pair `--quiet` processes, not one `--stdin` process: `--stdin` refuses `--quiet` and
writes objects (facts file), one process per pair costs ≈ 1 ms of start-up beside 10 ms of merging `[INFERENCE]`, and
per-pair processes give each merge its own time limit (rule 7) and keep one slow merge from holding the others.

**git 2.38–2.49.** `MergeTreeRun::Writing` runs `merge-tree --write-tree` without `--quiet`: rule 6 already allows
"only unreferenced objects" (1–2 per merge on gitlab-runner, facts file), which git's own gc prunes later. Without it,
stock macOS git (2.39.5) and Debian 13 (2.47.3) get no local check at all. Open question 1 asks the owner to confirm.

## 3. Options

### Option A — checks follow the end on the load's channel; the shell holds the run's memory (recommended)

- **Structures.** §2.1, plus `ListMessage::Checked { row: CheckedRow }` (src-tauri) and `MergeRequestState.merged:
  Mutex<MergedPairs>`. `list_merge_requests` returns `Listed { end: ListEnd, to_check: Option<ConflictCheck> }`.
  `check_conflicts(repository, &check, &mut MergedPairs, on_checked) -> CheckSummary` holds nothing between calls.
- **Flow.** `list_merge_requests` command: pages, `End` (unchanged), then — still on the same blocking worker —
  `check_conflicts` with the `merged` lock held for the whole check, each result sent as `Checked` on the same channel
  (channel messages keep their order, plan #131). The command answers after the check; the window never waits on the
  command's answer (`tauriMergeRequests.ts:39-44`, architecture §4 l. 994-995).
- **Refresh.** A second load runs its GitLab part at once (its own channel, own worker); its check waits on `merged`
  until the first check ends, then finds those pairs remembered: a pair is never merged twice (rule 7), and no
  cancellation is needed. Cost: a hung first check (ls-remote 20 s + fetch 120 s + merges 60 s) delays the second
  load's local results, never its GitLab answers. The window drops a `checked` row of a load whose rows are no longer
  shown (§3 of the page brief).
- **Closed page.** The slice lives per window, not per mounted page (architecture §5.1 l. 1075): results still land
  in its rows and show when the page reopens; nothing is stopped. Window closed: the process ends.
- **§3.9 amendment.** "no `Mutex`, nothing cached" becomes "no `Mutex`; the one memory across loads is the run's
  `MergedPairs`, which the shell holds and lends to `check_conflicts` (plan #149)". The crate still holds no state.
- **Files.** gitio: `src/merge_tree.rs`, `src/ls_remote.rs`, `src/objects.rs` (new), `src/entry.rs` (`Oid: Hash`),
  `src/lib.rs`, `tests/local_check.rs`. merge-requests: `src/readiness.rs`, `src/check.rs` (new), `src/page.rs`,
  `src/page/tests.rs`, `src/query.rs`, `src/list.rs`, `src/lib.rs`, `tests/local_conflicts.rs` (new),
  `tests/list.rs`; `src-tauri/src/merge_requests.rs`, `src-tauri/src/merge_requests/tests.rs`;
  `tests/glab/local-conflicts/**` (new), four recorded pages gain `targetBranch`, `tests/glab/README.md`,
  `scripts/local-conflicts-repo.sh` (new). Frontend: `ipc/MergeRequestSource.ts`, `ipc/tauriMergeRequests.ts`,
  `ipc/mergeRequestDomain.ts`, `ipc/index.ts`, `ipc/fixtureMergeRequests.ts`, `ipc/fixtureMergeRequestData.ts`,
  `ui/mergeRequests.ts`, `ui/MergeRequestReadiness.vue`, `mergeRequests/internal/readiness.ts` and their tests.
- **Risks.** (1) The command runs past its `End`: a window reloaded mid-check makes `Checked` sends fail — they are
  not logged one by one (rule 8). (2) The user's merge config (`merge.renames`, `diff.renameLimit`) shapes
  `merge-tree`'s answer; GitLab's may differ `[INFERENCE]`. (3) A partial clone may fetch blobs lazily during
  `merge-tree` `[INFERENCE]`; the 10 s limit bounds it (rule 8). (4) Old recorded pages lack `targetBranch` and must
  gain it (the field is non-null in GitLab's schema; parsing it as optional would lie about GitLab).
- **Tests.** gitio: real tempdir repos (clean / conflicting / unrelated / missing commit; `Quiet` writes no object;
  `ls-remote` of a bare remote by path; `missing_commits`). merge-requests: the fold table as a unit test; the
  scenario `tests/glab/local-conflicts/` on `scripts/local-conflicts-repo.sh` — the request's Rust acceptance lines;
  src-tauri: the channel's order (pages, end, then checked). Frontend: words/icon, the slice's application and drop
  rules, the channel after `end`, a fixture script `?mr=local`; WebKit and the real app.
- **Visions.** 2 (one fold in Rust, one memory owner, one fetch rule), 5 (no new command, transport or dependency),
  1 (one function reads top to bottom as §2.2), 4 (`mergesCleanly` only from a clean local merge).
- **Cost.** ≈ 350 + 1,250 + 600 changed lines over three slices; the IPC grows by one variant, one struct and one
  message kind; §3.9 and §3.5 amended.

### Option B — a second command per load

- **Structures.** As A, but `ListMessage` is unchanged; a new `CheckMessage = Checked { row } | Done { summary }` on a
  second `Channel`, a new command `check_merge_requests(messages)`, a new `MergeRequestSource.checkMergeRequests(onChecked)`;
  `MergeRequestState` gains `merged: Mutex<MergedPairs>` **and** `last_listed: Mutex<Option<ConflictCheck>>`.
- **Flow.** The slice calls `checkMergeRequests` after each `end`; Rust checks the rows it kept from the last list.
- **Refresh / closed page.** The slice must pair each check with its load (a generation), and Rust must tell which
  list a kept `ConflictCheck` came from (a second load may replace it while the window asks): two writers for one
  fact across the IPC (vision 2), a race to design.
- **Files.** A's, plus `commands`/bindings for the new command, a new Source method in three implementations.
- **Risks.** The race above; one more command name in PM6's lists (architecture, ipc-contract).
- **Visions.** Serves none better than A; costs 2 and 5.
- **Cost.** ≈ A + 300 lines, two `Mutex`es, one command.

### Option C — a run-long checker in the crate

- **Structures.** `ConflictChecker { memory: Mutex<MergedPairs>, queue: mpsc::Sender<…> }` with a worker thread,
  owned by `yamt-merge-requests`; `list_merge_requests` hands it each page's rows as they arrive.
- **Flow.** Checks could start on page 1 — but rule 7 allows one `ls-remote` per load and later pages bring new
  target branches, so the checker must wait for the last page anyway: no earlier results than A.
- **§3.9.** Reversed, not amended: the crate gains a `Mutex`, a thread and a lifecycle (stop on window close).
- **Visions.** Against 5 and 1 (a thread and a queue a Rust beginner must follow); no gain for 2.
- **Cost.** ≈ A + 400 lines, a thread to stop and test.

## 4. Recommendation

**Option A.** It adds one message kind to the channel the list already streams on, keeps the crate stateless (the
run's memory is a plain value the shell holds, §3.9 amended by one sentence), serializes checks with the one lock that
also guarantees "never merged twice", and needs no cancellation. Cost: three slices (≈ 2,200 changed lines), one IPC
variant (`mergesCleanly`), one struct (`CheckedRow`), one message kind (`checked`), a changed
`MergeRequestSource.listMergeRequests` signature, and a command that runs past its `End` while it checks.

### Proposed plan §2 rows (DR5: the orchestrator records them)

| #   | **Decision**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Rejected alternatives & why                                                                                                                                                                                                                                                                                                                                                      | Vision     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 149 | **The merge-request list checks each open row's conflicts locally** (owner 2026-11-01, #2079–#2080, request `docs/slices/request-local-conflict-check.md` rules 1–8; design `briefs/local-conflicts-design.md` option A). The list query (#131) adds `targetBranch diffHeadSha`. After `End`, on the same channel and worker, `check_conflicts`: `version` (< 2.38 → none; < 2.50 `merge-tree --write-tree`, else `--quiet`), `remote_for`, one `ls-remote --refs <remote> refs/heads/<t>… 'refs/merge-requests/*/head'` (20 s), rows whose head ref ≠ `diffHeadSha` keep GitLab's answer (rule 5), one `cat-file --batch-check`, at most one `fetch_without_refs` of the missing `refs/heads/<t>` and `refs/merge-requests/<iid>/head` (#132's rule), merges two at a time, 10 s each, none started after 60 s; each result sent as `ListMessage::Checked { row: CheckedRow { iid, readiness } }` when it changes the row. `Readiness` gains `mergesCleanly` (local clean, GitLab's status checking or `CONFLICT`): "No conflicts (checked locally). GitLab has not checked the rest yet", Lucide `circle-dashed-check`, muted. The run's `MergedPairs` ((target, source) → outcome) lives in `MergeRequestState.merged: Mutex<MergedPairs>`, held for a whole check, so a second load waits and merges nothing twice (amends §3.9's "nothing cached"). One log line per load; failures keep GitLab's answer | a second command per load (two writers of "which rows", a race on Refresh); a checker thread in the crate (state, lifecycle, no earlier result); one `--stdin` process (refuses `--quiet`, writes objects, one time limit for all); `origin/*` or the stored diff base (stale, rule 4); `checking { cleanLocally }` or a second row field (a flag bag; two sources for one icon) | 2, 5, 4, 1 |
| 150 | **Defaults decided with the local-conflict design** (orchestrator, OR13; the owner may veto): a draft that merges clean while GitLab still checks shows the new state (its title says "Draft:"); a row that merges clean loses Resolve when the result lands; git 2.38–2.49 checks without `--quiet` (unreferenced objects, rule 6); results of a load whose rows are no longer shown are dropped; a Refresh during a check waits for it before its own local results                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                                                                                                                                                                                                                                                                                                                                                | 1, 5       |

### Shared edits for the orchestrator (no slice owns them)

- `just bindings` after `local-conflicts-check` lands, before `local-conflicts-page` starts (`Readiness`,
  `CheckedRow`, `ListMessage`).
- Docs keeper (`skill://orchestrate` §6): `docs/architecture.md` §3.2 (three `Repo` methods, `MergeOutcome`,
  `MergeTreeRun`, `RemoteRef`), §3.5 l. 492-496 and 507-518 (`merged`, the check after `End`, the compare window's
  git runs), §3.9 (the amendment, query fields, `check.rs`, `readiness.rs`, `CheckedRow`, `mergesCleanly`, the
  scenario), §4 l. 852-856 and 980 (`ListMessage` `checked`, `Readiness`, `listMergeRequests(onPage, onChecked)`),
  §5.1 l. 1074-1075 (`merged` and the rows' second writer); `skill://project-map/tree.md` (`scripts/local-conflicts-repo.sh`,
  before `just check`: `map-check` fails without it) and `state.md` (`MergedPairs`, rows); `README.md:83` (the new
  state); `docs/plan.md` rows 149–150; `frontend/src/ipc/fixtureMergeRequests.ts`'s `?mr=local` in §4 l. 997. The
  slices update their own modules' `AGENTS.md`.
- Risk register, new row (proposed): **RK52** — the local conflict check moves a ref, writes `FETCH_HEAD`, the index
  or the working tree, prompts, or shows a local result for a head GitLab is not showing (rule 5); detector:
  `yamt-merge-requests` `check_conflicts` (`remote_refs`, `fetch_without_refs`, `merge_tree` only; the head
  comparison) + `tests/local_conflicts.rs` (byte-identical refs, status, `HEAD`, `FETCH_HEAD`; the moving row).

## 5. Slice graph

| order | brief                                                                                                    | owner     | needs        | runs beside                                |
| ----- | -------------------------------------------------------------------------------------------------------- | --------- | ------------ | ------------------------------------------ |
| 1     | `local-conflicts-gitio.md` — `merge_tree`, `remote_refs`, `missing_commits`                              | rust-impl | —            | nothing (the next one compiles against it) |
| 2     | `local-conflicts-check.md` — query fields, fold, check, memory, channel, scenario                        | rust-impl | 1 landed     | nothing                                    |
| —     | orchestrator: `just bindings`                                                                            | —         | 2 landed     | —                                          |
| 3     | `local-conflicts-page.md` — words, icon, rows updating, fixture, WebKit, real app (**wires the window**) | web-impl  | 2 + bindings | the docs keeper                            |
| 4     | verifier: `just check`, WebKit, real app; owner check on his playground                                  | verifier  | 3            | —                                          |

Sequential by construction: each slice compiles against the previous one's code, and `bindings.ts` is generated
(PM4). At most one implementer runs at a time; the docs keeper may run beside slice 3 (disjoint files).

## 6. Open question for the owner

1. On git 2.38–2.49 (stock macOS git 2.39, Debian 13's 2.47) the check can only merge by leaving a few unreferenced
   objects per merge in the repository's object store (git's own gc prunes them later; no ref, branch, index or
   file changes). The design does so (rule 6 allows it); the alternative is no local check below git 2.50, where
   those rows keep GitLab's possibly stale answer. Keep it?
