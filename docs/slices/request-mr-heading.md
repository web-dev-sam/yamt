# Request — a merge request's changes window names the merge request, its branches and the whole diff's +/− counts

Settled with the owner on 2026-11-25 (session 59); details by the orchestrator as owner (OR13) where marked, the owner
may veto. "Changes window" is the range window a merge-request row opens (`yamt --diff=<base_sha>..<head_sha> --repo
<root> --review-of=<project>!<iid>`, `src-tauri/src/second_window.rs:45-57`); a "plain diff window" is one started by
hand (`yamt --diff=main...dev`). A design may refine a detail a rule names, never reopen a rule.

## Owner's words

- "can we make the titles show the MR information like source and target branches and fully diff additions/deletions?"
- Where: "both [title bar and column headers], but not in raw text form, structure/color it so its easily parsable by
  eye".
- Totals: added up from the window's own file list (works offline, matches the list); plain diff windows show the
  totals too.

## Why the window shows commit ids today (not reopened)

Plan §2 #132: the window opens GitLab's `base_sha..head_sha`, so the posting check (#119, `crates/review/src/lines_up.rs`)
lines up by construction; no ref is written (RK40). The comparison, the pair lock, the threads and the Reviewed marks
stay keyed by those two commits and by `project!iid` exactly as today. Only what the window **shows** changes.

## Rules

1. **Title bar (plain text; the platform allows no colour).** Parts set apart by two spaces, never a separator
   character (owner, rule VU18): changes window `!<iid> <MR title>  <source> → <target>  +<added> −<removed> — <folder>
   — yamt`; plain diff window `<range as typed>  +<added> −<removed> — <folder> — yamt`. The ` — <folder> — yamt` end is
   every window's title today (`src-tauri/src/range.rs:97-98`, `window.rs:187-190`) and stays.
2. **Inside the window: one structured, coloured merge-request line** on the files screen, whatever file is shown and
   when none is: the reference `!<iid>` and the title, the two branches as distinct visual parts (source → target,
   branch names in the look GitLab readers know: monospace chips or equivalent from the existing palette), and the
   totals in the list's own colours (`RangeCounts.vue`: `text-success-signal` / `text-problem-error`). Parts are set
   apart by spacing and alignment only, no separator character (owner, VU18). A plain diff window shows the same line
   with its two typed names in place of the branches and no reference or title. Hidden on the Settings and merge
   request list screens (owner, rule 7). It must not push the existing header controls off a 1280 px window.
3. **Column headers, structured.** Left = the target branch name, marked as "where `<source>` branched off" (the merge
   base GitLab's diff starts from), plus the short id; right = the source branch name plus the short id. Name
   emphasised, short id muted and monospace; the commit subject stays the hover title. Never a 40-character id in a
   header. Plain diff windows use the same wording and look with their typed names: `main...feature`'s left reads
   "main, where feature branched off" instead of today's "merge base of main and feature" (owner).
4. **Totals** (owner): the sum of the window's listed files' counted lines (`RangeLineCounts::Counted`); a file the list
   shows without counts (binary, missing) adds nothing, as in the list (orchestrator, boring option). The totals are
   the whole range's, not the shown file's, and do not change with Reviewed marks or the search.
5. **Where the names come from** (orchestrator, vision 2 and 5): the merge request's title and both branch names come
   from the GitLab answer the click already fetches (`open.rs` details query, which today reads `state targetBranch
   diffRefs`); the changes window makes **no** extra GitLab call to learn them and shows them offline. They are the
   names at the moment of the click; the window does not follow later renames. A fork's source branch is shown as
   GitLab names it to the target project's readers (the design states the exact form, sourced); a fork GitLab does not
   show the reader is marked as one: "(fork) <branch>", never the bare branch, which would read as the target
   project's own (owner).
6. **Nothing else moves.** The comparison stays `<base_sha>..<head_sha>`; the posting check, the threads, the pair lock,
   the Reviewed marks and `--review-of` behave as today. A changes window started by an older yamt's arguments (no
   names) still opens and shows what it has (the commit ids, structured as rule 3).
7. **The side column only beside files** (owner: "Hide the sidebar when in settings view or merge request list view").
   In every window that has one (merge `App.vue`, compare `CompareApp.vue`, range `RangeApp.vue`), the side column
   (file or tab list and search) shows only on the files screen; on Settings, the merge request list and the merge
   window's server log the screen takes the whole width. Coming back to the files screen restores the side column as
   it was (list shown or hidden, search open, scroll).

## Owner's answers

1. Title bar and column headers both, structured and coloured, never raw text.
2. Totals summed from the window's own file list; plain diff windows show them too.
3. No separator characters; spacing and alignment (now rule VU18 for all work).
4. The side column and the merge-request line show only on the files screen (rule 7).
5. Plain diff windows switch to the "where … branched off" wording.
6. A fork GitLab does not show is marked "(fork) <branch>".

## Acceptance

WebKit fixture (`?range` with a merge-request variant and a plain one) and the real app on the fake GitLab
(`range-repo.sh`, !13): from the merge-request page open !13 → the title bar reads `!13 <title>  <source> → <target>
 +A −R — <folder> — yamt` with A/R equal to the sum of the list's per-file counts; the window shows the coloured
merge-request line and both column headers by branch name with muted short ids; posting still lines up; a plain `yamt
--diff=main...dev` window shows its totals in the title bar and the line; Settings and the merge request list hide the
side column and the line in all three windows, and the files screen brings both back as they were. `just check`
passes; dark and light.

## Non-goals

Comparing by branch names (`origin/dev...origin/branch`) — reopens #119/#132; colours in the OS title bar; GitLab's
own diff counts; updating the names or counts while the window is open; per-file totals beyond what the list shows; a
click target on the merge-request line (opening the GitLab page) unless the design finds one already offered.
