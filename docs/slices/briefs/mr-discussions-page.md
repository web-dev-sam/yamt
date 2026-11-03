# Slice mr-discussions-page — the count's box of open discussions, whose turn first; the Settings choice

Feature: whose turn it is, per open discussion. Sources:

- Request `docs/slices/request-mr-discussions.md`: rules 1–8 and the WebKit-fixture acceptance.
- Design `docs/slices/briefs/mr-discussions-design.md` option A, §1.7–1.10.
- Proposed plan §2 #163, #164; proposed RK60.

Needs `mr-discussions-state` (the slice's `discussions`, `discussionDetails`, `askDiscussions`; `setDiscussionDetails`
on `SettingsActions`; the fixture's discussions) and `mr-discussions-core` (`discussionTurns`, `turnCounts`, the words)
landed. **Wires the window:** the last implementer slice.

## Target

**Owned:**

- `frontend/src/ui/`:
  - New components: `MergeRequestDiscussions.vue`, `MergeRequestDiscussionSetting.vue`.
  - `MergeRequestRow.vue`.
  - Words and problems: `mergeRequestsText.ts`, `mergeRequestsText.test.ts`, `problem.ts`, `problemText.ts`,
    `problemText.test.ts`.
  - Settings seam: `settingsStore.ts`, `settingsStore.test.ts`.
  - The two roots' Settings slot only: `CompareApp.vue`, `RangeApp.vue`.
  - `AGENTS.md`.

**Read-only:** everything else.

- The state, used as contracted: `ui/mergeRequests.ts`, `ui/mergeRequestDiscussions.ts`, `ui/settings.ts`, `ipc/**`
  and its fixtures.
- `mergeRequests/**`: use its exports.
- The pattern to follow: `ui/useHoverBox.ts`, `ui/MergeRequestPeople.vue`, `ui/MergeRequestPicture.vue`,
  `ui/ChoiceButtons.vue`, `ui/SettingsView.vue`, `ui/tooltip.ts`.
- `ui/mergeRequestTitles.test.ts`: the no-`title` detector must stay green.
- `ui/compareStore.ts`, `ui/rangeStore.ts`, `ui/store.ts`: they already spread `settingsActions`.
- `docs/**`.

**Non-goals:**

- Replying, resolving or reacting.
- Resolved discussions, whole threads.
- Review mode and its words.
- A shared box component for the four hover boxes (design §1.9).
- The setting in the merge window (no merge-request page there).
- Markdown rendering (rule 5).

## Contract

Existing and fixed by the earlier slices:

- `useMergeRequests()` gives `discussions`, `discussionDetails`, `askDiscussions(iid)`, `me` and `openPage(clicked,
  page)`; `DiscussionLoad` (brief `mr-discussions-state.md`).
- `SettingsActions.setDiscussionDetails(details)`.
- The core's `discussionTurns`, `turnCounts`, `turnText`, `turnSummaryText`, `placeText`, `noteAuthorName`,
  `noteExcerpt`, `agoText`, `DISCUSSIONS_LABEL` (brief `mr-discussions-core.md`).
- From `../ipc`: `DiscussionDetails`, `DiscussionsAnswer`, `OpenDiscussion`.

New here:

```ts
// ui/mergeRequestsText.ts
export type PageKind = "job" | "mergeRequest" | "discussion";
// NOT_OFFERED.discussion = "This comment's page was not listed by GitLab, so yamt did not open it."
export const DISCUSSIONS_LOADING = "Loading discussions…";
export const DISCUSSION_DETAILS = "Discussion details";
export const DISCUSSION_DETAILS_OPTIONS: readonly { readonly value: DiscussionDetails; readonly label: string }[];
//   full "Load fully", lazy "Load lazily", off "Off"
export const DISCUSSION_DETAILS_HINT =
  "On the merge-request page: every listed merge request's open discussions, right after the list; one merge " +
  "request's, when you first hover its count; or none.";
/** The list's glab words with "then Refresh." (glabMissingListText, notLoggedInListText, glabFailedText). */
export function discussionsRefusedText(answer: Exclude<DiscussionsAnswer, { readonly kind: "open" }>): string;
// ui/problem.ts MergeRequestStep gains "discussions" | "discussion"; problemText.ts words:
//   discussions "Could not read the discussions", discussion "Could not open the comment's page"
// ui/settingsStore.ts: SettingsStore's Pick gains "setDiscussionDetails"
```

**`MergeRequestDiscussions.vue`**:

- Props `{ row: MergeRequestRow; now: number }`. It reads the slice through `useMergeRequests()` (PM10).
- **Off, or `row.openDiscussions === 0`:** exactly today's count span, moved from `MergeRequestRow.vue:163-171`:
  `v-tooltip` of `discussionsText`, `aria-label`, `MessageSquare` and the number, muted at 0. No box, no ask.
- **Otherwise**, the people box's shape (`MergeRequestPeople.vue:52-59,111-149`):
  - `useHoverBox({ area, opener, box })`.
  - An area `<span data-row-control class="flex cursor-default" @click.stop>` with its five handlers.
  - An opener `<button type="button" :aria-expanded="open" :aria-label="discussionsText(count)">` holding the icon
    and the count. It has no tooltip (#154).
  - The box `v-if="open"`, `tabindex="-1"`, with the people box's classes, `:style="placement"`.
- **Asking.** `watch(open, (isOpen) => { if (isOpen) askDiscussions(row.iid); })`, so pointer and keyboard focus both
  ask. The slice asks only with "lazy" and only once.
- **Header** (`role="status"`, `px-2 pt-1 pb-0.5`):
  - No entry or `loading` → `DISCUSSIONS_LOADING`.
  - `read` → `turnSummaryText(turnCounts(discussions, me))`.
  - `refused` → `discussionsRefusedText(answer)`.
  - `failed` → `problemText({ action: "mergeRequests", step: "discussions", cause })`.
  - Never the problem bar.
- **List** (`<ul :aria-label="DISCUSSIONS_LABEL">`): `discussionTurns(discussions, me)`. Each line is a `<button
  type="button">` (block, left-aligned, `hover:bg-hover`) that calls `openPage("discussion", page)` when `last.page`
  is not null, else a `<div>`. It holds:
  1. `MergeRequestPicture :person="last.author" size="box" aria-hidden="true"`, `noteAuthorName`, `agoText(createdAt,
     now)` muted, and right-aligned `turnText(turn)`: the viewer's turn in `text-primary` with weight, waiting muted.
  2. `placeText(place)`, muted.
  3. `noteExcerpt(text)` in `whitespace-pre-line break-words line-clamp-3`.
- **Text** is by interpolation only: no `v-html` and no `innerHTML` (rule 5, RK60). No `title` attribute anywhere.
- **Viewer.** `me` is the viewer. Review mode will replace this one argument; add no seam for it.

`MergeRequestRow.vue`: the count span becomes `<span class="flex w-12 shrink-0"><MergeRequestDiscussions :row
:now /></span>`. Drop what is then unused.

`MergeRequestDiscussionSetting.vue`:

- `<section aria-labelledby="settings-discussion-details">`, an `<h3>` `DISCUSSION_DETAILS`, then `ChoiceButtons
  :options="DISCUSSION_DETAILS_OPTIONS" :pressed="settings.discussionDetails" @pick="setDiscussionDetails"`, then a
  `<p class="mt-1 text-fg-muted">` hint. The same shape as the Antialiasing section (`SettingsView.vue:82-90`).
- It is put into `SettingsView`'s slot by `CompareApp.vue` (`:92`) and by `RangeApp.vue` (`:148-150`, beside
  `AgentSettings`).

## Change

1. `problem.ts`, `problemText.ts` and test; `mergeRequestsText.ts` and test; `settingsStore.ts` and test.
2. `MergeRequestDiscussions.vue`, then `MergeRequestRow.vue`.
3. `MergeRequestDiscussionSetting.vue`, then the two roots' slots.
4. `ui/AGENTS.md`:
   - The box: hover rule, ask on open, words, Off.
   - The setting section.
   - The state slice's `deviations_from_brief` `ui/` lines.

## Acceptance

**Vitest**, each test named for the bug it catches:

- Texts: every new word and each refused answer (exhaustive).
- `pageProblemText` for `discussion`.
- `problemText`'s two rows.
- `settingsStore`: the seam carries `setDiscussionDetails`.

**Commands:**

- `pnpm -C frontend lint`, `typecheck`, `test` (including `mergeRequestTitles.test.ts` and the fences, PM10):
  summary lines.
- `just map-check`: list its findings for the docs keeper.

**WebKit smoke on the fixture** (`skill://verification` recipe): `just app-session start-fixture --name md --diff --mr
list --size 1600x1000`, open the merge requests page. Use `hover`, `click`, `press`, `read <js>`, `shot`, and the
session's log for `mergeRequests.fixture_discussions`.

1. **Load fully (default).** Hover !638's count (2 open):
   - The box shows the header "N of 2 wait(s) for you" at once (its details came after the list), the viewer's-turn
     line first, then the newest first.
   - Each line has a picture, name, "… ago", "Your turn" or "Waiting for an answer", and its place.
   - The markup text shows as typed: `read` finds no `b` and no `script` element in the box, and its `innerText`
     holds `<b>not bold</b>` and `**not bold**`.
   - The fixture log shows `fixture_discussions` calls, one at a time, each asking the queue's not yet answered
     rows (the fixture answers the first 10, the state brief's rule 1 sends the rest again), so every row with a count
     above 0 is answered exactly once and no count-0 row's iid is ever asked.
2. **Click a line with a page:** `mergeRequests.fixture_page` with `…#note_…`, and no MR-page open from the row. A
   pageless line is no button.
3. **Load lazily.** Settings → Discussion details → Load lazily → Back. Refresh.
   - Hover a row's count: "Loading discussions…", then the box; exactly one new `fixture_discussions` line naming
     that iid only.
   - Hover away and back: no new line.
   - Tab to the next row's count opener (keyboard focus): it asks that row once.
4. **Off.** Settings → Off → Back. Refresh: no new `fixture_discussions` line. Hovering a count shows today's plain
   tooltip ("2 open discussions"); there is no `aria-expanded` opener.
5. **Applied at once.** From Off, Settings → Load fully → Back, without Refresh: `fixture_discussions` lines follow,
   and a hover shows the box.
6. **Failures.** `DISCUSSIONS_FAILED_IID`'s box says "glab timed out" in the list's words, and the count still shows.
7. `shot` with a box open in yamt Dark and yamt Light (Settings → Theme).

**Mutation:** `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://comment-policy`, `skill://risk-register` (proposed
RK60), `skill://verification`.
