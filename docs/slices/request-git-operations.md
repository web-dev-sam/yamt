# Request — rebase, cherry-pick, revert and merge as first-class: own work on the left, the operation at the top, Abort and Continue for each

Settled (owner 2026-10-21, #1305–#1310; details decided by the orchestrator as owner, OR13). A design may refine a
detail it names, never reopen a rule.

## Owner's words

Asked "can this project handle cherry-picks, reverts, rebases well?", the orchestrator found (smoke on scripted repos,
2026-10-21): conflicts from every operation are read and resolved correctly; during a rebase the user's own commit sits
on the right as "Remote (theirs)"; a revert's right side has no name; Abort exists only for `git merge`; a resolution
replayed by git rerere is staged at start without review; a multi-commit rebase or cherry-pick needs one yamt run per
stop. The owner answered (2026-10-21):

1. "fix, own work always needs to be on left"
2. "name it" (the revert's right side)
3. "make aboirt works for every status"
4. "your decision, UX is the important decider" (rerere)
5. "thats overkill. yamt should handle that case and provide a continue button similar to marks as resolved."
6. "also I want the current merge type (if cherry pick, rebase or merge) to be displayed at the top"

## Operations

What git records while it is stopped on conflicts, and which side is the user's own work. "Recorded" = git keeps state
yamt can read and git can abort; the design names how each is detected (through git, `rev-parse --git-path` for
worktrees, never a hard-coded `.git/` path) and verifies each row against git ≥ 2.32 (yamt's floor) by experiment.

| operation                                                         | git's ours (stage 2)           | git's theirs (stage 3)                    | own work | recorded           |
| ----------------------------------------------------------------- | ------------------------------ | ----------------------------------------- | -------- | ------------------ |
| merge (incl. `pull` with merge)                                   | HEAD                           | `MERGE_HEAD`                              | HEAD     | yes                |
| squash merge (`merge --squash`)                                   | HEAD                           | the merged commit (no `MERGE_HEAD`)       | HEAD     | yes (`SQUASH_MSG`) |
| rebase, both backends, interactive, `pull --rebase`               | HEAD (what it builds on)       | the commit being replayed (`REBASE_HEAD`) | theirs   | yes                |
| rebase `-r` re-doing a merge commit (`MERGE_HEAD` + rebase state) | HEAD (the user's rebased line) | `MERGE_HEAD`                              | HEAD     | yes                |
| cherry-pick (one commit or a sequence)                            | HEAD                           | the picked commit                         | HEAD     | yes                |
| revert (one commit or a sequence)                                 | HEAD                           | the reverted commit's parent              | HEAD     | yes                |
| `am -3` (applying patches)                                        | HEAD                           | the patch                                 | HEAD     | yes                |
| stash pop/apply, `checkout -m`, anything else                     | HEAD                           | the stash / the carried changes           | HEAD     | no                 |

## Rules

1. **Own work on the left.** Where the table says "theirs" (a rebase stopped on a replayed commit), the left pane
   ("Local (yours)") shows git's stage 3 and the right ("Remote (theirs)") stage 2, base unchanged. Everything that
   follows a side follows the pane: the chunks' sides and colours, apply-all left/right, the strips' arrows, Take on
   a choice file (binary, link, submodule), Keep/Delete on a file deleted on one side, the side names, the summary
   counts. The file on disk stays git's: conflict markers yamt writes for a change still waiting keep git's order and
   labels (HEAD's block first), so `git diff`, `git checkout --conflict` and other tools read it as git wrote it; Reset
   writes back what was on disk at open. Every other row keeps HEAD on the left. The words "Local (yours)" and
   "Remote (theirs)" stay.
2. **Names.** Each side's header names what it shows, by the rules of plan §2 #50/#62 (branch, else short id and
   subject with the full message on hover, nothing found → the bare label): in a rebase the left names the commit
   being replayed and the right the commit the rebase builds on (HEAD); a revert's right side names the reverted
   commit as its revert (wording: the design drafts it, the orchestrator decides); `am` names the patch where git
   keeps its subject. Read once per stop (rule 5 makes a new stop).
3. **The operation at the top.** While a recorded operation is stopped, the top of the window names it in words a git
   user knows: what runs, what it applies, onto what, and how far a sequence is — e.g. "Rebasing feature onto main ·
   2 of 5", "Cherry-picking 3f2c1a0 Fix login · 1 of 3", "Reverting 9b8e7d6 Add cache", "Merging feature/reminders
   into main", "Squash-merging feature/reminders into main", "Applying patch 2 of 4: Fix typo" (final words: the
   design drafts, the orchestrator decides). Visible without hovering, inside the window (not only the OS title
   bar), in both themes; it never takes room from the panes beyond one row. An unrecorded operation shows no
   operation. Re-read with every file list (start, window focus, after Continue), so it follows a terminal.
4. **Abort for every recorded operation.** The Abort button (plan §2 #74: after Mark resolved, hidden at first, in the
   toolbar's right-click menu, one question, then yamt closes with status 1) works for every recorded operation with
   git's own abort: `merge --abort`, `rebase --abort`, `cherry-pick --abort`, `revert --abort`, `am --abort`; a squash
   merge has no `--abort`, so `reset --merge` (what `merge --abort` runs, git-merge(1)). Its title, the question and
   the stderr line name the operation ("Abort rebase", "yamt: rebase aborted"); the question says what is lost, for a
   rebase or a sequence also the commits already replayed. Unrecorded operations get no Abort: git keeps nothing to
   return to, and the work before them may exist nowhere else. The button keeps its id and its hidden-at-first
   decision across the rename (an owner who showed "Abort merge" sees "Abort rebase" there).
5. **Continue.** A "Continue" button beside Mark resolved, always shown while a recorded operation is stopped (not
   hidden at first; in the toolbar's right-click menu like the others), its label naming the operation ("Continue
   rebase"; a merge or squash merge: "Commit merge"). Enabled only when git lists no unmerged file; otherwise disabled
   with a hover saying files are left. It runs git's own continue (`merge --continue`, `rebase --continue`,
   `cherry-pick --continue`, `revert --continue`, `am --continue`; a squash merge: `commit` with git's `SQUASH_MSG`)
   with git's prepared commit message unedited — no editor opens; hooks run as in a terminal. Unsaved edits in yamt
   ask first, as closing does (plan §2 #65). After git:
   - **stops again on conflicts** → yamt shows the new stop as at start: new file list (first file opened), sides,
     names, top line; nothing of the old stop stays (panes, undo, notices, choices);
   - **stops without conflicts** (an `edit` or `break` step, a failed `exec`, an empty commit, a hook refusing) →
     git's message in the problem bar; the top line still names the operation, the file list is empty, Continue and
     Abort stay;
   - **finishes** → yamt closes with status 0 and a stderr line ("yamt: rebase finished");
   - **refuses** → git's message, nothing changes.
     **Moved on outside:** when a file list finds the operation at another stop than the one shown (continued, skipped
     or edited in a terminal), yamt shows the new stop as after Continue, and a notice says the old stop's unsaved edits
     were dropped (git has already committed or left that stop). When the operation ended or was aborted outside, the
     top line, Continue and Abort go away and the list shows git's view, as today.
     Unrecorded operations get no Continue: staging the last file is their end.
6. **A remembered resolution is reviewed, not staged** (orchestrator for the owner, #1308; UX: never commit what the
   user has not seen, and git's default `rerere.autoUpdate=false` asks for exactly that review). A conflicted file
   git rerere resolved from a recorded resolution is not staged when yamt opens it: the file list marks it unresolved
   with a sign that a remembered resolution was applied (hover says so); opened, the Result is the remembered text and
   the sides show what each changed (the design proposes how, with cost); Mark resolved stages it. With
   `rerere.autoUpdate=true` git stages it itself and yamt never lists it. A file changed on disk while yamt runs keeps
   plan §2 #52's rule.

## Acceptance

Real app on scripted repositories (and the fixture page for the window's look): (a) a rebase of a 3-commit branch
with conflicts in two commits: the user's commit on the left, named, the top line "… 1 of 3"; resolve, Continue → the
next stop without a restart, "… 2 of 3"; the last Continue closes yamt with status 0 and `git log` shows the rebased
commits with their own messages; a binary and a deleted-side file in a rebase take the own side on Take/Keep;
markers written by Save for a waiting conflict are byte-equal to git's; (b) a cherry-pick range and (c) a revert range
the same, the revert's right side named; (d) a merge: the top line, Commit merge commits with git's message; (e)
Abort in a merge, a rebase mid-way, a cherry-pick sequence, a revert, a squash merge and `am -3` leaves the repository
as before the operation (`git status`, branch tip, `git stash list`), status 1; (f) Continue in a terminal while yamt
is open → focus shows the next stop and the dropped-edits notice; (g) rerere: the file listed unresolved with the
mark, the remembered result shown, Mark resolved stages it; (h) a stash pop: no top line, no Abort, no Continue,
resolves as today; (i) Continue disabled while a file is left, enabled after the last Mark resolved; a refusing
`pre-commit` hook shows its message and nothing changes; (j) light and dark. `just check` passes.

## Non-goals

Skip (`--skip`); editing the commit message in yamt; starting or editing a rebase todo from yamt; keyboard keys for
Continue or Abort; a top line or buttons for unrecorded operations; `git bisect`; changing the words "Local (yours)"
and "Remote (theirs)"; WebStorm's "Changes from …" headers.
