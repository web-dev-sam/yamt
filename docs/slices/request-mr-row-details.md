# Request — merge-request rows for reviewing: people, labels, due dates, exclude filters, hover tooltips

Asked by the owner on 2026-11-02 (planning conversation, #2095); details by the orchestrator as owner (OR13), marked
"(orchestrator)", the owner may veto. A design may refine a detail it names, never reopen a rule. Base: main
`1f7e73e8`. Window: the merge-request page (`ui/MergeRequestsView.vue`, one row `ui/MergeRequestRow.vue`, one filter
`ui/MergeRequestFilter.vue`, framework-free core `frontend/src/mergeRequests/`, Rust `crates/merge-requests/`). Facts
with `path:line`: `.omp/run/notes/PlanScoutMrRowFacts.md`. Implementation starts after the local conflict check
(board section of that name) has closed: both edit the same files.

## Owner's words

> - Local priority in MRs: Allow user to save a due date to each MR locally and below the date show the time left like
>   "7 days left"
> - Assignee/Reviwer pfp: A list of assignees (pfps that show the names in a list on hover), this list also shows the
>   "request review" status and has a button to request a review from a person.
> - shift = not filters: while holding shift a click in a filter, filters OUT that option. While holding an icon to the
>   left of the option indicates that it filters OUT instead. With this a possibility is for example showing all MRs
>   that are NOT assigned to oneself but have label X
> - filters open on hover, and sorted by count: Quality of life, reduces amount of clicks to set a filter
> - show labels: for each row the labels should be visible. Since this can get a lot, show only one and "+X" that
>   shows the rest on hover
> - +0 -0: Currently it doesnt show and the status icon on the right disappears too. Fix that.
> - Names of approvers on hover: Currently I only see the amount of approves, on hover it should show who approved
> - tooltips on hover should always be the custom tooltip and not just title="..."
> - The author of an MR should show to the very left of a row as pfp (name on hover: "Author: X Y")

## Rules

1. **Author.** The row's first element, left of the title, is the author's profile picture; its tooltip reads
   "Author: <full name>" (GitLab's `name`; the username when the name is empty, orchestrator).
2. **Profile pictures.** A person is a round picture from GitLab (`avatarUrl`). A picture that cannot be loaded shows
   the person's initials on a colour derived from the username (orchestrator), never a broken image. Pictures never
   block the list: the row shows at once, pictures fill in. How pictures reach the window (the window today loads no
   remote image: `tauri.conf.json:14` `img-src 'self' data:`) is the design's. Hosts: the project's GitLab, and
   Gravatar for people with no uploaded picture (owner #2105: "Also load Gravatar"; gravatar.com sees each request);
   no other host, and GitLab's login never goes to Gravatar.
3. **Assignees and reviewers.** One overlapping stack of pictures per row: assignees, then reviewers not already
   assigned (orchestrator), at most 3 shown then "+N". Hovering the stack opens a box the pointer can move into (as
   the CI box): two groups "Assignees" and "Reviewers", each person with picture and full name; each reviewer with
   GitLab's review state as GitLab shows it (its icon, and the words on hover: "Review requested", "Reviewed",
   "Approved", "Changes requested"). Beside each reviewer whose review is done (reviewed, approved, changes
   requested) a "Re-request review" button, GitLab's own control (owner #2104: Lucide `rotate-ccw`, left of the state
   icon, as on GitLab's merge-request page; pressed once the assignee answered that reviewer's discussions). Only
   reviewers already on the merge request; no button for assignees, no adding anyone (owner #2100, #2104). A click
   asks GitLab to re-request that review, the button shows that it works, then the state reads "Review requested"; a
   refusal is one sentence in the box. Nobody assigned and no reviewer: an empty, dimmed person icon whose tooltip
   says "No assignee or reviewer".
4. **Approvers.** The approvals count's tooltip lists who approved, one full name per line; no approval: "No
   approvals".
5. **Labels.** The row shows its first label (GitLab's order) as a chip in GitLab's label colour, then "+N" for the
   rest; hovering "+N" lists every other label as chips. No label: nothing. Placement on the row is the design's;
   the title keeps the room it needs to stay readable (orchestrator).
6. **Due date (local priority).** A row can carry a due date set by the user: a calendar button on the row opens a
   date picker (set, change, clear). Shown on the row: the date, and below it the time left in whole days — "Due
   today", "1 day left", "7 days left", "1 day overdue", "3 days overdue" (overdue in the error colour; the boundary is
   the user's local midnight, orchestrator). Stored only on this computer, per repository and merge request, across
   restarts, never sent to GitLab. A due date of a merge request that left a complete (not cut) list is dropped
   (orchestrator). Order (owner #2102): merge requests with a due date come first, the soonest (overdue first) on top,
   equal dates newest first; the rest follow newest first, as today. No sort choice.
7. **Exclude filters (Shift).** In the Assignee, Reviewer and Label checklists, a value has three states: off,
   included, excluded. A click toggles "included"; a Shift+click toggles "excluded"; a click on an excluded value
   (with or without Shift) turns it off (orchestrator). While Shift is held, every value of an open checklist shows a
   "not" icon left of it (Lucide `circle-minus`, orchestrator); an excluded value always shows it, struck in the error
   colour. Inside one filter a row passes when it matches any included value (or none is included) and no excluded
   value; across filters every filter must pass (the owner's example: Assignee not Me + Label X). "None" excluded means
   "has at least one". The filter's button reads "Assignee: not Me, anna". Draft keeps its three buttons. Remembered
   per repository like today (plan §2 #134): the stored words gain an excluded form; filters stored by an older yamt
   still read (orchestrator).
8. **Filters open on hover.** Hovering a filter's button opens its checklist; it stays open while the pointer is over
   the button or the checklist and closes a short moment after the pointer leaves both (orchestrator: 300 ms) or on
   Escape / a click outside; one checklist open at a time. Click and keyboard keep working as today.
9. **Filters sorted by count.** Inside a checklist "Me" and "None" stay first (orchestrator); the other values
   follow by their count, highest first, equal counts by name; a checked value no longer in the list (count 0) last.
10. **Empty size.** A merge request whose diff is known and empty shows "+0 −0 · 0 files" (GitLab still computing the
    diff shows no size, as today, if the design can tell the two apart). The status icons on the right never
    disappear because of the size: reproduce the owner's case first (scout: no condition in `MergeRequestRow.vue`
    ties the readiness icon to the size; the CI icon goes when the merge request has no pipeline, request rule 4 of
    `request-merge-requests.md`; the readiness lookup has no look for `mergesCleanly`, `MergeRequestReadiness.vue:17-26`).
11. **One tooltip on the merge-request page** (owner #2101: this page only; the merge, compare and range windows keep
    the browser's hover text). Every hover text the page shows (`ui/MergeRequest*`, `ui/mergeRequest*`,
    `ui/CiStatus*` and what they render) is the custom tooltip (today only `OperationLabel.vue`'s), never the
    browser's `title`: shown after a short delay (orchestrator: 400 ms; at once when moving from one tooltip to the
    next), placed like `operationTooltip.ts`, gone on leave, scroll or Escape, multi-line text allowed. Accessible
    names stay (`aria-label`).

## To be measured by the design (unverified)

- GraphQL fields: `author { username name avatarUrl }`, `avatarUrl` on assignees/reviewers/approvers, `approvedBy`
  names, `reviewers { nodes { mergeRequestInteraction { reviewState } } }`, `labels { nodes { title color textColor } }`;
  each field's first GitLab version; the list query's complexity with them (limit 250 logged in, today's cost).
- The write that requests a review: GraphQL `mergeRequestSetReviewers` (append) / `mergeRequestReviewerRereview`, or
  REST; what an assignee who is not a reviewer becomes; the fake glab route; how it reports refusals (`glab_answer.rs`).
- Avatars: public on gitlab.com? Behind login on a private GitLab? Through Rust (`glab api` or the image URL) as
  `data:` URLs, cached per run, or a CSP host entry; the cost for 500 rows (distinct people, not rows).
- Whether GitLab's `diffStats: []` means "empty diff" or "not computed yet", and how to tell (no `diffStatsSummary`
  in the list: `query.rs:104-110`).
- Hover open/close and the pointer moving from button to checklist without gaps (`useDropdownMenu.ts`).

## Acceptance

Rust: against the fake glab with a new list case: author, pictures' addresses, approvers' names, reviewers' states and
label colours reach the page; an empty diff gives a zero size; a review request reaches the fake glab with the right
body and a refusal comes back as one sentence. WebKit fixture: author picture leftmost with its tooltip; the people
stack, its box, a review request changing a state; approvers' names on hover; one label and "+N" with the rest on
hover; set, change and clear a due date, the days-left words, kept after a reload; Shift+click excludes, the "not"
icons while Shift is held, the owner's example (not Me + label X) shows the right rows, kept after a reload; a
checklist opens on hover and closes after leaving; values by count; "+0 −0" with both icons; no `title` attribute
left in scope. Pure code: filter passes with excluded values, stored words old and new, count order, days-left words
around midnight and month ends, labels "+N". Real app with the fake glab: the same rows. `just check` passes; dark and
light. Owner check on his GitLab playground: pictures load, a review request shows in GitLab.

## Non-goals

Assigning or removing people; requesting a review from someone not yet on the merge request; approving; setting
GitLab's own due date or milestone; sharing due dates; editing labels; exclude filters for Draft; sort choices; the
custom tooltip outside the merge-request page; notifications for due dates.

Reopened by `request-mr-people.md` (owner #2243): assigning and removing people, and adding a reviewer, are now
allowed (rule 3's "no adding anyone" included).

## Reopens (DR4: the owner's changed requirement)

- `request-merge-requests.md` non-goals "avatars; labels, assignees, reviewers … on a row (filters only)" and
  "acting on an MR": rules 1–5 put people and labels on the row and request reviews on GitLab.
- Plan §2 #134's stored filter words: gain an excluded form (rule 7). #135's "filter buttons name usernames" stays.
- Request rule 6 of `request-merge-requests.md` ("Me first, then None, then the others by name"; checklists open on
  click): rules 8–9.
- Request rule 3 of `request-merge-requests.md` ("newest created first; no sort choice"): due ones first (rule 6,
  owner #2102); still no sort choice.

## Owner's answers

- (#2095, 2026-11-02) the nine additions above.
- (#2100) Request review: **people already on the merge request** (rule 3).
- (#2101) Custom tooltip: **merge-request page only** (rule 11).
- (#2102) Due dates: **due ones first**, soonest on top, then the rest newest first (rule 6).
- (#2104) Correction to #2100: the button is GitLab's **re-request review** beside a reviewer who already reviewed
  (owner's screenshot: `rotate-ccw` beside the state icon); assignees get no button (rule 3).
- (#2105) Pictures: **also load Gravatar** for people with no uploaded picture (rule 2).

## Slice graph (proposal; refined after the design)

| row | slice                                                                                                             | owner                 | owns (coarse)                                                                                         | needs   |
| --- | ----------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| 1   | design: measured facts above, pictures' route, review write, tooltip shape, stored filter words, due-date storage | designer              | `docs/slices/briefs/mr-row-details-*.md`                                                              | —       |
| 2   | Rust: query fields, empty size, pictures, request-review command, fake glab case and route, bindings              | rust-impl             | `crates/merge-requests/**`, `src-tauri/src/merge_requests*`, `scripts/fake-glab`, `tests/glab/<case>` | 1       |
| 3   | one tooltip component for the merge-request page (shared code, no other window migrated); may fold into row 5     | web-impl              | the new tooltip file(s)                                                                               | 1       |
| 4   | page core, framework-free: three-state filters, stored words, count order, days left, labels "+N", people text    | web-impl              | `frontend/src/mergeRequests/**`                                                                       | 1       |
| 5   | page: author, people stack and box, approvers, labels, due date, hover filters, Shift, fixtures; wires the window | web-impl              | merge-request `ui/` files, `ipc/` merge-request files, fixtures                                       | 2, 3, 4 |
| 6   | docs keeper; final run: `just check`, WebKit, real app                                                            | docs-keeper, verifier | —                                                                                                     | 5       |

At most two implementers live (OR10): 2 ∥ 4 (3 too when it is small), then 5.
