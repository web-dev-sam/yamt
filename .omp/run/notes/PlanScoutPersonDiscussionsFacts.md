# Fact sheet: discussions per person across merge requests (as of `e6eadfc0` map)

The person view needs two kinds of change that do not exist today:
- **Data:** the window knows only a discussion's last comment's text. For earlier notes it keeps only the author and mentions. Rust already fetches every note's text and HTML but drops them.
- **Thread state:** the window holds exactly one thread at a time. The panel and the reply field read and write that single slot, so several threads cannot be expanded inline at once.

The turn rule already works for any person, not just the logged-in user. No cross-merge-request list of discussions exists.

## 1. Data per discussion

**What `read_discussions(iids)` returns (Rust)**
- `RowDiscussions { iid, answer }`; `answer` is `Open { discussions: Vec<OpenDiscussion> }`, `GlabMissing`, `NotLoggedIn` or `Failed` (`crates/merge-requests/src/discussions.rs:44-73`).
- `OpenDiscussion { id, place, earlier: Vec<TurnComment>, last: DiscussionNote }` (`discussions.rs:76-86`). The starter is `earlier[0]`, or `last` when `earlier` is empty.
- `TurnComment { author: Option<Person>, mentions }` (`:90-95`). Earlier notes carry **no text, no HTML and no time**.
- `DiscussionNote { author, created_at, text (raw body), page, mentions }` (`:115-126`). This is the last note only.
- `DiscussionPlace` is `Overview` or `File { path, line }` (`:98-111`).
- The shell's `ReadDiscussions { rows, pictures }` carries the uploaded pictures of note authors, one per username (`:130-135`).

**What Rust fetches versus what it keeps**
- The GraphQL query reads `notes(first: 200)` with `system author{username name avatarUrl} body bodyHtml createdAt lastEditedAt lastEditedBy url position` (`crates/merge-requests/src/query.rs:148-159`). The parsed `NoteNode` has `body` and `body_html` (`discussions/answer.rs:75-86`).
- `open_discussion` then drops them: earlier notes map to `{mentions, author}` only; the last keeps `created_at` and `text: last.body` (`discussions/turn.rs:44-82`).
- **So the first note's text or HTML is not available without the thread read**, unless the discussion has a single person note, in which case `last` is the starter.
- No field records whether a discussion is resolvable or resolved. Only open discussions are returned at all: `!resolvable || resolved` are skipped (`turn.rs:19-21`). System notes are dropped (`turn.rs:30-41`). More than 200 notes fails the whole row (`turn.rs:31-35`).

**Reviewers and author** are not in the discussion data. They live on the row: `MergeRequestRow.author: Person|null`, `reviewers: Reviewer[]` where `Reviewer = {person, state}`, plus `assignees` and `approvedBy` (`frontend/src/ipc/mergeRequestDomain.ts:14-19, 21-44`).

**TypeScript mirror:** `frontend/src/ipc/discussionDomain.ts:19-64`.
- Same shapes; `createdAt` is converted to ms. `toRowDiscussions` is at `:127-137`.
- Core structural copy: `frontend/src/mergeRequests/internal/discussions.ts:4-20`.

**Full thread read: `read_discussion_thread(iid, discussion)`**
- Returns `DiscussionThreadReply`: `read { thread }`, `notFound`, `glabMissing`, `notLoggedIn` or `failed` (`crates/merge-requests/src/discussion_thread.rs:21-42`).
- `DiscussionThread { discussion: OpenDiscussion, resolved, comments, drafts, pending, commenting, mayResolve }` (`:47-62`).
- `DiscussionComment { author, createdAt, edited, body: Description (bodyHtml reduced by described_on), page }` (`:67-79`). Every person note is included, up to 200.
- TS: `discussionDomain.ts:42-61`, converted at `:159-179`.
- Cost: four glab runs per open (login, project, the discussions query for `[iid]` paged until the id appears, then drafts) (`docs/architecture.md:1036-1050`). Each thread read therefore re-reads all of that merge request's discussions.

**Pictures**
- Rust's `Person.picture` is `uploaded`, `gravatar` or `none`.
- `toPerson` turns `uploaded` into `uploadedPicture(username)` (`mergeRequestDomain.ts:109-122`). In the app that is `convertFileSrc(key, "yamt-picture")`, i.e. `yamt-picture://localhost/<username>` (`frontend/src/ipc/tauriMergeRequests.ts:27-31`).
- Rendered by `MergeRequestPicture.vue` with props `{person, size: "row"|"stack"|"box"}` and an initials fallback (`ui/MergeRequestPicture.vue:9-17`).

**Load paths: the "Discussion details" setting**
- Values are `Full` (default), `Lazy`, `Off` (`crates/settings/src/lib.rs:74-79`).
- The queue is `ui/mergeRequestDiscussions.ts`:
  - **full**: `listed()` queues every row with `openDiscussions > 0` (`:122-141`). Rows with a count of 0 are never asked (plan #164).
  - **lazy**: `asked()` reads a row only when its box opens (`:189-203`).
  - **off**: `dropped()` (`:143-149`, `:163-180`).
- One call in flight at a time; `send()` sends all queued iids and loops (`:101-120`).

**Batch size and timing**
- Rust answers the first `DISCUSSION_BATCH = 10` distinct iids (`discussions.rs:31`, `:187-199`). The glab deadline is `GLAB_TIMEOUT` 20 s (`crates/gitio/src/glab.rs:14`).
- Plan #162's text still says 20; that was superseded by #179 (`docs/plan.md` rows 162 vs 179).
- Measured on gitlab-org/gitlab: 20 busy rows timed out at 31.7 s; the first 10 took 23.5 s (past 20 s, so that batch's rows fail); the second 10 took 12.2 s (`docs/architecture.md:1017-1021`). The older, lighter query took 4.47 s per 20 rows (`docs/slices/briefs/mr-discussions-design.md:18-19`).
- For 500 rows the review-mode design estimated about 2 min at the old rate (`briefs/mr-review-mode-design.md:107-109`). At 10 rows per call and 12–23 s per call, a full load is minutes [INFERENCE].
- Fixture: 400 ms per call, 10 rows (`ipc/fixtureMergeRequestDiscussions.ts:31-32`).

**Window state per row:** `DiscussionLoad` is `loading`, `read { discussions, resolved: Set<DiscussionId> }`, `refused` or `failed` (`ui/mergeRequestDiscussionRows.ts:14-26`). `unmarkedOf` leaves out discussions resolved in the box (`:103-105`).

## 2. Turn rule

**Core** (`frontend/src/mergeRequests/internal/discussions.ts`):
- `turnOf(discussion, viewer: string|null, author: string|null): Turn` (`:114-124`). `Turn` is `viewer`, `author`, `person{username,name}`, `waiting` or `open` (`:24-29`).
- Rules:
  - B1 `waitedOn`: the viewer wrote the last comment (`:71-77`).
  - B2 `isViewersTurn`: the viewer is the author, wrote in it, or is mentioned (`:86-95`).
  - B3 `othersTurn` (`:98-110`).
- Helpers, private: `isUser(person, username)` (`:58-60`), `starterOf` (`:66-68`), `wroteIn(discussion, viewer)` (`:80-82`). Not exported from `index.ts`.
- Public (`mergeRequests/index.ts:110-124`):
  - `discussionTurns`: viewer's turn first, then newest last comment (`:128-139`).
  - `turnCounts → {viewersTurn, viewerWrote, total}` (`:142-153`).
  - `viewerOf(review, me, rows)` (`:157-174`).
  - `turnText(turn, viewer, author)` gives "Your turn", "Anna Berg's turn", "Dmitri Volkov's turn" (`:189-206`).
  - `turnSummaryText`, `placeText`, `noteAuthorName`, `noteExcerpt` (`:208-241`).

**Works for any person:** `viewer` is any username. Review mode already passes another reviewer: `Viewer` is `me` or `person{username,name}` (`:38-40`); `viewerOf` names a person by the first row reviewer with that username (`:157-174`). Writes are always made as the logged-in user (plan #185).

**Review-mode order** (`mergeRequests/internal/reviewOrder.ts`):
- `reviewOrdered(rows, reviewer, dueOf, detailsOf)` (`:51-80`) sorts `byDueDate`, then stably by `reviewFirst` (`:41-48`):
  - D1 `dueFirst` (from `internal/order.ts`);
  - D2 most `viewersTurn`;
  - D3 fewest `viewerWrote`.
- A failed row keeps the normal order.
- Wired in `ui/mergeRequestsShown.ts:75-80, 140-150`. Picker enabled only with details "full" (`ui/MergeRequestsView.vue:186`).
- The ordering is per merge request; nothing orders individual discussions across rows.

## 3. People

- **Viewer identity:** the slice's `me: ShallowRef<string|null>`, from the list page's `MergeRequestPage.me` (`ui/mergeRequests.ts:68`; `ipc/mergeRequestDomain.ts:46-49`). Fixture `FIXTURE_ME = "sam"` (`ipc/fixtureMergeRequestData.ts:4`).
- **People on a row:** `peopleOnRow(row)` returns author, assignees, reviewers, approvers (`mergeRequests/internal/suggestions.ts:21-…`). `peopleOf(rows, "assignees"|"reviewers")` counts rows per username (`internal/choices.ts:45-62`).
- **Two people searches per slice**, both `createPeopleSearch(source)` returning `{state, search, end}`, backed by GitLab `autocompleteUsers` (≤ 20) (`.omp/skills/project-map/state.md:78`):
  - `peopleSearch`, for the people box;
  - `mentionSearch` (`ui/mergeRequests.ts:66, 289`).
- `knownMentions(row, writers)` lists the row's people then the thread's writers (`internal/mentions.ts:43-…`).

**Existing pickers. None is a free "pick a person" control:**
- `MergeRequestReviewMode.vue`: the review-mode picker, a generic `MergeRequestMenu<V>` over `Choice<ReviewFor>` with a narrow box (`ui/MergeRequestReviewMode.vue:11-23`; `ui/MergeRequestMenu.vue:1-14`). Its choices are `reviewChoices(personChoices(rows,"reviewers",me))`, i.e. Me plus the reviewers on the loaded rows (`choices.ts:74-109, 133-145`; `ui/mergeRequestFilters.ts:105-112`). Picking it calls `review(who)` and sets the **Reviewer filter** (`reviewing`: Reviewer = who, Ready, the rest off; tree.md:211).
- `MergeRequestFilter.vue`: checklists of assignees, reviewers and labels.
- `MergeRequestPeopleSearch.vue`: bound to `{row, group}`; picking a person adds them to that merge request (`:18-21`).

## 4. Page structure

- **Root:** `ui/MergeRequestsView.vue`. Layout:
  - header: Back, list age, Refresh;
  - filter row: `MergeRequestSearch`, three `MergeRequestFilter`s, `MergeRequestReviewMode`, `MergeRequestReviewSort`, Clear, the Draft `ChoiceButtons`;
  - the row list `MergeRequestRow` v-for over `shownRows` (`:256`);
  - one `MergeRequestDescription` panel (`:277`).
- **No routing or tabs inside the page.** The window's `Screen` is `files`, `settings`, `serverLog` or `mergeRequests` (`ui/screen.ts:3-7`). The page shows when `screen.kind === 'mergeRequests'`.
- **Host windows:** compare (`ui/CompareApp.vue:96`) and range (`ui/RangeApp.vue:153`), opened by `MergeRequestsButton` (`CompareView.vue:91`, `RangeApp.vue:143`, `RangeView.vue:109`). The merge window never shows it (state.md:36).
- **Store:** one slice per window, `createMergeRequests` (`ui/mergeRequests.ts:55-108, 184-193, 288-295`), registered by `windowMergeRequests` and read via `useMergeRequests()` (`ui/mergeRequestsStore.ts:16-38`).
- **Sub-views:** everything else is a per-row hover box or a single window panel. In the row (`ui/MergeRequestRow.vue:163-215`): `MergeRequestPeople`, `MergeRequestDueDate`, `MergeRequestDiscussions`, `MergeRequestLinks`, `CiStatusBox`. The window panels are the thread, the description and the job log.
- **Escape:** never leaves the page. The page's `escapePressed` only closes a filter menu (`MergeRequestsView.vue:101-107`; plan #189 C).
- **Fence PM10:** `src/ui/(MergeRequest|mergeRequest|CiStatus)*.{ts,vue}` must not import `store.ts`, `App.vue`, `compareStore.ts`, `CompareApp.vue`, `rangeStore.ts`, `RangeApp.vue` or `lsp/`. They go through `useMergeRequests()` (`frontend/scripts/windowFence.ts:23`; project-map PM10). Core `mergeRequests/` imports no Vue and no other `src/` module (PM3).

## 5. Thread panel

**Box → panel**
- `MergeRequestDiscussions.vue` uses `useHoverBox` with `pinned: () => shownHere() !== null` (`:52-57`).
- Lines are built from `discussionTurns` and show the **last** author, how long ago, the turn, the place and an excerpt of the last text (`:89-110`, template `:298-340`).
- **Shift is a tap, not a hold:** `watch(useShiftTaps(), …)` picks the pointed or focused line and calls `showThread(iid, id)`, guarded by `isTypingTarget` (`:112-118`). `useShiftTaps` and `useShiftHeld` are shared composables over `keyHold.ts` (`ui/useShiftHeld.ts:58-67`).
- `ui/boxKeys.ts` maps Mod-Enter to submit and Escape to cancel for the reply field (`:11-38`).
- The panel is mounted inside the box: `<MergeRequestThread v-if="open && shownId !== null" :anchor …>` (`:342-353`).

**Panel (`ui/MergeRequestThread.vue`)**
- Props `{iid, author, place, turn, anchor, now, asking}` (`:34-47`).
- **Tied to placement:** `useBesidePlacement(panel, anchor)` (`:52`) and root class `fixed z-10 h-[min(48rem,…)] w-[min(40rem,…)]` (`:139`). `besideLeft` puts the right edge on the anchor's left (`ui/useMenuPlacement.ts:15-17, 26-31`).
- It has a window keydown listener for Escape (`:53`).
- It renders whichever thread is in the slot: `shown = thread.value?.shown.iid === props.iid ? thread.value : null` (`:55`).
- Body: `MergeRequestThreadComment` per comment (props `comment`, `author`, `now`), Pending drafts, then `MergeRequestReplyField` (`:214`).
- Header: Open on GitLab, Submit review (pending count), Close.
- It cannot be dropped into a list as-is: fixed positioning, the beside-anchor placement and the single-slot read all assume the side-panel use [INFERENCE from the code above].

**Reply field (`ui/MergeRequestReplyField.vue`)**
- Props `{thread: Thread, writable}` (`:36-37`).
- Write/Preview toggle, a textarea that grows from 3 to 12 lines, `@` mentions, and the buttons Add review (draft), Add comment and Resolve/Unresolve thread (`:229-300`).
- Text is per discussion via `replyTexts` and `setReplyText`.
- `showPreview`, `showWrite`, `sendReply` and `setResolved` take **no discussion argument**; they act on the slot (`:44-45`).

**State owner: one thread per window** (`ui/mergeRequestThread.ts`)
- `Thread { shown: {iid, discussion}, load, sending, preview }`; `Threads.thread: ShallowRef<Thread|null>` is documented as "The window's one thread panel" (`:36-44`).
- `showThread` replaces the slot (`:138-143`, `:252-255`).
- Writes read `state.thread.value?.shown` (`:221-222`). `write` refuses unless the slot's thread is read and not refreshing (`:164-183`). The private `writing` allows one write at a time window-wide (`:68-71`).
- `replyTexts: Map<DiscussionId,string>` keeps every discussion's draft text for the window's life (`:46`; state.md:90).
- state.md:89 confirms: "`thread` (… `| null`, the window's one panel) written only by its own functions".
- Held rows: the panel's row stays in the list via `panelRow` (`ui/mergeRequestsShown.ts:142`; state.md:81).

## 6. Fixtures

**`?mr=list`**
- 40 rows: `LIST_PAGE` 20 × `LIST_PAGES` 2 (`ipc/fixtureMergeRequests.ts:56-57, 122-125`), iids !640 down to !601 [INFERENCE from `NEWEST_IID` 640, `fixtureMergeRequestData.ts:12`].
- `openDiscussions = index % 3`, except !637 = 13 and !636 = 3 (locked) (`fixtureMergeRequestData.ts:18-25, 242`). That makes about 27 rows with discussions [INFERENCE].
- People: sam (me), anna, ben, chiara, dmitri (`:65-71`); search-only erik, olga, rita (`:76-80`). Uploaded pictures load only for sam (`:102-104`).
- Ordinary rows: at most 2 discussions, each with **one** comment, so `earlier` is empty (`fixtureMergeRequestDiscussions.ts:93-118`).
  - Authors: the next row's author, and the row's first reviewer.
  - !618, !633 and !623 `@sam`; !602 `@anna` (`:53`).
- Scripted turn cases:
  - !637 has 13 multi-comment threads among anna, sam, dmitri, ben, chiara, a deleted user, `@all` and a self-mention (`fixtureMergeRequestTurnCases.ts:38-88`).
  - !636 has 3 locked cases (`:90-103`).
  - Drafts exist on d01 and d05.
- Failure rows: !615 times out, !629 is logged out (`fixtureMergeRequestDiscussions.ts:27-28`).
- Writes mutate a shared `DiscussionStore`. Threads come from `fixtureMergeRequestThreads.ts:167-200`.

**Fake glab scenarios**
- `tests/glab/mr-discussions/`: batch 82-81-79-78, a later page `79-after-d-2`, failing 77, pictures.
- `mr-threads/`: !90 and !91 discussions plus after-post variants, draft notes, markdown, people.
- `mr-threads-refused/`, `mr-review-mode/`: batch 97…90.
- The fake glab selects files by `graphql-discussions-<iids>[-after-<cursor>].json` (tree.md:143).

## 7. Existing aggregation per person or across merge requests

- **None at the discussion level.** Every consumer reads the queue per iid: the box via `useRowDiscussions` (`mergeRequestDiscussionRows.ts:122-…`) and review order via `loads.get(iid)` (`mergeRequestsShown.ts:76-79`). No code flattens `discussions.value` across rows (grep of `discussions.value` in `ui/` finds only per-iid reads and tests).
- **Closest per-person aggregates:**
  - `turnCounts` per row for one viewer (`viewersTurn`, `viewerWrote`);
  - `reviewOrdered` across rows (per merge request, not per discussion);
  - `peopleOf`/`personChoices` row counts per username;
  - `viewerOf`.
- **Missing for the requested sort keys:**
  - "the person opened it": the starter is `earlier[0]?.author ?? last.author`, but `starterOf` is private;
  - "the person wrote in it": `wroteIn` is private, though `turnCounts.viewerWrote` counts it;
  - "the person is a reviewer": `row.reviewers`.

  All three are derivable from current data. The first comment's **text** and the later commenters' **order with times** are not: times exist only for `last`, though `earlier` keeps the authors in order.