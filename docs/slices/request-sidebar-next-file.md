# Request — the next file after Reviewed / Mark resolved is the sidebar's next file; a remaining-changes total

Settled with the owner on 2026-11-25 (session 60); details by the orchestrator (OR13) where marked, the owner may veto.
Recorded as plan §2 #201; amends #48's next-file order ("the list's order") and #196's "next file in `start.files`
order".

## Owner's words

- "When I press "reviewed" it jumps to a random file sometimes, I want it to jump to the next in the sidebar visible
  file (in tree mode may be different from list mode), ask if unclear. Left of the tree/list view toggle put a muted
  text showing the change counts that are left to be reviewed (accumulate non-reviewed file diff counts)"
- Answers (form, 2026-11-25): a next file inside a **closed folder is still the next file** (its folder opens, as a
  click on it would); the merge window's **Mark resolved follows the same rule**.

## Cause (orchestrator, read in the tree)

`nextFile.ts` `nextOpen` walks the files in git's order (`start.files` / the merge window's `files`). The list view
shows that order; the tree view sorts folders first, then names (`fileTree.ts` `pushRows`), so after Reviewed in tree
view the jump lands on a file that is not the one below.

## Rules

1. **One order rule.** "The next file" after Reviewed (diff window) and after Mark resolved (merge window) is the next
   file row the sidebar shows in its current view: the list view's order in list view; in tree view, the tree's order
   with every folder counted as open (a file in a closed folder keeps its place). Wrapping, skipping done files and
   "none left → stay" are as today.
2. **A closed folder opens.** Jumping to a file inside a closed folder opens the folders above it (today's reveal on a
   shown file).
3. **Remaining total.** In the diff window's sidebar heading, left of the list/tree toggle, a muted `+added −removed`:
   git's counts summed over every file whose mark is not "reviewed" (unmarked and "changed since review" count their
   whole change; a file without counts adds nothing). It updates the moment a mark changes. Hover and accessible
   name: "left to review" (orchestrator).
4. **Nothing left.** When every file is reviewed, or no unreviewed file has counts, the total is not shown
   (orchestrator).
5. The merge window shows no total (no reviewed marks there).

## Non-goals

The order of the list view itself; folder totals (#200: Shift only); keyboard navigation of the list; marks' storage.

## Acceptance

- Tree view, a range whose git order differs from the tree's: Reviewed moves to the next row below in the tree,
  wrapping at the end; a target in a closed folder opens it; list view follows the list.
- Merge window, tree view: Mark resolved moves to the next unresolved file row below in the tree.
- The total equals the sum of the unreviewed files' counts, changes on Reviewed / unmark / Review from start, is muted,
  hovers "left to review", and is absent with everything reviewed; dark and light themes.
