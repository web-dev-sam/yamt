# Request — "Reviewed" marks in the diff window, remembered, and only the new changes after a review

Settled with the owner on 2026-11-19 (session 56); details by the orchestrator as owner (OR13) where marked, the
owner may veto. "Diff mode" is the range window (`yamt --diff=<a>..<b>` / `<a>...<b>`, and the changes window a
merge-request row opens). A design may refine a detail it names, never reopen a rule.

## Owner's words

- "in diff mode add a "reviewed" button in place of "resolve" in the conflict mode. its just for the human to keep
  track of what they have reviewed."
- "Think about how to save this across restarts, or when a new commit got added to dev...HEAD for example, how to show
  the user the new changes on top of what they resolved so they dont [need] to rereview a massive diff"

## Rules

1. **Button.** The range window's header (`RangeView.vue:70-108`) gains a "Reviewed" button where the merge window
   has "Mark resolved" (`MergeToolbar.vue:187`): first in the header row, next to the file list, in its look — filled
   when the shown file is reviewed (`aria-pressed`), outlined otherwise. It is only the user's own note: nothing is
   written to git, the repository or GitLab. Disabled while no file is shown.
2. **Toggle and next file** (orchestrator, as #48). A click on an unreviewed file marks it reviewed and opens the next
   unreviewed file in list order (wrapping; none left → stay). A click on a reviewed file unmarks it and stays.
   Binary, too-large and submodule entries can be marked like any other.
3. **List marks.** Each file row in the list and the tree shows its state: reviewed (a check mark, as a resolved file
   in the merge window's list), changed since reviewed (rule 5's own mark, visibly different), or nothing. The header
   or list shows "N of M reviewed".
4. **Remembered across restarts and new commits** (orchestrator). Marks live in yamt's data folder, never in the
   repository. They belong to the review, not to one commit pair: the same repository and the same two sides by name —
   `dev...HEAD` while on branch `feature-x` is remembered as `dev...feature-x`, so a new commit on `feature-x`, a moved
   `dev` or a rebase keeps the marks; a side given as a commit id is that id. A merge request's changes window
   remembers per merge request. Each mark records the file's path and the content of both sides at the moment it was
   marked.
5. **A reviewed file that changed again.** At open, a mark whose file's right side (what the author wrote) is
   unchanged stays reviewed, even if the left side moved (orchestrator: the author's text is what was reviewed). A
   mark whose right side changed becomes "changed since reviewed": not reviewed, its own list mark, and its view shows
   only what changed since the review — the reviewed right-side text in the left column, today's right side in the
   right column (owner's answer 1). Marking it reviewed again records the current contents.
6. **Review from start** (owner's answer 1: "also provide an option to reset the file to the inkoked diff (reviewing
   the file from start again)"). A changed-since-reviewed file's view offers one control that forgets its old mark:
   the file becomes unreviewed with no mark and shows the whole change of the range as today. One control, no
   separate temporary switch (orchestrator, vision 5). A file the range no longer contains drops its mark silently; a
   file new to the range is unreviewed.
7. **Threads unchanged.** Comment threads stay per commit pair as today (#117); carrying them to a new pair is not
   part of this request. A thread is added only on the whole-change view (the since-review view has no GitLab diff
   position) [orchestrator; the design may show threads there if it keeps one place rule].

## Owner's answers

1. A changed-again file shows only the changes since the review, plus a way to reset it and review the whole change
   from the start (rules 5–6).

## Acceptance

WebKit fixture (`?range`) and the real app on a scratch repository: mark two files reviewed, the second click opens
the next unreviewed file; restart yamt on the same `dev...HEAD` → both still reviewed; add a commit that changes one of
them → that file shows "changed since reviewed" and its view shows only that commit's change to it; "Review from
start" shows the whole change and the file unreviewed; the other stays reviewed; unmark works; a merge request's
changes window keeps its marks after a push to the merge request. `just check` passes; dark and light.

## Non-goals

Writing anything to GitLab (yamt's marks are its own); marks per line or per change inside a file; marks in the merge
or compare windows; carrying comment threads across commit pairs; telling an upstream change pulled in by a rebase
apart from the author's own change (the since-review view shows both).
