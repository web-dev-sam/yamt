# Request — add and remove assignees and reviewers from the merge-request page

Asked by the owner on 2026-11-03 (#2243); answers #2244–#2245; details by the orchestrator as owner (OR13), marked
"(orchestrator)", the owner may veto. A design may refine a detail it names, never reopen a rule. Base: main
`2cb5b1b3`. Window: the merge-request page's people box (`ui/MergeRequestPeople.vue`, 208 lines), its re-request
path end to end (`crates/merge-requests/src/rerequest.rs`, `src-tauri/src/merge_requests.rs`,
`ui/mergeRequestRerequests.ts`, `ipc/fixtureMergeRequests.ts`). Facts with `path:line` and GitLab sources:
`.omp/run/notes/PlanScoutMrPeopleFacts.md`.

## Owner's words

> Implement a way in the mr list to add or remove a reviewer/assignee to/from an MR

- (#2244) Who can be added: anyone in the project, found by typing.
- (#2245) Removing: "removed at once, however should be behind a dropdown click so it can['t] be done accidentally".

## Rules

1. **Where.** In the people box (the hover box of a row's picture stack, request `request-mr-row-details.md` rule 3),
   on every window that shows the merge-request page. Only on a merge request the user may edit (GitLab's
   `userPermissions.updateMergeRequest`, today's `mayRerequest`); otherwise the box stays as today, read only.
2. **Add.** Each group, "Assignees" and "Reviewers", has an add button in its header (Lucide `user-plus`,
   orchestrator; tooltip "Add assignee" / "Add reviewer"). It opens a search field in the box, focused. Typing
   searches the GitLab project's people (#2244); each result shows picture, full name and `@username`. A person
   already in that group shows as already there and cannot be added twice (orchestrator). Clicking a result, or
   Enter on the highlighted one (arrow keys move it), adds that person at once; the field stays open for the next one
   and Escape closes it (orchestrator). With an empty field the list offers the viewer ("Me") first, then the people
   the page already knows (orchestrator: GitLab's own dropdown suggests too). Searching waits a short pause after
   the last key (orchestrator: 250 ms); a slower answer than a newer search is dropped.
3. **Remove** (#2245). Each assignee and each reviewer has a menu button at the end of its line (Lucide
   `ellipsis-vertical`, orchestrator; tooltip "More"); its menu holds "Remove assignee" / "Remove reviewer". Choosing
   it removes the person at once, no confirmation. Nothing removes a person on a single click. The reviewer's
   re-request button and state icon stay as today.
4. **While it works.** The person's line (or the result) shows that it works; the box stays open while the pointer
   is in it, the search field has focus or a menu is open (the box must not close under the user's typing). A
   second add or remove on the same merge request waits for the first (orchestrator).
5. **The row follows GitLab's answer.** After a change the row's stack and the box show the assignees and reviewers
   GitLab answered, as the re-request does today (no list reload); an added person's picture shows like any other
   (pictures only through the route that already serves them). Filters count the new people.
6. **Never claim what GitLab did not do.** When GitLab's answer does not contain an added person, or still contains a
   removed one, the box says so in one sentence instead of showing success (GitLab Free keeps one assignee and one
   reviewer and drops the rest without an error: scout §6). A refusal or failure is one sentence in the box, as the
   re-request's; it stays until the box closes.
7. **Assignee and reviewer are independent.** Adding someone as reviewer does not touch the assignees, and the
   other way round; removing a reviewer who approved leaves the approval to GitLab (it stays: scout §6).
8. **Only these writes.** Adding and removing change exactly the one person in the one list, against GitLab's
   current list at that moment (never a whole-list write from the page's possibly old copy), so a change made
   meanwhile on GitLab by someone else is kept.
9. **The open row stays** (owner #2246). A row whose people box is open stays on the list while the box is open,
   even when a change takes it out of the active filters or the search (e.g. "Reviewer: None", then adding a
   reviewer); it leaves when the box closes.

## To be measured by the design (unverified)

- Search: `Project.autocompleteUsers(search:)` (GitLab 16.3+) against `Project.projectMembers(search:)` (15.6+,
  yamt's floor); what GitLab's own assignee dropdown asks; cost and time of one search on gitlab.com; what an empty
  search returns.
- Writes: `mergeRequestSetAssignees` / `mergeRequestSetReviewers` with `operationMode: APPEND | REMOVE`, their answer
  on Free with a second person, their `errors` for an unknown or forbidden user; whether the answered `mergeRequest`
  is enough to patch the row (assignees, reviewers with states).
- Pictures of people found by a search or answered by a write: how they are offered to the picture route (RK53;
  the re-request path offers none today, `rerequest.rs:183-188`).
- The box's hover rules with a focused field and an open menu (`ui/useHoverBox.ts`); menu reuse (`useHoverMenu.ts`,
  the filter bar's).
- The fake glab: posts are counted by order, not by mutation (`scripts/fake-glab/glab`); a search route.

## Acceptance

Rust against the fake glab: a search answers people with pictures offered; add and remove each send the one
mutation with the right body; the Free case (answer without the added person) and a refusal come back as one
sentence; RK54's test changes from "nothing adds a reviewer" to "only these writes". WebKit fixture, dark and light:
add an assignee and a reviewer by typing, by the empty-field suggestions, with the keyboard; remove one through its
menu; the stack and filters follow; a refusal and the Free case show their sentence; the box stays open while typing
and while a menu is open; no add or remove control on a merge request the user may not edit. Real app with the fake
glab: the same writes reach it. `just check` passes. Owner check on his GitLab playground: an added and a removed
reviewer and assignee show on GitLab.

## Non-goals

Changing several merge requests at once; the author; approving or revoking an approval; labels, milestone, due date
on GitLab; an undo button; editing from the filter bar or review mode's own controls beyond the shared people box.

## Reopens (DR4: the owner's changed requirement)

- `request-mr-row-details.md` rule 3 ("no adding anyone") and its non-goal "Assigning or removing people;
  requesting a review from someone not yet on the merge request".
- Plan §2 #153 "nothing adds a reviewer" and its rejected `mergeRequestSetReviewers`; risk RK54's "nothing may add a
  reviewer" and its test `the_only_write_is_the_rereview_mutation` (`crates/merge-requests/tests/rerequest.rs:113-142`).

## Slice graph (proposal; refined after the design)

| row | slice                                                                                                 | owner                 | needs |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------- | ----- |
| 1   | design: search field, writes and their answers, Free case, pictures, box hover rules, briefs          | designer              | —     |
| 2   | Rust: search and add/remove commands, pictures offered, fake glab routes and case, RK54 test, binding | rust-impl             | 1     |
| 3   | state: ipc source + fixtures, the window's add/remove asks, texts                                     | web-impl              | 1, 2  |
| 4   | page: add button, search list, per-person menu, hover rules; wires the window                         | web-impl              | 1, 3  |
| 5   | docs keeper; verify: smoke after 4, final `just check`, WebKit, real app                              | docs-keeper, verifier | 4     |
