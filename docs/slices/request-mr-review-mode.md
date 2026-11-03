# Request — review mode: the next merge request to review, for me or any reviewer

Asked by the owner on 2026-11-03 (#2194, second in importance; answers #2198); details by the orchestrator as owner
(OR13, the owner may veto). A design may refine a detail it names, never reopen a rule. Base: main `399f0eb0`, after
`request-mr-discussions.md` is built (this feature sorts by its data). Window: the merge-request page
(`frontend/src/ui/MergeRequestsView.vue`, filters and `Clear filters` at `:167`; the list order in the
`mergeRequests/` core). Reopens plan §2 #151's "still no sort choice" (owner #2194: one sort, set by this mode).

## Owner's words

- "A review mode, that sorts by the new number of open discussions where the last comment is the reviewers comment.
  (its not always "Me", it can be set to any of the maintainers to see the optimal next mr to review for somebody
  else). That mode button also sets the filters to filter only ready MRs, where the review mode reviewer is a
  reviewer on the MR. The button only sets the filters and sorts and can be cleared with the existing "clear
  filters" button. The sorting feature need to be thought about, I want to avoid a long title for it that takes too
  much space, an icon with tooltip is better."
- (#2198) Order: "your recommendations + put the timed ones that have atleast one waiting discussion (where the last
  comment is not the reviewers) with a dealine at the top". Ready: "Not a draft".

## Rules

1. **One button, one reviewer.** A review-mode button in the filter bar, an icon with a tooltip ("Review mode"). It
   asks for whom: "Me" first, then every person the Reviewer filter offers (the reviewers of the loaded merge
   requests), as that filter lists them.
2. **It only sets filters and the order.** Choosing a person replaces the filters with: Reviewer = that person
   (included) and Draft = not a draft ("ready", #2198), and sets the review order (rule 3). The search text stays.
   Nothing else changes; the filters can then be changed as usual and the order stays. **Clear filters** clears the
   review order too, back to the normal order. Filters and order are remembered per repository, as filters are.
3. **The review order** (#2198), for the chosen reviewer, with "waiting" from `request-mr-discussions.md` rule 3:
   1. first, merge requests with a due date and at least one open discussion whose last comment is not the
      reviewer's (the reviewer's turn), soonest due date first;
   2. then the rest, fewest open discussions whose last comment is the reviewer's (the reviewer waits for the
      author) first;
   3. ties keep the normal order (due ones first, soonest on top, then newest).
4. **The order shows as an icon.** While the review order is on, a small sort icon sits with the filters; its
   tooltip says for whom and how ("Sorted for <name>'s review: due with your turn first, then fewest waiting on the
   author"). No long title takes width.
5. **Whose turn follows the mode.** While review mode is on, the discussion box speaks for the chosen reviewer
   (`request-mr-discussions.md` rule 3); after Clear filters, for the logged-in user again.
6. **Details not loaded yet.** Rows whose discussion details have not arrived sort as if they had none and move once
   they arrive; a failure to read them leaves the normal order with the tooltip saying why.
7. **Only with details loaded fully** (owner #2199). The review-mode button and its order exist only while
   Settings' "Discussion details" is "Load fully" (the default, #2200; `request-mr-discussions.md` rule 8). With
   "Load lazily" or "Off" the button is hidden; switching there turns an active review order off, its filters stay.

## To be measured by the design (unverified)

- Where the order lives (the core's list order, `mergeRequests/`) and how the stored filter words gain the order
  and the person (plan §2 #134/#155's stored form, older yamt still reading it).
- The reviewer picker: a menu like the filters' (`useHoverMenu`) or the Reviewer filter's own list.
- Rows moving while the user reads (rule 6): whether a late arrival should move rows at once.

## Acceptance

Core tests for the order (rule 3 every step, ties, a reviewer other than Me) and for Clear filters dropping it.
WebKit fixture (`?mr=list`): pick a reviewer → Reviewer and Draft filters set, the sort icon with its tooltip, rows
in rule-3 order; change a filter → order kept; Clear filters → normal order; reload → mode and order back; dark and
light. Real app on the fake glab: the same. `just check` passes.

## Non-goals

Other sort choices; sorting outside review mode; assigning reviewers; notifications; a reviewer not on any loaded
merge request.

## Slice graph (proposal; the session's orchestrator refines it)

| row | slice                                                         | owner       | needs |
| --- | ------------------------------------------------------------- | ----------- | ----- |
| 1   | design: order's home, stored form, picker, late arrivals      | designer    | —     |
| 2   | core: review order, stored mode, Clear filters                | web-impl    | 1     |
| 3   | page: button, picker, sort icon and tooltip; wires the window | web-impl    | 2     |
| 4   | docs keeper                                                   | docs-keeper | 3     |
| 5   | verify: smoke after 3; final `just check`, WebKit, real app   | verifier    | 3     |
