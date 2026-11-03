# Request — a merge request's epics, issues and commits, one hover away

Asked by the owner on 2026-11-03 (#2247); answer #2250; details by the orchestrator as owner (OR13), marked
"(orchestrator)", the owner may veto. A design may refine a detail it names, never reopen a rule. Starts after
`request-mr-description.md` closes and builds on it: the description's request, the opener for any `http`/`https`
link, the info button's column. Window: the merge-request page's row (`ui/MergeRequestRow.vue`), its hover boxes
(`ui/useHoverBox.ts`, `ui/MergeRequestDiscussions.vue`), the discussions' lazy queue (`ui/mergeRequestDiscussions.ts`,
`crates/merge-requests/src/discussions.rs`). Facts: `.omp/run/notes/PlanScoutMrDescriptionFacts.md` §9–§11.

## Owner's words

> Another icon in a MR row that show all links in a MR description to epics/issues/commits in that order. Every
> linked issue also has a parent button next to it if it has a parent/epic so that the user can easily reach the
> epic of a MR with one click (hover it opens the list of links -> button to parent). They just open the browser.

- (#2250) Titles and parents are asked from GitLab the first time the icon is hovered, not with the list.

## Rules

1. **Where.** Every row on every window that shows the merge-request page gets a links button (Lucide `link`,
   `size-4`) in its own fixed-width column directly after the description's info button (orchestrator). Hovering it,
   or the keyboard on it, opens its box at once, as the CI box and the discussions box do; the pointer may enter the
   box and it stays open while the pointer or the keyboard is inside. A click on it never opens the merge request's
   page. A merge request whose description links nothing of rule 2 shows no button, its column kept, when the list
   can know it (the description request's empty check); otherwise the box says "No linked epics, issues or commits."
2. **What is listed.** Every epic, issue and commit the description links to, by a GitLab reference (`#12`,
   `group/project#12`, `&3`, `group&3`, `[epic:…]`, `[issue:…]`, `[work_item:…]`, a commit id, `project@<id>`, a
   commit range) or by a full address of one on the same GitLab server. Three groups in this order: Epics, Issues,
   Commits (#2247); a group with nothing is not shown; inside a group, in the order of first mention; each thing once,
   however often and however written it is mentioned. Work items go to Epics when they are epics, to Issues otherwise
   (tasks, incidents, …) (orchestrator). Text inside code is not a link (as on GitLab). Merge requests, labels,
   milestones, people, snippets and other websites are not listed.
3. **Each line.** A kind icon, the reference as GitLab writes it from this project (`#12`, `other/project#12`, `&3`,
   the short commit id; a range as `a1b2c3d…e4f5a6b`), the title (a commit: its first message line), and "Closed" for a
   closed epic or issue (orchestrator). A click on the line opens its GitLab page in the system browser; the box stays
   open (orchestrator).
4. **Parent button** (#2247). An issue that has a parent (an epic, or the issue above a task) gets a button at the end
   of its line (orchestrator: Lucide `arrow-up-to-line`; tooltip "Open parent: <reference> <title>"); a click opens the
   parent's GitLab page in the system browser, so the MR's epic is one hover and one click away. Only the direct
   parent; an issue without one shows no button. Epics and commits get none.
5. **When it is asked** (#2250). The first hover (or keyboard focus) on a row's links button asks GitLab for that
   description's links with their titles, states and parents; the box shows "Loading…" until the answer, about a
   second. The answer stays until the next list refresh (orchestrator); a row never hovered is never asked. A failure
   is one sentence with Retry in the box; a later hover after a failure asks again.
6. **What GitLab will not show.** A linked thing the user may not see, or that no longer exists, keeps its line with
   the reference only and "Not found or no access"; its click still opens the address (the browser asks for a login
   if needed) (orchestrator). On GitLab Free or a server without epics there are simply no epics and no parents:
   never an error, never a refused query.

## To be measured by the design (unverified)

- Where the links come from: the data attributes in GitLab's rendered description (`data-reference-type`,
  `data-project-path`, `data-iid`, `data-commit`, facts §9), parsing the Markdown, or
  `MergeRequest.workItemRelations` (no commits, no group epics; version unknown, facts §10).
- Titles, states, parents in few requests: `workItemsByReference` (16.7+, floor 15.6), `Project.issues(iids:)` /
  `workItems(iids:)` per project, `WorkItemWidgetHierarchy.parent` against `Issue.epic` (EE only, deprecated in
  17.5, removed in 19.0: a CE server refuses a query naming it, facts §11); commits' titles per project; cost against
  the 250 limit and glab's 20 s deadline (the discussions' batch of 20, plan #162).
- The window queue: one per page slice, as `discussionQueue`, or a smaller per-row ask; an answer after a refresh.
- Addresses each line opens (references resolve to web pages; a commit of this MR links to its diff, facts §9),
  through the description request's any-link opener.
- Fake glab: a route for the link lookup that does not collide with the discussions' `iids` route; scenarios with an
  epic parent, a task's parent issue, a cross-project issue, an inaccessible issue, a Free server.

## Acceptance

Rust against the fake glab: one hover's lookup returns the three groups in order with titles, states and parents; a
cross-project reference, an inaccessible one and a Free server answer without error. WebKit fixture, dark and light:
the box lists epics, issues, commits in order, each once; a parent button opens the parent and a line opens its own
page (fixture log); "Loading…", failure with Retry and the empty sentence show; a row never hovered is never asked
(fixture log); a refresh drops the answers. Real app with the fake glab: the same. `just check` passes. Owner check on
the GitLab playground: an MR naming an issue in an epic reaches the epic in one hover and one click.

## Non-goals

Links to merge requests, labels, milestones, people or other websites; parents of epics; the whole chain of
ancestors; editing links or parents; showing linked issues GitLab relates to the MR outside its description (closing
issues set elsewhere, related items).

## Slice graph (proposal; refined after the design)

| row | slice                                                                                | owner                 | needs |
| --- | ------------------------------------------------------------------------------------ | --------------------- | ----- |
| 1   | design: where links come from, lookup query and cost, queue, addresses, briefs       | designer              | —     |
| 2   | Rust: link lookup command, parents, pages offered, fake glab route and scenarios     | rust-impl             | 1     |
| 3   | core: links found in a description, grouping, order, one entry per thing, line words | web-impl              | 1     |
| 4   | state: ipc source + fixtures, the window's hover-first lookup, refresh rule          | web-impl              | 2, 3  |
| 5   | page: links button, box, lines, parent button; wires the window                      | web-impl              | 4     |
| 6   | docs keeper; verify: smoke after 5, final `just check`, WebKit, real app             | docs-keeper, verifier | 5     |
| 7   | owner check on the GitLab playground                                                 | human                 | 6     |
