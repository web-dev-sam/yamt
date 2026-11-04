# Request — open discussions on a merge-request row: whose turn it is, on hover

Asked by the owner on 2026-11-03 (#2193, first in importance; answers #2198); details by the orchestrator as owner
(OR13, the owner may veto). A design may refine a detail it names, never reopen a rule. Base: main `399f0eb0`.
Window: the merge-request page (`frontend/src/ui/MergeRequestRow.vue:164-170`, the count from
`resolvableDiscussionsCount − resolvedDiscussionsCount`, `crates/merge-requests/src/query.rs:56,133,155`;
`discussionsText`, `ui/mergeRequestsText.ts:87`; the tooltip `ui/tooltip.ts`, the hover box `ui/useHoverBox.ts`).
Next in line: `request-mr-review-mode.md` sorts by this feature's data, so the data must exist for every listed row.

## Owner's words

- "More details about open discussions: The number can be confusing, to a reviewer there is a difference between
  technically open discussions and who belongs the latest comment within an open discussion and what it says. So on
  hover I need more info so that it becomes obvious if the reviewer needs to react to a comment or not."

## Rules

1. **The count stays.** The row still shows the number of open discussions (resolvable, not resolved), as today.
2. **Hover shows each open discussion.** Pointer over the count (or keyboard focus on it) opens a box, like the
   people box, listing every open discussion of that merge request. Per discussion: the author of its **last**
   comment (picture and name, as the people box shows people), how long ago it was written, the first lines of its
   text (about three lines, cut with "…"), and where it is (`file:line` for a discussion on the diff, "Overview" for
   one on the merge request itself).
3. **Whose turn.** The viewer is the user glab is logged in as; while review mode is on
   (`request-mr-review-mode.md`), the reviewer chosen there. A discussion whose last comment is **not** the viewer's is
   marked as the viewer's turn ("Your turn" / "<name>'s turn" in review mode); one whose last comment is the
   viewer's reads that the viewer is waiting for an answer. The box's header sums it up ("2 of 5 wait for you").
   Discussions that are the viewer's turn come first, then the rest; within each, the newest last comment first.
4. **Only people's comments.** GitLab's system notes ("added 2 commits", "changed the description") are neither a
   last comment nor counted as one; a discussion's last comment is its last note written by a person.
5. **Plain text.** Comment text is shown as text, never as markup (risk register, the log-text rule of RK57).
6. **To GitLab.** A click on a discussion opens that comment on GitLab in the browser, as a row click opens the merge
   request (plan §2 #137), only for a link GitLab's own answer gave for that comment.
7. **Freshness and failure.** Loaded details are as fresh as the list (`request-mr-starts.md` rule A shows its age);
   a refresh drops them and loads them again as rule 8's mode says. While they load the box says so; if they cannot
   be read, the count still shows and the box says why — never a problem box.
8. **A setting decides how much is loaded** (owner #2199–#2200). In Settings, "Discussion details", three choices:
   - **Load fully** (the default, #2200): with the list or right after it, for every listed row. Everything is
     shown: the hover box, and review mode with its order by waiting discussions (`request-mr-review-mode.md`).
   - **Load lazily**: only a row's own details, on the first hover of its count, kept until the next refresh. The
     hover box is shown; review mode is hidden (its order needs every row's details).
   - **Off**: nothing is loaded. The count shows with today's plain tooltip; the hover box and review mode are
     hidden.

   A change applies to the open list at once (switching to "Load fully" loads what is missing; switching away
   turns an active review order off, its filters stay). Kept in the settings file like the other settings.

## To be measured by the design (unverified)

- The GraphQL shape: `discussions { nodes { resolvable resolved notes(last: …) { author … body createdAt position
  url system } } }` per merge request, inside the list query or as a second query after it; its complexity against
  GitLab's limit (the list query's cost today, `query.rs`), at 100 rows per page and up to 500 rows
  (`MAX_MERGE_REQUESTS`).
- Whether `notes(last: 1)` can skip system notes, or how many notes must be read to find the last person's note.
- Which `glab` user is "the viewer" (the list already knows "Me": the filters' "Me" value).
- Where the turn rule lives (Rust or the framework-free `mergeRequests/` core) and the shape crossing the IPC.
- The box: the people box's component reused or shared, without a second hover rule (`useHoverBox`, one tooltip).
- The setting (rule 8): its key and three values in the settings file (`crates/settings`, the Settings window
  `ui/SettingsView.vue`), and one load path that serves both "fully" (all rows) and "lazily" (one row on hover)
  without two query shapes.

## Acceptance

Rust: against the fake glab (`tests/glab/<case>/`), a listed row's open discussions arrive with each one's last
person's note, its place and link; one row's details alone (lazy); system notes are skipped; a failure keeps the
list; the setting's three values read and written. WebKit fixture (`?mr=list`), per setting: **fully** — hover a
row's count → the box lists its open discussions, turn first, words as rule 3, no wait; **lazily** — the first hover
shows loading then the box, a second hover asks nothing, review mode hidden; **off** — plain tooltip, no box, no
review mode, nothing asked; switching the setting applies at once. Capitals and markup in a comment show as text;
dark and light. Real app on the fake glab: the same three, and the calls log shows no discussion query with "off"
and one per hovered row with "lazily". `just check` passes. Owner check on the GitLab playground: a discussion
answered by the author shows "Your turn" to the reviewer.

## Non-goals

Replying to, resolving or reacting to a discussion from yamt; resolved discussions; changing what the count counts;
showing whole threads; notifications.

Reopened by `request-mr-threads.md` (plan §2 #179, #180): rule 3's turn is decided over every person comment and
GitLab's mentions, no longer by the last comment alone; rules 2 and 5 hold for the box, while the thread panel shows
every comment as GitLab renders it; the non-goals' replying, resolving and whole threads are now allowed.

## Owner's answers

- (#2198) Review mode's perspective and order are in `request-mr-review-mode.md`.
- (#2199) A setting chooses: load fully, load lazily (on hover per row), or off (related features hidden); "fully"
  is what makes review mode's order by waiting discussions available.
- (#2200) Default: load fully.

## When done (owner #2201)

The session's last reply to the owner ends with the command that starts the next part, verbatim:

`/new`, then `Implement docs/slices/request-mr-review-mode.md`

## Slice graph (proposal; the session's orchestrator refines it)

| row | slice                                                                                                                        | owner       | needs |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ----------- | ----- |
| 1   | design: query shape and cost, one load path for both modes, system notes, viewer, turn rule's home, box reuse, setting shape | designer    | —     |
| 2   | rust: discussion details for listed rows or one row, the setting, fake glab scenario                                         | rust-impl   | 1     |
| 3   | core: the turn rule and the box's order and words                                                                            | web-impl    | 1     |
| 4   | page: hover box on the count per setting, Settings choice, ipc + fixtures; wires the window                                  | web-impl    | 2, 3  |
| 5   | docs keeper                                                                                                                  | docs-keeper | 4     |
| 6   | verify: smoke after 4; final `just check`, WebKit, real app                                                                  | verifier    | 4     |
