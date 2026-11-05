# Request — one person's discussions across every merge request

Asked by the owner on 2026-11-05 ("Plan a view …"); details by the orchestrator as owner (OR13), marked
"(orchestrator)", the owner may veto. A design may refine a detail it names, never reopen a rule. Base: main
`197f8c6e`. Window: the merge-request page (`ui/MergeRequestsView.vue`, the slice `ui/mergeRequests.ts`), the
discussion queue (`ui/mergeRequestDiscussions.ts`, `ui/mergeRequestDiscussionRows.ts`), the turn rule
(`mergeRequests/internal/discussions.ts`), the thread panel and its state (`ui/MergeRequestThread*.vue`,
`ui/MergeRequestReplyField.vue`, `ui/mergeRequestThread.ts`), the discussions read
(`crates/merge-requests/src/discussions*`). Facts with `path:line`: `.omp/run/notes/PlanScoutPersonDiscussionsFacts.md`.

## Owner's words

> Plan a view reachable from the MR list that is a flat list of all discussions where a selected person was
> participating in sorted in the following ways (the person is expected to answer next -> the person opened the
> discussion -> the person wrote a comment in the discussion -> the person is reviwer of the MR where the discussion
> was made -> all other discussions of all MRs). An entry in that list is the first comment in the discussion and
> under that a list of all pfps in a row of the commenters below (anna started discussion, Markus repied, Erin
> commented after: This shows the discussion that was started and under it 2 pfps in a row of markus on left and
> erin on right). That way it becomes obvious how long the thread is and who is expected to answer. with a press on
> shift on the hovered row it expands the entire thread and has a input for replying just like in the open
> discussion list in the MR list, with all the features like preview and the buttons. Shift doesnt toggle, it
> expands and then there should be a chevron icon on left for collapsing/expanding

## Part A — reaching the view

- **A1. The button.** The page's filter row gets a button "Discussions" (Lucide `messages-square`, tooltip "Every
  open discussion, for one person") that shows the view in place of the row list on the same page (orchestrator).
  A "Back to list" button in the view's header returns to the list exactly as it was (filters, search, review
  mode, scroll). Escape never leaves the page (plan #189 C stands).
- **A2. Both windows.** The view exists wherever the page does (compare and range windows).

## Part B — the selected person

- **B1. Starts on the viewer**: the logged-in user, or review mode's chosen reviewer when review mode is on
  (plan #163, #165).
- **B2. Picking someone else.** A person menu in the view's header lists everyone on the listed merge requests
  (authors, assignees, reviewers, approvers) and everyone who wrote in their discussions, "Me" first, then by name,
  each with picture and name; typing narrows it (orchestrator). No project-wide search (non-goals).
- **B3. Whose words.** Turn words read from the selected person's side, as review mode does: "Your turn" when the
  person is the viewer, "<Name>'s turn" otherwise. Every write is still made as the logged-in user (plan #185).

## Part C — which discussions, in which order

- **C1. Which.** Every open discussion of every merge request the list currently shows (its filters and search
  applied), in one flat list without headings (owner's answer 1).
- **C2. Order.** Each discussion goes in the first group that applies, groups in this order; within a group,
  newest last comment first, as the discussions box (orchestrator):
  1. it is the person's turn (the threads request's rule B2, with the person as the viewer);
  2. the person started it;
  3. the person wrote a comment in it;
  4. the person is a reviewer of its merge request;
  5. every other discussion.
- **C3. Staying in place.** A discussion does not jump while the person looks at it: an entry that is expanded, or
  that was answered or resolved from the view, keeps its place until the view is refreshed or left (orchestrator;
  the box's held-row rule, plan #189). A resolved one shows "Resolved" (threads request C10).
- **C4. Refresh.** The view's header has the page's refresh look (Lucide `refresh-cw`, "Reload discussions"): it
  asks GitLab again for the listed merge requests' discussions; entries stay while it loads.

## Part D — an entry

- **D1. Its head.** The first comment's writer (picture, name), how long ago it was written (exact date on hover,
  `DD.MM.YYYY, HH:MM`), the merge request (`!640` and its title, muted) and the place (`file:line` or "Overview",
  as the box) (orchestrator).
- **D2. The first comment.** Its text formatted as GitLab shows it (thread panel rule C4: formatting, code
  colours, images, links open in the browser), cut to about four lines while collapsed (orchestrator).
- **D3. The pictures row.** Under it, one picture per later comment, oldest left, newest right; a person who wrote
  twice shows twice (the owner's example: Anna starts, Markus replies, Erin answers → Markus, Erin). Each picture's
  tooltip names its writer. A discussion with only its first comment shows no pictures. Right of the row, the turn
  word ("Your turn", "Markus's turn", "Open") from the one turn rule (threads request B5).
- **D4. A long thread.** When the pictures do not fit the entry's width, the oldest fold into one "+N" at the left,
  so the newest writers stay visible (orchestrator).

## Part E — expanding an entry

- **E1. Shift expands.** A Shift tap (the CI log's rule, plan #159) with an entry under the pointer or focused
  expands it. Shift on an expanded entry does nothing: Shift never collapses. A Shift tap while typing in a text
  field types (as the box).
- **E2. The chevron.** Every entry has a chevron at its left (Lucide `chevron-right` collapsed, `chevron-down`
  expanded); a click, or Enter/Space on it, collapses and expands (owner's answer 3).
- **E3. Expanded.** The entry shows the whole thread and answers it exactly as the thread panel beside the
  discussions box does (threads request C3–C10 and the mentions request): fresh from GitLab each time it expands
  ("Loading…", a failure with Retry), every comment with picture, name, crown, times and edits, pending drafts; the
  growing reply field with Write/Preview, `@` completion, Ctrl+Enter; Add review, Add comment, Resolve/Unresolve
  thread; Submit review with the pending count for that merge request.
- **E4. Several at once.** Any number of entries may be expanded together, each with its own thread and reply
  text. A reply text is the same one the box's panel shows for that discussion (kept per discussion while the
  window is open, threads request C6). Collapsing keeps the text; expanding again reads the thread fresh. One write
  at a time in the window, as today.
- **E5. Keys.** Escape in a reply field leaves the field (focus back on the entry), never collapses and never
  leaves the page (orchestrator).

## Part F — loading

- **F1. What it needs.** The view needs every listed merge request's discussions. Opening it asks for those the
  page has not read yet, through the page's one discussion queue (plan #164), then shows entries as merge requests
  arrive, with "Loading discussions — 12 of 27 merge requests" in its header, whatever "Discussion details" says
  (owner's answer 2).
- **F2. Failures.** A merge request whose discussions could not be read is named in one line under the header
  with GitLab's reason and Retry; the rest of the list shows.

## To be measured by the design (unverified)

- The first comment's formatted text per discussion (Rust reads `bodyHtml` for every note and drops it,
  facts §1): carrying it in the discussions read for every row (payload, time on a big project, image offers) or a
  separate read; the later commenters' order is already there (`earlier` + `last`), their times are not.
- The thread state from the window's one slot (`state.md:89`, `ui/mergeRequestThread.ts:36-44`) to several
  expanded threads without changing the box panel's behaviour; one write at a time kept.
- The thread panel's body (comments, drafts, reply field, header buttons) reused inline: today it is tied to its
  beside-the-box placement (`ui/MergeRequestThread.vue:52,139`).
- Loading every row under each "Discussion details" setting; the time for a big project (10 rows per call,
  12–23 s measured, facts §1).
- The fixtures: `?mr=list` has mostly one-comment discussions; multi-writer threads across several rows are needed
  for the pictures row and the order.

## Acceptance

Core tests: every group of C2 by name for the viewer and for another person, the newest-first order inside a
group, a held entry keeping its place, the pictures row's writers and its "+N" fold. Rust against the fake glab (if
the read changes): the first comment's text arrives for each discussion in one read. WebKit fixture (`?mr=list`),
dark and light: the button shows the view, Back returns the list unchanged; the person menu switches from Me to
Anna and the order changes as C2 says; an entry shows its first comment, the pictures in order and the turn word;
Shift expands, a second Shift does not collapse, the chevron collapses and expands; two entries expanded at once;
Add comment, Add review, Submit review, Resolve, Preview and `@` in an expanded entry behave as in the box's panel;
a text typed in the box's panel shows in the view's entry for the same discussion. Real app on the fake glab: one
thread read per expansion, each write sent once. `just check` passes. Owner check on the GitLab playground: the
view for himself and for a colleague lists the discussions waiting on that person first.

## Non-goals

Resolved discussions (beyond C3); closed or merged merge requests and those the list does not show; people found
only by a project-wide search; writing as the selected person; starting, editing or deleting comments; reactions;
live updates without a refresh; a second way to sort or group the list.

## Reopens (DR4: the owner's changed requirement)

- `state.md:89` and the threads design: "the window's one thread panel" — several threads may be shown at once.
- Threads request C1–C2: the thread shows in the view's entries too, not only beside the box.
- Plan #162/#179 (what the discussions read keeps per note), if the design carries the first comment's text.

## Owner's answers (2026-11-05)

1. Every open discussion of the listed merge requests, the person's first ("every discussion, ther list was
   sorting impotance"), chosen over only the person's own.
2. Opening the view loads every missing merge request's discussions under any setting, chosen over requiring
   "Load fully".
3. The chevron on every entry, chosen over only on entries expanded once.

## Slice graph (proposal; refined after the design)

| row | slice                                                                                             | owner                 | needs |
| --- | ------------------------------------------------------------------------------------------------- | --------------------- | ----- |
| 1   | design: first comment's text and cost, several threads, inline thread body, loading, briefs       | designer              | —     |
| 2   | Rust: first comment's formatted text in the discussions read, fake glab                           | rust-impl             | 1     |
| 3   | core: the five groups, held entries, pictures row and its fold                                    | web-impl              | 1     |
| 4   | state: several threads, the view's person, loading every row, ipc + fixtures                      | web-impl              | 2, 3  |
| 5   | view: button, Back, person menu, entries, Shift and chevron, inline thread body; wires the window | web-impl              | 4     |
| 6   | docs keeper; verify: smoke after 5, final `just check`, WebKit, real app                          | docs-keeper, verifier | 5     |
| 7   | owner check on the GitLab playground                                                              | human                 | 6     |
