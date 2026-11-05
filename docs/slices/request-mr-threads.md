# Request — whose turn it really is, the whole thread beside the box, answering it, and sized images

Asked by the owner on 2026-11-04 (#2329–#2332, answer #2333); details by the orchestrator as owner (OR13), marked
"(orchestrator)", the owner may veto. A design may refine a detail it names, never reopen a rule. Base: main
`69ab62d0`. Window: the merge-request page's open-discussions box (`ui/MergeRequestDiscussions.vue`, the turn rule
in `mergeRequests/internal/discussions.ts`, the queue `ui/mergeRequestDiscussions.ts`, the read
`crates/merge-requests/src/discussions.rs`), review mode's order (`mergeRequests/internal/reviewOrder.ts`), the
description panel's reducer and renderers (`crates/merge-requests/src/description/**`,
`ui/MergeRequestDescription*.vue`), the CI log's Shift tap and side panel (`ui/useShiftHeld.ts`,
`ui/CiStatusBox.vue`, `ui/CiStatusJobLog.vue`), the range window's draft notes (`crates/review/src/gitlab.rs`).
Facts with `path:line` and GitLab sources: `.omp/run/notes/PlanScoutMrThreadFacts.md`.

## Owner's words

> does the MR description in yamt also parse the width/height of the images (like `![..](..){width=20%}`)?
> — alright, add this to a new feature plan.

> While testing, I noticed that open discussion panel/list shows open discussions that are not returned to "me" but
> is labelled as "Your turn". It should be clearer and smarter. It can show "Your turn" but only if im actually
> expected to answer... for example: 1. I opened the discussion and the last comment is not from me. 2. The
> discussion mentions me and I have not replied after 3. think of other situations where is pretty obvious that im
> expected to answer. It could also show "Authors turn".

> When pressing shift while hovering over one of these open discussions rows, it opens a panel on the left of that
> panel that shows the entire discussion including pfps, names, content, images, formatted markdown, how long ago the
> comment was edited like in gitlab (2 weeks ago, 3 days ago, 3 hours ago, ...) and the author has a crown next to
> their name. and an input that grows (multiline) and takes markdown (no markdown editor, thats too much) and a button
> to resolve the thread (it doesnt disappear immediately and only when the open discussions list is closed, or
> refreshed), and a toggle to see the rendered markdown and go back to the input. The button to resolve is on the
> very right in the action buttons row below the input and left in that row there are also buttons for "Add review"
> (draft review comment) and "Add comment" (immediate)

> and a refresh button at the top of the open discussions panel with which to only reload that MRs discussion list.

## Part A — images keep the size GitLab gives them (#2329)

- **A1. The size written in Markdown is kept.** An image whose Markdown carries `{width=…}` and/or `{height=…}`
  (GitLab accepts a number with `px` or `%`, or a bare number meaning pixels) shows at that size in the description
  panel and in the thread panel (part C), as on GitLab. Only width given: height follows the picture's own
  proportions; only height given: width follows; both: both. A percentage is of the text column's width.
- **A2. Never wider than the panel.** A size wider than the text column shrinks to fit it, proportions kept (today's
  "fits the panel's width at most", description request rule 5, stays).
- **A3. Nothing else changes.** No size written → the picture's own size, as today. A size outside GitLab's form is
  ignored, as GitLab ignores it. A failed image's stand-in text ignores the size.

## Part B — "Your turn" only when it is (#2330)

The viewer is who it is today: the user glab is logged in as, or review mode's chosen reviewer (plan #163, #165).
"The author" is the merge request's author. A comment is a note written by a person; GitLab's system notes never
count (rule 4 of the discussions request stands). "Mentioned" is a GitLab user reference to the person in a comment
(`@username`, as GitLab links it); `@all`, `@here` and group mentions do not count (orchestrator).

- **B1. Waiting on someone else.** When the viewer wrote the last comment, the discussion is not the viewer's turn.
  It reads whose turn it is instead: "Author's turn" when the viewer is not the author; when the viewer is the
  author, the turn of whoever started the discussion ("Anna's turn"), or "Waiting for an answer" when the author
  started it.
- **B2. The viewer's turn** ("Your turn"; "<name>'s turn" in review mode for another reviewer) when someone else
  wrote the last comment and at least one of these holds:
  1. the viewer started the discussion;
  2. the viewer is mentioned anywhere in it, in any comment by someone else, whether or not the viewer answered
     since (owner #2334);
  3. the viewer is the author (a reviewer's open point on your own merge request waits on you; today's rule, kept
     for the author);
  4. the viewer took part in it (wrote at least one comment) and someone else answered after the viewer's last
     comment (orchestrator: an answer in a thread you spoke in is addressed to you often enough to show).
- **B3. Someone else's turn** when neither B1 nor B2 holds; the first of these that applies:
  1. the last comment mentions people other than its writer: the first one mentioned ("Ben's turn");
  2. the last comment is not the author's: "Author's turn";
  3. the last comment is the author's and someone else started the discussion: that person's turn ("Anna's turn");
  4. otherwise: no turn, the row reads "Open".
- **B4. The box's header and order.** "N of M wait for you" counts B2 only. Order: the viewer's turn first, then
  every other discussion; newest last comment first within each (as today).
- **B5. One rule everywhere.** Review mode's order (plan #165: due rows with the reviewer's turn first, then fewest
  waiting on the author) reads the same turns: "waiting on the author" means "Author's turn" under this rule. The
  turn words in the box, the thread panel and review mode's tooltip come from the one rule.
- **B6. A deleted person** ("Someone") is never the viewer, never the author and never mentioned.

## Part C — the whole thread beside the box, and answering it (#2331, #2333)

- **C1. Opening.** While the open-discussions box is open, a Shift tap (the CI log's rule: Shift down and up with
  no other key or press between, plan #159) with a discussion row under the pointer or focused opens that
  discussion's thread in a panel directly left of the box, top-aligned with it (orchestrator: about
  `min(40rem, 100vw − 2rem)` wide and `min(48rem, 100vh − 2rem)` high, its comments scrolling inside, the answer
  field and buttons always visible at its bottom). A tap over another row shows that row's thread instead. A Shift
  tap while typing in a text field types, never switches (as the CI log). The row the panel shows is marked in the
  box. The row's tooltip names the key ("Shift: show the thread").
- **C2. What stays open.** While the panel is open the box stays open whatever the pointer does. Escape closes the
  panel first (the keyboard back on its row), a second Escape the box; the panel's close button (Lucide `x`,
  "Close") closes the panel; a press outside both closes both (orchestrator). A list refresh leaves both open and
  refreshes them (D3).
- **C3. The thread.** Its header: where it is (`file:line` or "Overview", as the box) and a button that opens the
  discussion on GitLab (the first comment's page, through the one opener). Then every comment, oldest first, system
  notes left out. Per comment: the person's picture and name (as the people box), their `@username` muted, a crown
  (Lucide `crown`, tooltip "Author") right of the author's name, and how long ago it was written ("3 hours ago",
  "2 weeks ago"; the exact date and time on hover, `DD.MM.YYYY, HH:MM`). An edited comment adds "· Edited 3 days
  ago", plus "by <name>" when someone else edited it, as GitLab writes it.
- **C4. Formatted as GitLab shows it.** A comment's text is GitLab's own rendering of it, under the description
  panel's rules (description request rules 3–6, plan #171–#173): formatting, tables, code blocks in yamt's code
  colours, images (uploads with the login on gitlab.com, other sites' straight from them; sizes as part A), links
  open in the browser, nothing runs. A suggestion block shows as its code (orchestrator).
- **C5. Fresh when opened.** The panel asks GitLab for the whole thread each time it opens on a discussion
  ("Loading…" until then; a failure is one sentence with Retry in the panel), never a stale copy. It holds every
  comment of the thread, not the last 20 (orchestrator: GitLab answers up to 200 per page).
- **C6. The answer field.** Below the thread: a plain multi-line text field (no toolbar, no editor colours), its
  placeholder "Write a reply… (Markdown)", starting at three lines and growing with its text up to about twelve, then
  scrolling inside. Its text is kept per discussion while the window is open, whatever is closed in between, and
  cleared only when it was sent (orchestrator).
- **C7. Write / Preview.** A two-state switch above the field ("Write" / "Preview") shows the text as GitLab will
  render it in this project (references, mentions, images included), then back to the same text and caret.
  "Loading…" while GitLab renders it; "Nothing to preview." for an empty field; a failure is one sentence, the text
  untouched (orchestrator: GitLab's own rendering, so the preview matches what the thread will show).
- **C8. The buttons row**, below the field: left "Add review" then "Add comment"; at the far right "Resolve thread".
  1. **Add comment** posts the text as a reply to this discussion at once. Ctrl+Enter in the field does the same
     (GitLab's key; orchestrator).
  2. **Add review** adds the text as a draft reply to this discussion in the viewer's pending review on this merge
     request: nobody else sees it until the review is submitted (C9). The viewer's pending drafts in this thread show
     at its end, marked "Pending" (as GitLab), so a second open shows them too.
  3. Both add buttons are disabled while the field is empty or a send is under way. On success the field clears and
     the new comment (or draft) shows in the thread from GitLab's answer; the box's row and turn follow it. On a
     failure the text stays and one sentence under the row says why (GitLab's own reason when it gives one).
- **C9. Submit review** (owner #2333). While the viewer has at least one pending draft on this merge request, the
  panel's header shows "Submit review" with the count ("3 pending"; tooltip "Publish your 3 pending comments on this
  merge request"). A click publishes every pending draft of the viewer on this merge request at once, as GitLab's
  own "Submit review" does — drafts in other threads and those the range window added included (orchestrator: that
  is GitLab's meaning of a review). Then the thread and the box reload (D2's way); a failure is one sentence, the
  drafts stay pending. No approval and no review state is sent with it (non-goals).
- **C10. Resolve.** "Resolve thread" resolves the discussion on GitLab at once, without sending the field's text.
  The thread and its row in the box stay, marked resolved (a check, muted, "Resolved"), and the button becomes
  "Unresolve thread", which reopens it (orchestrator). A resolved row leaves the box, and the merge request's open
  count drops by it, only when the box closes or is refreshed (D1). A discussion that is not resolvable, or that the
  viewer may not resolve or answer, shows the buttons disabled with GitLab's reason as their tooltip (orchestrator).
- **C11. Settings.** With discussion details "Off" there is no box and so no panel; "Load lazily" and "Load fully"
  both have it (plan #164's setting stands).

## Part D — reload one merge request's discussions (#2332)

- **D1. The button.** The box's header gets a refresh button at its right (Lucide `refresh-cw`, tooltip "Reload
  discussions"; a button for the keyboard). It asks GitLab again for this merge request's open discussions only; the
  rest of the list and every other row's details are untouched.
- **D2. While and after.** The rows stay as they were while it loads, the icon turning; then the box shows the new
  answer, resolved discussions gone, turns recomputed, and the row's open-discussions count set to what came back. A
  failure keeps the old rows and says why in the header, as a failed load does today.
- **D3. An open thread panel** shows its discussion again from GitLab with the reload; if that discussion is no
  longer open, the panel says "Resolved" and keeps its text field's text (orchestrator).

## To be measured by the design (unverified)

- A: whether `descriptionHtml` / a note's `bodyHtml` keep `width`/`height` on `<img>` (GitLab's `AttributesFilter`,
  `\A\d{1,4}(%|px)?\z`, facts §7), the IPC shape for a size, a fixture with both units.
- B: what the turn rule needs per discussion (the starter, every person's comment's author and mentions, not only the
  last person's note, facts §1–§2) and the extra cost in "Load fully" for up to 500 rows (`notes(last: 20)` today);
  mentions from GitLab's user references in `bodyHtml` or from `@username` in the raw text; which side computes them;
  review mode's tooltip words after B5.
- C: the thread read (GraphQL `discussion` by id with `notes` up to 200, `bodyHtml`, `lastEditedAt`, `lastEditedBy`,
  permissions), the discussion id the box needs; the writes: `createNote` with `discussionId`,
  `discussionToggleResolve`, draft notes through REST `draft_notes` with `in_reply_to_discussion_id` and
  `bulk_publish` for C9 (today only in `yamt-review`, `pub(crate)`, RK33's duplicate rule) and listing the viewer's
  drafts and their count; GitLab's Markdown preview
  (REST `POST /markdown` with the project, or another route) and its cost; reusing the description reducer for notes
  (`described`, its `Description*` names) and the renderers; the panel as the box's DOM child (one inside rule, as
  `CiStatusJobLog`); the growing field (`field-sizing: content` in WebKitGTK, or a measure); RK54 and RK60 amended or a
  new risk for note, reply and resolve writes; fake glab routes for the new reads and writes (facts §5: other routes
  answer 404).
- D: one-row reload through the existing queue (`askDiscussions`, generation counter) without a second load path;
  how the row's count is replaced without touching the list's load.

## Acceptance

Rust against the fake glab: description and note images carry their size; the turn data for a listed row (starter,
comments, mentions) arrives; one row reloads alone; a thread comes back whole with edited times and the viewer's
drafts; a reply, a draft reply, a resolve, an unresolve and a submit each send exactly one write (calls log), and a
refused one comes back with GitLab's reason. Core tests: every case of B1–B6 by name, review mode's order under B5. WebKit
fixture (`?mr=list`), dark and light: a sized image in the description (px and %, one wider than the panel); the box's
words for each case of part B; Shift over a row opens the thread left of the box, Shift over another row switches,
Shift in the field types a capital; crown, picture, "Edited … by …", formatted comment with code, table and image;
the field grows then scrolls; Preview shows rendered text and back; Add comment, Add review, Submit review (count,
then none pending), Resolve, Unresolve each change the thread as described, the resolved row stays until the box
closes, then the count drops; the refresh
button reloads only that row (fixture log). Real app on the fake glab: the same writes, the calls log names each.
`just check` passes. Owner check on the GitLab playground: a reply, a draft reply, a submitted review and a resolve
appear on GitLab as sent; a discussion started by another person and answered by its author reads "Anna's turn", not "Your turn", for a
reviewer who never wrote in it.

## Non-goals

Starting a new discussion; editing or deleting comments; reactions (emoji); a Markdown editor (toolbar, colours,
`@` completion); the diff lines a file discussion sits on; resolved discussions in the box beyond C10; approving or
the review's state on submit; live updates without a reload; the description panel's other rules; sized videos.

`@` completion was reopened by `request-mr-mentions.md` (plan #191): the reply field offers people; the rest of a
Markdown editor stays a non-goal.

## Reopens (DR4: the owner's changed requirement)

- Discussions request rule 2 (last comment only), rule 3 (turn words) and rule 5 (plain text) for the thread panel,
  and its non-goals "Replying to, resolving or reacting … showing whole threads"; plan #162 (only the last person's
  note crosses), #163 (the turn rule), #165–#166 (review order's "waiting"), RK54 (the page's only writes), RK60
  (comment text never markup), RK61.
- Plan #112 "images never loaded; links as text" for the thread panel (as #171 did for the description); #118
  (draft notes only in the range window's crate); description request's non-goal "comments and discussions in the
  panel" and rule 5's single width rule (part A); the range request's non-goal "replying to or resolving existing
  GitLab discussions in yamt".

## Owner's answers

- (#2333) "Add review" drafts are submitted from yamt: the panel shows how many are pending on this merge request
  and a "Submit review" that publishes them all (C9), chosen over submitting on GitLab's page.

## Slice graph (proposal; refined after the design)

| row | slice                                                                                                               | owner                 | needs   |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------- | ------- |
| 1   | design: turn data and cost, thread read, writes, preview route, image size, panel and field, one-row reload, briefs | designer              | —       |
| 2   | Rust reads: image size, turn data, one-row reload, thread read with drafts, fake glab                               | rust-impl             | 1       |
| 3   | Rust writes: reply, draft reply, submit review, resolve/unresolve, preview, fake glab writes; app commands          | rust-impl             | 1       |
| 4   | core: the turn rule B1–B6, review order under B5, thread words (crown, edited, pending, resolved)                   | web-impl              | 1       |
| 5   | state: ipc + fixtures, one-row reload, open thread, kept texts, writes, pending count, resolved rows until close    | web-impl              | 2, 3, 4 |
| 6   | page: sized images, refresh button, Shift panel, growing field, Write/Preview, buttons row; wires the window        | web-impl              | 5       |
| 7   | docs keeper; verify: smoke after 6, final `just check`, WebKit, real app                                            | docs-keeper, verifier | 6       |
| 8   | owner check on the GitLab playground                                                                                | human                 | 7       |
