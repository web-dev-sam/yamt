# Request — the author's name in the turn words, a marked discussions button, no Escape out of the list, review mode's order

Asked by the owner on 2026-11-04 (#2423–#2426); details by the orchestrator as owner (OR13), marked "(orchestrator)",
the owner may veto. Base: main `f93d0020`. Window: the merge-request page's pure core
(`frontend/src/mergeRequests/internal/discussions.ts` `turnText`/`turnCounts`, `reviewOrder.ts` `reviewOrdered`/
`reviewSortedText`), the discussions button and box (`frontend/src/ui/MergeRequestDiscussions.vue`), the page
(`frontend/src/ui/MergeRequestsView.vue` `escapePressed`). No Rust, no IPC change.

## Owner's words

> - Replace "Authors turn" with "[NAME]s turn".
> - If there is an open discussion on a MR with "your turn" or "[review mode reviewer name]s turn" (the ones that show
>   up purple), make the open discussions button in the MR list row highlighted in the same way. One is enough.
> - esc can close the MR list. dont allow that behaviour, closing the MR list must be a mouse click or keyboard focus
>   press but never ESC
> - the sorting of in reviewer mode is odd. It doesnt place the most important ones at top (the ones with the most on
>   the review mode reviewer waiting open discussions (the purple highlighted ones)). Sort importance: ones with due
>   date in an order where the closest due date is on top. Then the amount of on the review mode reviewer waiting open
>   discussions - biggest to smallest, then amount of review mode reviewers discussions on the MR in total (in visible
>   number, smallest first (means the reviewer hasnt looked into it yet))

## Part A — the author's name (#2423)

- **A1.** A discussion that is the merge request author's turn reads "<author's name>'s turn" ("Dmitri Volkov's
  turn"), the name as the row shows its author (`displayName`), in the box's lines and the thread panel's header.
- **A2.** (orchestrator) A row whose author GitLab does not give keeps "Author's turn".

## Part B — the discussions button marked (#2424)

- **B1.** A row's discussions button (icon and count) is drawn as the purple turn words are (`text-primary
  font-semibold`, `MergeRequestDiscussions.vue:306`) when at least one of its open discussions is the turn of the one
  the box speaks for: the logged-in user ("Your turn"), or review mode's reviewer ("Anna Berg's turn").
- **B2.** It follows the box's header: the same discussions ("N of M wait for you" with N ≥ 1 ⇔ marked), so a
  discussion resolved in the box stops counting at once, and switching review mode's reviewer moves the marks.
- **B3.** (orchestrator) Only rows whose discussions have been read can be marked: with "Load fully" (the default)
  every row once loaded; with "Load lazily" a row after its box was opened; with "Off" none.

## Part C — Escape never leaves the list (#2425)

- **C1.** Escape never closes the merge-request page, wherever the focus is and whatever was open before. The page
  closes only by Back (a click, or Enter/Space on the focused button) and as today by showing a file or a tab.
- **C2.** Every other Escape stays: it closes an open filter menu, a box, a field, the thread panel, the description,
  a job log, a question, as today.

## Part D — review mode's order (#2426)

For the reviewer review mode speaks for, the shown rows sort by, in this order:

- **D1.** Due date: rows with a due date first, the soonest on top (an overdue date is sooner than today's, as the
  normal order, plan #156); then the rows without one.
- **D2.** Then the number of open discussions that are the reviewer's turn (the purple ones): most first.
- **D3.** Then the number of open discussions the reviewer has written in: fewest first (0: the reviewer has not
  looked at it yet). **Open question for the owner (Q1 below).**
- **D4.** (orchestrator) Ties keep the normal order (newest first). Rows whose discussions have not arrived count 0
  and 0 and move when they arrive; a failed row keeps the whole list in the normal order with the tooltip saying why
  (review-mode rules 6, unchanged).
- **D5.** (orchestrator) The sort icon's tooltip names the new order: "Sorted for your review: soonest due date
  first, then most discussions waiting for you, then fewest discussions you wrote in" (another reviewer: "Sorted for
  Anna Berg's review: soonest due date first, then most discussions waiting for Anna Berg, then fewest discussions
  Anna Berg wrote in"), plus today's loading sentence.

A due row with nothing waiting now sorts above an undated row with many waiting discussions (D1 before D2, the
owner's order); today only due rows with the reviewer's turn came first.

## Open question

- **Q1 (D3).** "The reviewer's discussions in total": (a) open discussions the reviewer wrote in — started or answered
  — (recommended: 0 means they have not looked at it), or (b) every open discussion on the merge request (the number
  on the row's button).

## Acceptance

Core tests: A1/A2 words; D1–D4 each step, a tie, a reviewer other than Me, loading rows; the tooltip words. Window
tests: B1/B2 marked and unmarked buttons, a resolve in the box unmarking it; C1 Escape on the page (focus on Back, on
the body, after closing a box and a thread panel) leaves the page open, C2 Escape still closes an open filter menu.
WebKit fixture (`?mr=list`), dark and light: the turn words name the author; purple buttons exactly on rows whose box
says "N of M wait for you" with N ≥ 1, and in review mode for the reviewer; Escape never leaves; Back's click and Enter
do; review mode's order and tooltip with two dated rows. `just check` passes.

## Non-goals

Any other order (the normal list keeps #156's); a mark for "Load lazily" rows not yet read; GitLab's own turn words;
a change to whose turn a discussion is (request-mr-threads B1–B6 stand); Escape on the server log or settings pages.

## Reopens (DR4: the owner's changed requirement)

- Plan #128's "Back … or Escape … closes it" and the threads panel's "the one after leaves the page" (plan #183,
  `ui/AGENTS.md`): Escape no longer leaves.
- Plan #163/#179 and request-mr-threads B1/B3's word "Author's turn": the author's name (A2 keeps it for an unknown
  author).
- Plan #165, request-mr-review-mode rules 3 and 4, plan #185's "review mode's 'waiting on the author' counts it": the
  order is D1–D4, "waiting on the author" leaves the order and `TurnCounts.authorsTurn` goes.
- Plan row #189 (proposed, docs keeper) records A–D.
