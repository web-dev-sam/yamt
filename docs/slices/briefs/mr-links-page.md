# Slice mr-links-page — the links button, its box, the lines and the parent button (wires the window)

Feature: a merge request's epics, issues and commits, one hover away. Sources:

- Request `docs/slices/request-mr-links.md`: rules 1, 3, 4 (the window side), 5–6 (the box's words), the WebKit and
  real-app acceptance.
- Design `docs/slices/briefs/mr-links-design.md` option A, §1.5–§1.6, §4.
- Proposed plan §2 #176, #177; RK41 (amended), RK70.

Runs in wave 4, after `mr-links-state` **and** after `mr-description-page` is committed (that slice owns
`MergeRequestRow.vue` and adds the info column this one follows). **This slice wires the window**: its real-app run is
the feature's first end-to-end proof.

## Target

**Owned:**

- `frontend/src/ui/MergeRequestRow.vue`
- `frontend/src/ui/MergeRequestLinks.vue` (new)
- `frontend/src/ui/mergeRequestLinkLines.ts` (new), `frontend/src/ui/mergeRequestLinkLines.test.ts` (new)
- `frontend/src/ui/AGENTS.md`

**Read-only:** everything else.

- `ui/mergeRequestLinks.ts`, `ui/mergeRequests.ts`, `ui/problem*.ts`, `ipc/**`: the state slice's. Use them as
  contracted.
- `ui/useHoverBox.ts`, `ui/tooltip.ts`, `ui/mergeRequestsStore.ts`, `ui/glab.ts`, `ui/aiText.ts` (`RETRY`),
  `ui/MergeRequestDiscussions.vue` (the model): use them as they are.
- `style.css`: no new token; the box takes the discussions box's look.
- `docs/**`: lines in `deviations_from_brief`.

`MergeRequestLinks.vue` needs its one-line reason in `deviations_from_brief` (VU15): the box has its own hover rules
and its own lazy load, as `MergeRequestDiscussions.vue`.

**Non-goals:**

- Editing links or parents; parents of epics; the whole ancestor chain; merge requests, labels, milestones, people or
  other websites in the box (request non-goals).
- Any `href`, `v-html` or `title` attribute (`mergeRequestTitles.test.ts` bans `title` in `MergeRequest*.vue`).

## Contract

Given (fixed):

- State, through `useMergeRequests()` (PM10): `links`, `askLinks`, `useRowLinks` (import from
  `./mergeRequestLinks`), `openPage(clicked: PageKind, page)` with `PageKind` `"link"`; the types `LinksLoad`,
  `DescriptionLinks`, `LinkedEpic`, `LinkedIssue`, `LinkedParent`, `LinkedCommit`; `MergeRequestRow.hasDescription`.
- Problem: the step `"links"` (`problemText`).

Fixed here (add-only beyond this):

```ts
// ui/mergeRequestLinkLines.ts — the box's words and lines (mergeRequestPeopleLines.ts is the precedent)
export const SHOW_LINKS = "Linked epics, issues and commits";
export const LINKS_LOADING = "Loading…";
export const NO_LINKS = "No linked epics, issues or commits.";
export const NOT_SHOWN = "Not found or no access";
export const CLOSED = "Closed";
export type LinkGroupKind = "epics" | "issues" | "commits";
export const GROUP_HEADINGS: Readonly<Record<LinkGroupKind, string>>; // "Epics", "Issues", "Commits"
export type LinkDetail =
  | { readonly kind: "shown"; readonly title: string; readonly closed: boolean }
  | { readonly kind: "notShown" };
export type LinkLine = {
  readonly reference: string;
  readonly detail: LinkDetail;
  readonly page: WebPage;
  /** Only on an issue GitLab shows with a parent. */
  readonly parent: { readonly page: WebPage; readonly tooltip: string } | null;
};
export type LinkGroup = { readonly kind: LinkGroupKind; readonly heading: string; readonly lines: readonly LinkLine[] };
export type LinkBox =
  | { readonly kind: "status"; readonly text: string; readonly failed: boolean }   // failed: Retry shown
  | { readonly kind: "groups"; readonly groups: readonly LinkGroup[] };           // non-empty groups, in this order
/** undefined or loading → LINKS_LOADING; read with no line → NO_LINKS; read → the groups Epics, Issues, Commits that
 *  hold a line; refused or failed → its sentence, failed. */
export function linkBox(load: LinksLoad | undefined, platform: string): LinkBox;
/** `Open parent: ${reference} ${title}` (rule 4). */
export function parentTooltip(parent: LinkedParent): string;
/** glabMissing → `${GLAB_MISSING_TEXT} — install glab, then Retry.`; notLoggedIn → `${glabNotLoggedInText(detail)} —
 *  run glab auth login in a terminal, then Retry.`; failed → `Could not read the links: ${message}`; a thrown call →
 *  problemText({ action: "mergeRequests", step: "links", cause }, platform). */
export function linksFailedText(load: Extract<LinksLoad, { kind: "refused" | "failed" }>, platform: string): string;
```

- A commit's `detail` is `shown` with `closed: false` when it has a title, else `notShown`.

**The row** (`MergeRequestRow.vue`, rule 1):

- A new `<span class="flex w-7 shrink-0 justify-center">` directly after the description's info column (the span
  `mr-description-page` added after the approvals) and before the CI box's. It always renders, so the column stays.
- It holds `<MergeRequestLinks :row />` only when `row.hasDescription`.

**The box** (`MergeRequestLinks.vue`, `MergeRequestDiscussions.vue:96-167` is the model):

- **Opener.** An area `<span ref="area" data-row-control class="flex cursor-default" @click.stop>` with
  `useHoverBox`'s `on` handlers; inside, `<button ref="opener" type="button" :aria-expanded="open"
  :aria-label="SHOW_LINKS" class="flex rounded p-1 hover:bg-hover">` with Lucide `link` `size-4`. No tooltip (the box
  opens at once). A click never reaches the row (`@click.stop`; rule 1).
- **Load.** `useRowLinks(mergeRequests, () => row.iid, () => open.value)`; the box shows `linkBox(load,
  navigator.platform)`.
- **Box.** `v-if="open"`, `ref="box"`, `tabindex="-1"`, the discussions box's classes (`fixed z-10 max-h-[60vh] w-max
  max-w-[30rem] overflow-y-auto rounded-md border border-control-border bg-panel-inline p-1 text-fg shadow-lg
  outline-none`), `:style="placement"`.
  - `status`: `<p role="status" class="px-2 pt-1 pb-0.5">`, muted or `text-problem-error` when failed; a failed one is
    followed by a Retry button (`RETRY`) calling `askLinks(row.iid)`.
  - `groups`: per group a heading (`px-2 pt-1 pb-0.5 text-fg-muted`) and a `<ul :aria-label="heading">`; per line an
    `<li class="flex items-start">` holding:
    - the line `<button type="button" class="flex min-w-0 flex-1 items-baseline gap-2 rounded px-2 py-1 text-left
      cursor-pointer hover:bg-hover">`: the group's icon (`layers` epics, `circle-dot` issues,
      `git-commit-horizontal` commits, `size-4 shrink-0`, `aria-hidden`), the reference (`shrink-0 font-mono`), then
      the title (`wrap-break-word`) and `CLOSED` (`text-fg-muted`), or `NOT_SHOWN` (`text-fg-muted`). A click calls
      `openPage("link", line.page)`; the box stays (rule 3).
    - when `parent` is not null, a sibling `<button type="button" v-tooltip="parent.tooltip"
      :aria-label="parent.tooltip" class="shrink-0 rounded p-1 cursor-pointer hover:bg-hover">` with Lucide
      `arrow-up-to-line` `size-4`; a click calls `openPage("link", parent.page)` (rule 4).
- **Keyboard.** `useHoverBox` opens the box on the opener's focus and keeps it while focus is inside; Tab moves
  through the lines and parent buttons in order; Enter and Space are the buttons' own.

## Change

1. `mergeRequestLinkLines.ts` and its test.
2. `MergeRequestLinks.vue`; the row's column.
3. `ui/AGENTS.md`: the links column and box (where its state lives, its asks, its words file).

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches:

- `mergeRequestLinkLines.test.ts`:
  - `groups_come_epics_issues_commits_and_an_empty_group_is_left_out` (rule 2)
  - `a_line_keeps_its_reference_title_and_closed` (rule 3)
  - `a_thing_gitlab_did_not_show_says_not_found_or_no_access_and_keeps_its_page` (rule 6)
  - `only_an_issue_with_a_parent_gets_the_parent_button_with_its_tooltip` (rule 4: epics, commits and parentless
    issues have none; the tooltip `Open parent: &3 Board redesign`)
  - `loading_empty_refused_and_failed_have_their_sentence_and_only_failures_retry` (rules 1, 5; `undefined` is loading)
- `mergeRequestTitles.test.ts` passes over the new file unchanged.

**Commands:** `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend fmt:check`, `pnpm -C frontend
test`, `pnpm -C frontend unused`, `pnpm -C frontend sfc-order`: their summary lines. `just mutants HEAD` in your
workspace (SP11).

**Smoke — WebKit fixture**, both windows (`--diff`, and `--range-case review --mr list`), dark and light (`--settings
'{"theme":"light"}'`). Start with `just app-session start-fixture --name mlp --diff --mr list --size 1600x1000` and
open the merge-requests page.

1. **Column (rule 1).** Every row's links column sits directly after the info column and before the CI box; !638 has
   no button and its CI box stays in line with !639's and !637's (WebDriver rects). The session log has no
   `fixture_links` line yet (a row never hovered is never asked).
2. **Hover (rules 1, 5).** Hover !640's button: the box opens at once with "Loading…", the log gains exactly one
   `fixture_links { iid: 640 }`, then the lines show. The pointer moves into the box: it stays open. Leave and hover
   again: no second `fixture_links` for 640.
3. **Groups (rule 2).** "Epics", "Issues", "Commits" in that order; each line once; the lines of the fixture's !640 in
   its order.
4. **Lines (rule 3).** `&4` and `other/lib#5` show "Closed"; `design&2`, `secret/vault#9` and
   `secret/vault@0badc0de` show "Not found or no access". A click on `#12` logs `fixture_page` with
   `…/-/work_items/12`; the box stays open; a click on the button itself never logs a `fixture_page` of the row.
5. **Parent (rule 4).** `#12`'s parent button shows "Open parent: &3 Board redesign" and its click logs
   `fixture_page` with `https://gitlab.example/groups/taskboard/-/work_items/3`; `#13`'s opens `…/-/work_items/12`;
   epics, commits and `other/lib#5` have none.
6. **Empty.** !639: "No linked epics, issues or commits."
7. **Failure (rule 5).** !636: "Could not read the links: glab timed out" with Retry; Retry shows the lines.
   !634: the not-logged-in sentence with Retry. Close and hover !634 again: a new `fixture_links { iid: 634 }`.
8. **Refresh (rule 5).** Press Refresh; after the list reloads, hover !640: a new `fixture_links { iid: 640 }` and
   "Loading…" first.
9. **Keyboard.** Tab to !640's links button: the box opens; Tab moves through the lines and the parent buttons; Enter
   on a line logs its `fixture_page`; Escape closes.
10. `shot` of !640's box and of the row's columns, dark and light.

**Smoke — real app.**

1. `scripts/local-conflicts-repo.sh <scratch>/mlr`, then `cargo tauri build --debug --no-bundle`, then `just
   app-session start-app --name mlr --diff --dir <scratch>/mlr --glab mr-links`.
2. Hover !62: the box lists the expected !62 of `mr-links-rust.md` (Epics 3, Issues 6, Commits 4, in order).
3. Click `#12`'s parent button: the fake opener logs `https://gitlab.example/groups/taskboard/-/work_items/3`; click
   the `secret/vault#9` line: it logs `https://gitlab.example/secret/vault/-/issues/9`.
4. !59 shows its issues without a parent button for `#20`, `#21`'s parent `#20`, and `&8` "Not found or no access";
   !61 the empty sentence; !60 the deadline sentence with Retry; !57 no button.
5. Paste the fake glab log's `argv:` lines: one `MergeRequestLinks` call for !62 and !59 each, none for !61 or !58, no
   `stdin:`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (proposed RK70), `skill://verification`.
