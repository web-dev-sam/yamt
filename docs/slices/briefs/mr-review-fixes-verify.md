# Verify mr-review-fixes — smoke after the slice, final run

Request `docs/slices/request-mr-review-fixes.md` (A–D, Acceptance); slice brief `briefs/mr-review-fixes.md` (its smoke).
Read-only recipes only (VF6), never `just mutants` (VF7).

## Smoke (after the slice's commit)

Fixture `just app-session start-fixture --name mrfv --diff --mr list --size 1600x1000`, the merge-requests page, dark,
then light (`--settings '{"theme":"light"}'`):

1. A1: a box line whose turn is the row author's reads "<author's name>'s turn"; its thread panel header the same.
2. B1–B2: every row's discussions button is purple exactly when its box header reads "N of M wait for you" with N ≥ 1
   (check each listed row); resolve the only such discussion in a box → the button turns plain.
3. Review mode for another reviewer: the purple buttons and the box words follow that reviewer.
4. C1: Escape with focus on Back, on the body, after Escape closed a box, after Escape closed a thread panel → the page
   stays. C2: Escape with a filter menu open closes the menu only. Back by click and by Enter closes the page.
5. D1–D5: give two rows due dates (one overdue, one in a week) through the due-date box; review mode for Me: the overdue
   row first, then the other dated row, then the undated rows by most "your turn", then fewest written in; the sort
   icon's tooltip has D5's words.

## Final

`just check`; the smoke steps 1–5 again on the final commit; the real app on the fake glab (`just app-session start
--mr`): steps 1, 2 and 4.

## Owner check (GitLab playground)

On a real merge request: the author's name in a turn word, a purple button where a discussion waits for you, review
mode's order with a due date set.
