# Request — the merge-request list checks conflicts locally instead of trusting GitLab's stale flag

Asked by the owner on 2026-11-01 (planning conversation, #2079–#2080); details by the orchestrator as owner (OR13).
A design may refine a detail it names, never reopen a rule. Base: main `5d314757`. Window: the merge-request page
(`MergeRequestsView.vue`; readiness fold `crates/merge-requests/src/page.rs:299-326`, words
`frontend/src/mergeRequests/internal/readiness.ts:80-81`).

## Owner's words

- "'gitlab is still checking whether it can be merged', is happens too often. Can we check it ourself locally and keep
  it cheap?"
- "One bug of gitlab I find really annoying is that the has conflict icon in gitlab is wrong often times until the user
  goes into the MR then it shows the right conflict status"
- "b: just be careful because the local branch might not be uptodate so it needs to compare the same states as gitlab
  but not checkout branches in users working tree"

## Why GitLab is wrong

GitLab computes `detailedMergeStatus` and `conflicts` lazily and keeps them: after a push to either branch a row stays
`UNCHECKED`/`CHECKING`, or keeps an old `CONFLICT`, until something triggers a recheck (opening the merge request's
page does). The list query triggers none. `query.rs:102-103` already records one false `CONFLICT` (measured on
gitlab.com, 2026-10-31).

## Rules

1. **Every open row is checked** (owner #2080: "b"), not only rows GitLab calls conflicting or checking.
2. **Conflicts: the local merge decides; everything else: GitLab.** Whether the row has conflicts comes from the local
   merge; approvals, pipelines, discussions, draft and the other blockers stay GitLab's (`BlockedReason`).
3. **No false "Ready".** When the local merge is clean but GitLab's status says nothing about the other blockers
   (`CHECKING`/`UNCHECKED`/`PREPARING`/`APPROVALS_SYNCING`/missing, or `CONFLICT`, which hides them), the row shows a
   state of its own: no conflicts, checked locally, GitLab has not checked the rest (wording and icon in the design).
   A local conflict shows today's "Has conflicts", whatever GitLab says.
4. **GitLab's commits, never the user's branches** (owner #2080). Source: the merge request's head commit as GitLab
   reports it (one more field in the list query). Target: the target branch's tip on GitLab now, never a local branch,
   never `origin/*`, never the stored diff base (that is the stale state). Both from one `git ls-remote <GitLab remote>
   refs/heads/<each target> 'refs/merge-requests/*/head'` (no objects; forks included through the target project's
   `refs/merge-requests/<iid>/head`). The GitLab remote is the one the existing detection already picks.
5. **Same state as GitLab.** When the list's head commit and `refs/merge-requests/<iid>/head` differ (a push in
   flight), that row keeps GitLab's answer; no local result is shown for a state GitLab is not showing.
6. **The user's repository is untouched.** Missing commits are fetched by those names with no destination refspec,
   `--no-write-fetch-head` and `--no-auto-maintenance`: only the object store changes; no branch, no `origin/*`, no
   `FETCH_HEAD`, no index, no working tree, no `HEAD`, no background gc. The merge is `git merge-tree --write-tree
   <target> <source>` (exit 0 clean, 1 conflicts), which writes only unreferenced objects.
7. **Cheap.** A result is kept per (target commit, source commit) for the app's run: an unchanged pair is never merged
   twice; a moved target re-checks every row once. One `ls-remote` and at most one fetch per list load. The page shows
   GitLab's answers at once; local results fill rows as they finish, in the background, few at a time, each with a
   time limit (numbers in the design).
8. **Failure is quiet.** No network, git too old, a fetch or merge that fails or times out: the row keeps GitLab's
   answer; one log line per load, no problem box (orchestrator: the local check only ever improves a row).

## To be measured by the design (unverified)

- The GraphQL field for the merge request's head commit (`diffHeadSha` or `sha`) in GitLab's schema.
- That GitLab moves `refs/merge-requests/<iid>/head` on every push, fork pushes included, and that `ls-remote` sees it.
- The git versions: `merge-tree --write-tree` (2.38), `--no-write-fetch-head`, `--no-auto-maintenance`; whether newer
  git can merge without writing objects; plan §2's minimum git, if any.
- How `open.rs` `fetch_unless_local` and `gitio` `fetch_branches` write refs today: one fetch rule for both, not two.
- Fit with plan §2 #132 ("no fetch when both commits are local") and the merge-request rows in §2.
- Cost of one `merge-tree` on a large repository (renames on): the per-load ceiling of rule 7.

## Acceptance

Rust: against a repository built by a script and the fake glab (`tests/glab/<new case>/`): a row GitLab calls
`CONFLICT` that merges clean shows rule 3's state; a row GitLab calls `MERGEABLE` that conflicts shows "Has
conflicts"; `CHECKING` + clean shows rule 3's state; a head mismatch keeps GitLab's answer; a second load with the same
pairs runs no merge; after the check, `git for-each-ref`, `git status --porcelain`, `HEAD` and `.git/FETCH_HEAD` are
byte-identical to before; an unreachable remote keeps every GitLab answer. WebKit fixture: the new state's words and
icon; a row changing from GitLab's answer to the local one. Real app on a script-built repository with the fake glab:
the same rows. `just check` passes. Owner check on his GitLab playground: a merge request GitLab marks conflicting
after its target moved shows the right state without opening it in GitLab.

## Non-goals

Asking GitLab to recheck (REST `with_merge_status_recheck`); a local "needs rebase" from the project's merge method;
checking approvals, pipelines or discussions locally; keeping results across restarts; any change to the merge or
compare windows.

## Owner's answers

- (#2079, 2026-11-01) GitLab's conflict icon is often wrong until the merge request is opened → the local merge
  decides conflicts (rule 2), not only fills GitLab's gaps.
- (#2080, 2026-11-01) Which rows: **"b"** (every open row; rule 1); compare GitLab's states, never the user's local
  branches, never check anything out in the working tree (rules 4–6).

## Slice graph (proposal; the session's orchestrator refines it)

| row | slice                                                                                                           | owner     | owns (coarse)                                                                                                     | needs |
| --- | --------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | design: measured facts above, the new readiness shape, how local results reach the page (event or second call)  | designer  | `docs/slices/briefs/local-conflicts-*.md`                                                                         | —     |
| 2   | git: `ls-remote` ids, fetch by name with no refs, `merge-tree` result                                           | rust-impl | `crates/gitio/**`                                                                                                 | 1     |
| 3   | merge requests: head field in the query, rule 2/3/5 fold, per-pair memory, background run, command and bindings | rust-impl | `crates/merge-requests/**`, `src-tauri/src/merge_requests*`, `tests/glab/<new case>/**`                           | 2     |
| 4   | page: new state's words and icon, rows updating as results arrive, fixtures                                     | web-impl  | `frontend/src/mergeRequests/**`, `frontend/src/ui/MergeRequestsView.vue`, `frontend/src/ipc/fixtureMergeRequest*` | 3     |
| 5   | final run: `just check`, WebKit, real app                                                                       | verifier  | —                                                                                                                 | 4     |

Risks: `Readiness` crosses IPC (bindings); the page loads once today, so rule 7's filling-in needs a way for late
results to reach it; a moved target branch re-merges every row at once (rule 7's limit); merge-request refs may be
absent on self-hosted GitLab setups that hide them (then rule 8).
