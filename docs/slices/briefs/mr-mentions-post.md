# Slice mr-mentions-post — the mention list in the range window's "Text to post" box

Feature: `@` completion in comment fields. Sources:

- Request `docs/slices/request-mr-mentions.md`: field 2 (the Post box; "none known → search results only"), rules 1–7, and the acceptance line "the range window's 'Text to post' box lists and writes the same way (range fixture)".
- Design `docs/slices/briefs/mr-mentions-design.md` option A, §2.2 (who is known in the Post box), §2.6 and §2.8.
- Plan rows: #191, #192 and #118 (amended), all proposed. Risks: RK35 (amended), RK53, RK54.

Runs in round 3, once `mr-mentions-list` is committed. **This slice wires the range window's files screen**: the Post box. Its commit starts the verifier's second smoke pass.

## Facts (given)

**From `mr-mentions-list`.**

- `useMentions(field, known): MentionField` in `ui/mergeRequestMentions.ts`. Its members are `list`, `highlight`, `anchor`, `listId`, `fieldAria`, `keydown(event): boolean`, `pick`, `close`.
- `MergeRequestMentionList.vue`: props `list`, `highlight`, `listId`, `anchor`; emits `pick`.
- The list is an absolute child of a `relative` wrapper around the textarea.
- `ui/MergeRequestReplyField.vue` is the first user. Copy its wiring, which `ui/AGENTS.md` describes under "Mentions".
- The core exports `knownMentions(row, writers)` (`../mergeRequests`).

**The Post box.** `ui/RangeMessageEditor.vue` (`box: "post" | "edit"`, fixed for a mounted instance: `RangeMessage.vue:128-143` uses `v-if`/`v-else-if`):

- The textarea is at `:65-73` (`:value`, `@input="typed"`, `@keydown="keydown"`).
- `typed` (`:41-50`) is the only writer, through `threads.writePost`/`writeEdit`.
- `keydown` (`:58-60`) is `boxKeydown`: Mod-Enter submits (Queue for `post`), Escape emits `cancel`.
- `submit` is at `:52-56`.
- Only `post` reaches GitLab (plan §2 #118). `edit` changes a local note, so **no mentions in `edit`**.

**The range store.** `useRangeStore()` has:

- `gitlab.check: ShallowRef<GitLabCheck | null>` (`ui/rangeGitLab.ts:49-60`). `linedUp { mergeRequest: { reference, title, webUrl } }` is defined in `ipc/reviewDomain.ts:42-46, 73-75`.
- `mergeRequests.rows` (the window's merge-request slice, `rangeStore.ts:181, 197`). It is loaded only once the merge-request page has been shown in that window.
- A row's `page` is the merge request's GitLab page (`WebPage`, a branded string).
- Rust builds `webUrl` from the REST `web_url` (`crates/review/src/gitlab.rs:130-137`). `[INFERENCE: equal to the GraphQL `webUrl`that becomes`row.page`]`. A mismatch costs only the known people: the box falls back to search results.

**The fixtures.**

- `ipc/fixtureGitLab.ts:24-28` lines up `!12` on `https://gitlab.example.com/team/taskboard/-/merge_requests/12`.
- The `?mr=list` rows are !601–!640 on `ORIGIN = "https://gitlab.example/taskboard/taskboard"`, `page` = `${ORIGIN}/-/merge_requests/${iid}` (`fixtureMergeRequestData.ts:11-12, 246, 254-256` `fixtureRows`). No row matches !12.
- Scripts are listed in `GitLabScript` (`fixtureGitLab.ts:5-18`) and `GITLAB_SCRIPTS`.
- `pendingPosting(text, draftNote)` (`:128-136`) links `MERGE_REQUEST`. It has two callers: `fixtureReview.ts:190` (has `store.script`) and `fixtureThreads.ts:40` (the seeded pending note).
- The range fixture source answers `searchPeople` and logs `mergeRequests.fixture_people_search` (`fixtureRange.ts:169`).
- `app-session start-fixture` passes `--gitlab <script>` through as `gitlab=<script>` (`frontend/scripts/app-session/startArgs.ts:106-121`).

## Target

**Owned:**

- `frontend/src/ui/RangeMessageEditor.vue`
- `frontend/src/ui/rangeGitLab.ts`, `frontend/src/ui/rangeGitLab.test.ts`
- `frontend/src/ipc/fixtureGitLab.ts`, `frontend/src/ipc/fixtureGitLab.test.ts`
- `frontend/src/ipc/fixtureReview.ts`, `frontend/src/ipc/fixtureReview.test.ts`
- `frontend/src/ipc/fixtureThreads.ts`
- `frontend/src/ipc/AGENTS.md`

**Read-only:**

- everything else;
- the `mr-mentions-list` files: `ui/mergeRequestMentions.ts`, `ui/MergeRequestMentionList.vue`, `ui/mergeRequestMentionLines.ts`, `ui/AGENTS.md`. Write any line you need there in `deviations_from_brief`;
- `ui/boxKeys.ts`, `ui/RangeThreadBox.vue`, `ui/RangeMessage.vue`, `frontend/src/editor/**`, `frontend/src/ipc/bindings.ts`.

**Non-goals:**

- Mentions in the Edit box or the note boxes (`RangeThreadBox.vue`): request "Fields".
- The lined-up merge request's people over IPC: design option B, open question 1.
- Loading the merge-request list from the Post box.

## Contract

Fixed. You may add to it, but never change it.

```ts
// ui/rangeGitLab.ts
/** The loaded row of the merge request the range lines up with (design §2.2): when `check` is `linedUp`, the first of
 *  `rows` whose `page` equals `check.mergeRequest.webUrl`; else null (the Post box then shows search results only). */
export function linedUpRow(
  check: GitLabCheck | null,
  rows: readonly MergeRequestRow[],
): MergeRequestRow | null;

// ipc/fixtureGitLab.ts
// GitLabScript gains "listed": lined up like "linedUp", but with ?mr=list's newest row (!640).
/** The merge request a script lines up with: "listed" → !640 from fixtureRows (reference "!640", its title, its
 *  page as web_url); every other script → today's !12. */
export function mergeRequestOf(script: GitLabScript): Generated.MergeRequestRef;
export function pendingPosting(
  mergeRequest: Generated.MergeRequestRef,
  text: string,
  draftNote: number,
): Generated.Posting;
```

## Change

1. `rangeGitLab.ts`: `linedUpRow`.
2. `RangeMessageEditor.vue`:
   - `const mentions = props.box === "post" ? useMentions(field, () => knownMentions(linedUpRow(gitlab.check.value, mergeRequests.rows.value), [])) : null`. The writers are `[]`: range threads are local notes, not GitLab's.
   - `keydown` calls `mentions?.keydown(event)` first and returns when it is true. Otherwise it calls `boxKeydown` as today.
   - `submit` calls `mentions?.close()` before emitting.
   - Wrap the textarea in `<div class="relative">` with `v-bind` of `mentions.fieldAria.value` (post only) and `<MergeRequestMentionList>` while `mentions?.list.value` is not null.
   - `typed` stays the field's one writer (the pick's `insertText`/`input` reaches it).
3. `fixtureGitLab.ts`:
   - add `listed` (in `GitLabScript`, `GITLAB_SCRIPTS` and `notLinedUp`, where `listed` is lined up);
   - `mergeRequestOf`;
   - `gitLabCheck` answers `mergeRequestOf(script)`;
   - `pendingPosting` takes the merge request: `fixtureReview.ts:190` passes `mergeRequestOf(store.script)`, and `fixtureThreads.ts:40`'s seeded pending note passes `mergeRequestOf("linedUp")` (a note sent before, !12).
4. Tests below.
5. `ipc/AGENTS.md`: the range fixture's `?gitlab=listed` (what it lines up with, and why: the Post box's known people).

## Acceptance

**Tests** (`pnpm -C frontend test`):

- `rangeGitLab.test.ts`:
  - `the_lined_up_row_is_the_loaded_row_at_the_merge_requests_page`: `linedUp` with !640's page and the `?mr=list` rows → !640.
  - `no_loaded_row_or_no_lined_up_merge_request_gives_none`:
    - the same `linedUp` with `[]` rows → null;
    - `linedUp` at an address no row has → null;
    - `notLinedUp` → null;
    - `null` → null.
- `fixtureGitLab.test.ts`: `listed_lines_up_with_the_newest_listed_row`.
  - `gitLabCheck("listed", start)` → `linedUp` with `!640`, the title of `fixtureRows(0, 1)[0]`, and its `page`.
  - `pendingPosting(mergeRequestOf("listed"), "Hi", 7)` links `${page}/diffs`.
  - The existing `!12` cases are unchanged.
- `fixtureReview.test.ts`: `?gitlab=listed` checks lined up with !640. Its send's pending posting names `!640`.

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`, `sfc-order`. `just mutants HEAD` (`linedUpRow`'s guards are killed by the tests above).

**Smoke (WebKit range fixture; dark, and light with `--settings '{"theme":"light"}'`).** Paste the `read` results and log lines.

1. `just app-session start-fixture --name mmp --range-case review --threads seeded --gitlab listed --mr list --open-mr --size 1600x1000`. The merge-request page opens and loads its rows. Press Back to the files.
2. Open `board.ts`. Open a seeded thread whose note offers "Post", and press "Post": the "Text to post" box, focused.
3. Ctrl+End, then type ` @` → the list under the caret with !640's author, assignees, reviewers and approvers, each once. No `fixture_people_search` line.
4. Type `an` → one `fixture_people_search {"text":"an"}` after the pause, and Anna listed.
5. `read` the list's rect:
   - inside the pane's scroller rect (`.cm-scroller`);
   - painted over the lines below the box (`document.elementFromPoint` at its centre is in the list).
6. Down, then Enter → the box ends with `@anna `.
7. RK35. While typing, `document.activeElement` is the box. ArrowDown with the list open moves only the highlight: the shown file is unchanged.
8. Type `@an`. Escape → the list closes and the box stays. Escape → the box closes (cancel, as today).
9. Reopen Post, write `@an`, Enter, then Queue. The queued text holds `@anna `. Send → one pending posting naming `!640`.
10. Restart with `--gitlab linedUp`, open Post again, and type ` @` → no list. Type `an` → Anna, from the search only.
11. `shot` of step 4, in dark and in light.
12. `just app-session stop --name mmp`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (RK35, RK53, RK54), `skill://verification`.
