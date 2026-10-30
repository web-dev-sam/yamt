# Request — merge-request rows: change size, merge readiness, resolve conflicts in yamt (with abort)

Owner request 2026-10-30 (#1995), session 39, on `main` after `40e0146`. Status: intent captured; two product questions
answered (#1995, #1996, table below); open for a design (`MrConflictsDesign`). Details marked "(orchestrator)" are
defaults the owner may veto (OR13). A design may refine a detail a rule names, never reopen a rule. Builds on the
merge-request page (plan §2 #128–#137).

## Owner's words

> "plan 2, 7, 8 (with abort)"

from the ideas offered the same day:

> 2. **Size of each change.** Show `+120 −40 · 6 files` on each row, so you can grab a small one between tasks.
> 3. **Show merge readiness.** A small icon for "has conflicts", "needs rebase" or "blocked".
> 4. **Resolve a merge request's conflicts in yamt.** The natural next step after 7: from a row that has conflicts,
>    start the merge of its target branch locally and open yamt's merge window.

## Questions (asked and answered 2026-10-30)

| question                          | options                                                                 | answer                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Where does yamt do the merge?     | a separate copy of the repository (recommended) · **your own checkout** | **your own checkout**: "its likely users will test their app while fixing conflicts" (#1995) |
| How does the result reach GitLab? | **ask before pushing (recommended)** · push on finish · never push      | **ask before pushing** (#1996)                                                               |

## Rules

1. **Size (idea 2).** Every row shows its latest version's added and removed lines and changed files, as GitLab
   counts them: `+120 −40 · 6 files` (one file: "1 file"), muted, in the row's meta part after "created … ago".
   Hover: "120 lines added, 40 removed in 6 files". Unknown counts (GitLab has none yet) show nothing.
2. **Readiness (idea 7).** Every row shows one small icon for GitLab's merge status of that merge request, in its own
   fixed column beside the CI box: **ready to merge**, **has conflicts**, **needs rebase**, **blocked** (the hover
   names why: draft, unresolved discussions, approvals missing, pipeline must pass, or GitLab's other reasons in
   plain words), **checking** (GitLab has not decided yet). Exactly one state per row; an unknown GitLab value shows
   as blocked with GitLab's own word (orchestrator). **Conflicts first (#1998):** a merge request that has conflicts
   shows **has conflicts** even when GitLab also calls it blocked; the hover then also lists what else blocks it.
3. **Resolve conflicts (idea 8): the button.** A row whose readiness is **has conflicts** gets a "Resolve conflicts
   of !12" button beside the open-changes button. Other rows have none. A merge request from a fork (its branch lives
   in another project) shows the button disabled, hover "Resolving a fork's merge request is not supported"
   (orchestrator: yamt can neither be sure it may push there nor which remote holds it).
4. **Before anything changes.** The repository is the window's (the range window's; for the compare window the folder
   yamt was started in). yamt refuses, with one sentence under the row and nothing changed, when: the checkout has
   uncommitted changes to tracked files (untracked files are fine unless git would overwrite them, which git itself
   refuses); git is in the middle of another operation (a merge, rebase, cherry-pick, …); the fetch fails (git's
   sentence; never a prompt, as #132's fetch); the local branch of the merge request's name has commits GitLab's
   branch does not have (yamt never drops a local commit).
5. **The merge, in your own checkout (#1995).** yamt fetches the merge request's branch and its target branch, then
   checks out the merge request's branch locally (creating it when missing, tracking GitLab's; fast-forwarding it when
   it is only behind), and merges the target branch into it — the direction GitLab's own "Resolve conflicts" uses —
   without committing. Then a yamt merge window opens on that checkout (a new window; the merge-request page's window
   stays as it is), and the row says what happened ("Merging main into feature/x in a new window."). When the merge has
   no conflict after all (GitLab's status was stale), the row says so and the merge window still opens, so the result
   can be looked at and committed the same way (orchestrator).
6. **Finishing (#1996).** Finishing the merge in yamt's merge window commits it with git's default merge message.
   Then the window asks "Push feature/x to GitLab?" with **Push** (preferred) and **Keep local**. Push is a plain push
   of that branch to the remote it came from, never forced; a rejection (someone pushed meanwhile) or failure shows
   git's sentence and keeps the commit local. Either way the checkout stays on the merge request's branch, so the
   user can keep testing their app.
7. **Abort (owner: "with abort").** Until the merge is committed, the merge window's Abort puts the checkout back
   exactly as it was before rule 5: git's merge abort, then the branch the user was on checked out again, a branch
   yamt created deleted, a branch yamt fast-forwarded moved back. Nothing reaches GitLab. The question before it names
   that ("Abort the merge of main into feature/x and return to develop?"). A restart of yamt in between (the window
   closed, the machine rebooted) must not lose what abort needs to restore.
8. **One at a time.** While such a merge is in progress in the repository, every other row's resolve button in every
   window of that repository is disabled with the hover "A merge is already in progress in this repository" (rule 4
   also refuses it).
9. **Continue (#1997).** The row of the merge request whose yamt-started merge is unfinished offers "Continue merging
   !12" in place of its resolve button; it opens the merge window on that checkout again (a new window, as rule 5),
   where the user finishes (rule 6) or aborts (rule 7).
10. **Remote-tracking branches (orchestrator, design question 3).** The fetch of rule 5 updates `origin/<target>` and
    `origin/<branch>` as any `git fetch` does; Abort restores the user's own branches and checkout, not those.

## Non-goals

Resolving by rebase; fork merge requests (rule 3); force pushes; resolving through GitLab's API; changing the merge
request itself (title, labels, approvals); a readiness or size filter (not asked).

## Facts and risks for the design

- The merge-request page and its Rust side: plan §2 #128–#137; `crates/merge-requests/`, `src-tauri/src/merge_requests.rs`,
  `frontend/src/ui/MergeRequest*.vue`, `mergeRequests*.ts`. The list query: `crates/merge-requests/src/query.rs`.
- Starting a second yamt and the no-prompt fetch rules: #132 (`range_window.rs`, `gitio` `fetch_without_refs`, RK40,
  RK42). This feature writes refs on purpose (a local branch, `HEAD`), unlike #132: the risk register needs rows
  for "a local commit lost", "the user's branch left checked out wrong after abort", "a push that was not asked".
- The merge window, its operations, Continue and Abort: plan §2 #85–#92 (`gitio::Repo::stop()`, `Operation::Merge`),
  #88 (abort per operation). Rule 7's abort does more than `merge --abort`; what records the "before" state, where,
  and how the merge window knows this merge is one yamt started, is the design's to decide.
- GitLab's fields (to be confirmed against the GraphQL schema of the glab in use): merge status
  (`detailedMergeStatus` or similar), diff counts (`diffStatsSummary` or similar), source project vs target project
  (fork detection). Fake glab scenarios in `tests/glab/` need the new fields.
