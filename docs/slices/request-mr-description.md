# Request — a merge request's description in a floating panel

Asked by the owner on 2026-11-03 (#2252); answers #2248–#2249; details by the orchestrator as owner (OR13), marked
"(orchestrator)", the owner may veto. A design may refine a detail it names, never reopen a rule. Starts after
"People on a merge request" closes; base: main at that close (planned on `21f71b1b`). Window: the merge-request
page's row (`ui/MergeRequestRow.vue`), the page's boxes (`ui/useHoverBox.ts`, `ui/MergeRequestDueDate.vue`'s
click-opened box, `ui/CiStatusJobLog.vue`'s large box), the opener (`crates/merge-requests/src/web_page.rs`,
`open_page`), the picture route (`src-tauri/src/merge_requests/pictures.rs`, `crates/merge-requests/src/picture.rs`).
Facts with `path:line` and GitLab sources: `.omp/run/notes/PlanScoutMrDescriptionFacts.md`. The next request,
`request-mr-links.md`, reads the description through this one's path.

## Owner's words

> I want to be able to see the MR description when I click on an info icon between the approvals and the merge
> status icons... then it opens a big floating panel that shows a formatted MR description with tables/images/...

- (#2248) Links in the panel: every web link opens in the browser.
- (#2249) Images: all images load, uploaded to GitLab or linked from other sites.

## Rules

1. **Where.** Every row on every window that shows the merge-request page gets an info button (Lucide `info`,
   `size-4`, the row's icon look) in its own fixed-width column directly after the approvals and before the CI box,
   so the columns stay aligned (orchestrator: the CI box sits between approvals and merge status today; the owner may
   move it next to the merge status). Tooltip "Show description"; a button for the keyboard (Enter, Space). A click on
   it never opens the merge request's GitLab page (the row's own click, plan #137). A merge request whose description
   is empty shows no button, its column kept, when the list can know it at small cost; otherwise the button always
   shows and the panel says "No description." (orchestrator; the design measures which).
2. **The panel.** A click opens one large floating panel over the page (orchestrator: about
   `min(64rem, 100vw − 4rem)` wide, up to `85vh` high, centred in the window, its content scrolling inside), in the
   window's theme, dark and light. Its header shows `!<iid>` and the title and a close button (Lucide `x`, tooltip
   "Close"). It closes on the close button, Escape (the keyboard back on the info button), a press outside it, or a
   second click on the same info button; a scroll of the page behind it leaves it open (orchestrator). One panel per
   window: opening another row's replaces it. A list refresh leaves an open panel showing what it loaded.
3. **Formatted as GitLab shows it.** Headings, paragraphs, emphasis, strike, inline code, code blocks (coloured with
   yamt's own code colours where the language is known, plain otherwise), lists, task lists (boxes shown ticked or
   not, never clickable), tables (with their alignment), block quotes, rules, collapsible sections (`<details>`),
   images, links, and GitLab's references (`#12`, `!3`, `&4`, `@anna`, commit ids) shown as the links GitLab makes of
   them. Diagrams (Mermaid, PlantUML) and math show as their code (orchestrator). Read only: nothing in the panel
   edits GitLab.
4. **Links** (#2248). A click on any `http`/`https` link, references included, opens it in the system browser,
   through the one opener the page already uses; a link relative to the GitLab server opens on that server. The
   window itself never navigates. Any other kind of address (`mailto:`, `file:`, `javascript:` …) opens nothing and
   shows its address in its tooltip (orchestrator).
5. **Images** (#2249). Images uploaded to GitLab load with the user's GitLab login, so they show on private projects;
   images from other sites load from those sites. An image fits the panel's width at most; one that fails shows its
   caption (or its address when it has none) in its place. A click on an image does nothing (orchestrator).
6. **Nothing else runs or loads.** The description never runs code, never submits anything and never loads anything
   but its images (no frames, styles, fonts, scripts, media), whatever raw HTML it contains. The user's GitLab login is
   sent to the GitLab server only, never to another site.
7. **Fresh when opened.** The panel asks GitLab for the description each time it opens (orchestrator: one small
   request, no stale copy) and shows "Loading…" until the answer; a failure is one sentence with Retry in the panel.
8. **Cheap for the list.** The list's load stays within GitLab's query limit as today; whatever the panel needs is
   asked when it opens, except what rule 1's empty check needs, if the design keeps it.

## To be measured by the design (unverified)

- GitLab's `descriptionHtml` (GitLab's own rendering, its data attributes, relative addresses, lazy-image `data-src`,
  facts §9) against `description` with yamt's Markdown (plan #112, `editor/markdown.ts`: no task lists, references,
  `<details>`, raw HTML today); how either is shown without interpreting markup the page did not allow (RK57, RK60),
  and whether that needs a new dependency (vision 5).
- The per-open request: a details query by iid (`graphql-merge-request-<iid>` route, plan #132) or a new one; its cost.
- The empty check of rule 1: cost of `description` (or a cheaper field) in the list query (facts §2: 170 of 250).
- Uploads: GitLab's web path `/-/project/<id>/uploads/<secret>/<file>` through `glab api` against the REST route
  (GitLab 17.4+ only, floor 15.6); "Require authentication to view media files"; size and type limits (the picture
  route's 1 MiB and four types today).
- Other sites' images: the content security policy (`img-src`, `src-tauri/tauri.conf.json:14`) against fetching them
  through yamt; RK53's "token never to another host".
- The opener's allow-list (`WebPage`, `pages`, RK41): how any `http`/`https` address from a description reaches it.
- Code-block colours from the panes' palette (plan #112's one colour table); the panel's focus and Tab order.
- Fake glab: a route that does not collide with the discussions' `iids` route (facts §8); fixture descriptions with
  every element of rule 3 plus planted script, `onerror`, frame and style.

## Acceptance

Rust against the fake glab: the description and its images come back; an upload is fetched with the login, another
site's image never gets it; any `http`/`https` link from a description opens, other schemes are refused. WebKit
fixture, dark and light: every element of rule 3 shows as listed; an uploaded and an outside image show, a broken one
its caption; a link opens through the opener (fixture log); Escape, outside press, close button and a second click
close the panel; a long description scrolls inside; empty and failed descriptions show their sentence, Retry works;
the planted script, `onerror`, frame and style do nothing. Real app with the fake glab: the same. `just check` passes.
Owner check on the GitLab playground: a description with a table, a task list, an uploaded image and an outside image
looks like GitLab's.

## Non-goals

Editing the description or ticking its task boxes; comments and discussions in the panel; drawing diagrams or math;
playing videos or audio; the description in review mode's own controls beyond the shared row; caching descriptions
across opens.

## Reopens (DR4: the owner's changed requirement)

- Plan §2 #112 "images … never loaded; links shown as text … never navigable; raw HTML literal", for this panel.
- Plan §2 #133 and #137 "Links in threads, AI answers and Markdown stay text" and the opener's "one page GitLab
  listed" rule (RK41), for links in a description.
- RK53's picture route "avatars only" and the content security policy's image hosts.

## Slice graph (proposal; refined after the design)

| row | slice                                                                                             | owner                 | needs |
| --- | ------------------------------------------------------------------------------------------------- | --------------------- | ----- |
| 1   | design: rendering path, per-open request, uploads and outside images, link opening, panel, briefs | designer              | —     |
| 2   | Rust: description command, upload route, any-link opener, policy, fake glab route and scenario    | rust-impl             | 1     |
| 3   | core: the description's safe shape (or Markdown additions), links and images found in it          | web-impl              | 1     |
| 4   | state: ipc source + fixtures, the window's open panel, loading and failure                        | web-impl              | 2, 3  |
| 5   | page: info button, panel, close rules, links and images; wires the window                         | web-impl              | 4     |
| 6   | docs keeper; verify: smoke after 5, final `just check`, WebKit, real app                          | docs-keeper, verifier | 5     |
| 7   | owner check on the GitLab playground                                                              | human                 | 6     |
