# Design — one person's discussions across every merge request

Request: `docs/slices/request-mr-person-discussions.md` (rules A1–F2, "To be measured by the design", acceptance, non-goals,
reopens). Facts: `.omp/run/notes/PlanScoutPersonDiscussionsFacts.md` (cited as "facts §n"). Base `197f8c6e`. Prior designs
reused, not reopened: `briefs/mr-threads-design.md`, `briefs/mr-discussions-design.md`, `briefs/mr-review-fixes.md`,
`briefs/mr-mentions-design.md`. The briefs are `mr-person-discussions-{rust,core,threads,ipc,state,view,verify}.md`.

**Owner's answers (2026-11-05, via Main), all three the request's defaults:**

1. C1: every open discussion of the listed merge requests ("every discussion, the list was sorting importance").
2. F1: opening the view loads every missing listed row, whatever "Discussion details" says.
3. E2: a chevron on every entry.

## 0. Facts this design rests on

| fact                                                                                                                                                                                                                                             | source                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The discussions query already reads every note's `body` and `bodyHtml`; the parsed `NoteNode` keeps both; `open_discussion` drops them for every note but the last's raw body.                                                                   | `crates/merge-requests/src/query.rs:148-159`, `discussions/answer.rs:75-86`, `discussions/turn.rs:44-82`                                                    |
| Measured on gitlab-org/gitlab: 10 busy rows took 23.5 s and 2.7 MB with `bodyHtml`; the older query without it took 19.7 s on the same 10; the second 10 took 12.2 s. `GLAB_TIMEOUT` is 20 s, so a 23.5 s batch fails its 10 rows.               | `docs/architecture.md:1017-1022`, `crates/gitio/src/glab.rs:14`                                                                                             |
| `open_discussion` is the one builder of `OpenDiscussion`, for the box, a row's reload and the thread (`DiscussionThread.discussion`).                                                                                                            | `docs/architecture.md:1026`, `discussion_thread/read.rs` `thread_from`                                                                                      |
| A thread comment's body is `described_on(project, iid, bodyHtml)`; its pages and uploads are offered by the shell before the reply (`offer_described`), each once in order (`comments_of`).                                                      | `discussion_thread/read.rs` `comments_of`; `src-tauri/src/merge_requests.rs:110-113`; RK41, RK53                                                            |
| The shell offers today only each answered `last.page` and the authors' pictures for `read_discussions`.                                                                                                                                          | `src-tauri/src/merge_requests/discussions.rs:9-26`                                                                                                          |
| An upload is fetched only when the window asks `yamt-picture://…/upload~<key>`; ≤ 4 glab fetches at once; description images are `loading="lazy"`.                                                                                               | `src-tauri/src/merge_requests/pictures.rs:17, 66-72, 74-93`; `ui/MergeRequestDescriptionImage.vue:46`                                                       |
| The window's thread state is one slot: `thread: ShallowRef<Thread \| null>` ("the window's one thread panel"); `show` replaces it; writes read the slot; `generation` is window-wide; `writing` allows one write at a time.                      | `ui/mergeRequestThread.ts:36-44, 62-71, 138-143, 164-197`; `state.md:89`                                                                                    |
| `replyTexts: Map<DiscussionId, string>` keeps every discussion's text for the window's life; the panel and the field read it per discussion.                                                                                                     | `ui/mergeRequestThread.ts:46, 145-153`; `state.md:90`                                                                                                       |
| The panel is placed beside the box (`useBesidePlacement`, root `fixed z-10 h-[min(48rem,…)] w-[min(40rem,…)]`), has a window Escape listener and renders whichever thread is in the slot. The reply field's actions take no discussion argument. | `ui/MergeRequestThread.vue:50-55, 106-119, 137-142`; `ui/MergeRequestReplyField.vue:36-45`                                                                  |
| Held rows: `keptInPlace(previous, next, held)` keeps a held row at its previous index; `panelRow` is a computed of the panel's iid only.                                                                                                         | `ui/mergeRequestsShown.ts` `keptInPlace`, `:142`; plan §2 #189 "Held rows"                                                                                  |
| The queue: one call at a time, 10 rows per call (Rust's `DISCUSSION_BATCH`), `listed` only under "full", `askDiscussions` only under "lazy", "off" drops everything and `reloadDiscussions` refuses under "off".                                 | `ui/mergeRequestDiscussions.ts` `send`, `listed`, `asked`, `dropped`, `reload`; `crates/merge-requests/src/discussions.rs:31`                               |
| The turn rule takes any username as the viewer; `Viewer` is `me` or `person`; `turnText(turn, viewer, author)` reads "Your turn" or "<Name>'s turn". `starterOf` and `wroteIn` exist but are private.                                            | `mergeRequests/internal/discussions.ts:38-40, 66-82, 114-124, 189-206`; facts §2, §7                                                                        |
| `earlier` keeps every later writer in order (`earlier[1..]`, then `last`); only `last` has a time.                                                                                                                                               | `discussions.rs:76-95`; facts §1                                                                                                                            |
| `MergeRequestMenu<V>` is the narrow-box menu (narrows above `NARROW_FROM` 8 by `narrowed`, which reads only `label`); `Choice<V>` carries a `count` the review-mode picker shows.                                                                | `ui/MergeRequestMenu.vue:1-24`; `mergeRequests/internal/choices.ts:15-22, 146-149`; `ui/MergeRequestReviewMode.vue`                                         |
| Shift is a tap (`useShiftTaps`), guarded by `isTypingTarget`; the page's Escape only closes a filter menu (plan #189 C).                                                                                                                         | `ui/useShiftHeld.ts:63-67`; `ui/MergeRequestDiscussions.vue:112-118`; `ui/MergeRequestsView.vue:101-107`                                                    |
| `?mr=list`: 40 rows !640–!601; ordinary rows hold ≤ 2 one-comment discussions; !637 holds 13 multi-comment cases, !636 3; !615 times out, !629 is logged out; 10 rows per 400 ms call. Fixture comments already carry a `body: Description`.     | facts §6; `ipc/fixtureMergeRequestDiscussions.ts:27-32, 64-118`; `fixtureMergeRequestTurnCases.ts:38-103`                                                   |
| Rows named by earlier smoke expectations (review orders, threads, discussions): !602 !603 !605 !606 !608 !612 !614 !615 !617 !618 !622 !623 !627 !629 !630 !632 !633 !635–!640. Free rows with discussions today: !609 !611 !620 !621 !624 !626. | `briefs/mr-review-mode-design.md:203-206`; `mr-review-mode-verify.md:36-39`; `mr-threads-verify.md:26-65`; `fixtureMergeRequestData.ts:18-25` (`index % 3`) |
| Lucide `messages-square`, `chevron-right`, `chevron-down` are in `@iconify-json/lucide`.                                                                                                                                                         | `frontend/node_modules/@iconify-json/lucide/icons.json:1120, 1132, 3468`                                                                                    |

## 1. Options

They differ on two axes: where the first comment's formatted text comes from (the discussions read, or the thread read),
and who owns several shown threads (the one thread owner, keyed; or per-entry objects owned by the view's components).

### Option A — the first comment in the discussions read, several threads keyed in the one owner, a five-group core order (recommended)

**Data structures (first):**

- Rust `OpenDiscussion` gains `first: FirstComment { created_at: String, body: Description }` (the starter note's time and
  its `bodyHtml` through `described_on`). `ReadDiscussions` gains `pages: Vec<WebPage>` and `uploads: Vec<OfferedUpload>`.
  A crate-private `Offers { pages, uploads }` is the one "each once, in order" collector, shared by the discussions read and
  the thread read's `comments_of`.
- TS `OpenDiscussion.first: { createdAt: number /* ms */; body: Description }`.
- Thread state (`ui/mergeRequestThread.ts`): `threads: ShallowRef<ReadonlyMap<DiscussionId, Thread>>` (every thread shown:
  the box's panel's and each expanded entry's), `expanded: ShallowRef<ReadonlySet<DiscussionId>>`, a private
  `panel: DiscussionId | null`, a derived `thread` (the panel's), a public `writing: WriteKind | null`; every action takes
  the discussion.
- Core (`mergeRequests/internal/personDiscussions.ts`): `PersonGroup = "turn" | "started" | "wrote" | "reviewer" | "other"`,
  `PersonEntry<D, R>`, `personEntries(listed, person)`, `laterWriters`, `foldedWriters`, `personLines`; `keptInPlace`
  moved to `internal/keptInPlace.ts`, generic, for the rows and the entries.
- View state (`ui/mergeRequestPersonView.ts`): `PersonViewState { person: Viewer; held: ReadonlySet<DiscussionId>; order:
  number } | null` and the derived `PersonViewShown` (entries, loading counts, failures, people).
- Queue (`ui/mergeRequestDiscussions.ts`): `wantRows`, `retryRows`, `reloadRows`, `viewLeft`.

**Files:** crate `discussions.rs`, `discussions/{turn,offers}.rs`, `discussion_thread/read.rs`, `lib.rs`, their tests, two
fake-glab files; shell `merge_requests/discussions.rs` + test; `ipc/discussionDomain.ts`, four fixture files, their tests;
core `personDiscussions.ts`, `keptInPlace.ts`, `discussions.ts`, `choices.ts`, `index.ts`; `ui/mergeRequestThread.ts`,
`MergeRequestThread.vue` split into the shell + `MergeRequestThreadBody.vue` + `MergeRequestThreadButtons.vue`,
`MergeRequestReplyField.vue`; `ui/mergeRequestDiscussions.ts`, `mergeRequestPersonView.ts`, `mergeRequests.ts`,
`mergeRequestsShown.ts`, `mergeRequestsRefresh.ts`; `MergeRequestsView.vue`, `MergeRequestPersonView.vue`,
`MergeRequestPersonEntry.vue`, `MergeRequestPersonMenu.vue`, `MergeRequestWriters.vue`, `MergeRequestMenu.vue`,
`mergeRequestsText.ts`; tests beside each. About 55 files over six slices. No new command, no dependency.

**Risks:**

- **Thread records crossing (RK78 proposed).** A late answer reaching another discussion's record, a write sent to the
  wrong discussion, a collapsed entry resurrected by its own late answer. Kept by keying every read token and every patch
  by `DiscussionId` and by dropping an answer whose record is gone.
- **Long loads on big projects.** Under "Load lazily"/"Off" the view asks every listed row: minutes on a big project, and
  batches past 20 s fail their rows (§2.5). F1's progress line and F2's Retry are the user's handle.
- **Payload.** One `Description` more per open discussion in every discussions reply `[INFERENCE: a share of the 2.7 MB
  GitLab already sends per 10 busy rows]`; measured on the fake by the Rust slice (bytes before and after).
- **Excess property churn.** `first` is required, so every hand-built `OpenDiscussion` in tests changes once (ipc slice).

**Tests:** Rust (each discussion's `first` in one read; offers of a first comment's link and upload; the thread's
`discussion.first`), core (every group by name for the viewer and another person, newest first, held entries, writers and
the fold, people lines), threads (two expanded at once, one write window-wide, a collapsed record's late answer dropped,
the panel untouched by an expansion), queue (wanted rows under each setting), view state (Me → Anna reorders, held while
expanded, leaving drops marks), SSR view tests, WebKit fixture smoke, real app on the fake glab.

**Visions:** 1 (one owner of threads to read; one order function; the panel and the entry share one body), 2 (one builder
of `OpenDiscussion`, one offers collector, one `keptInPlace`, one reply text per discussion), 4 (`PersonGroup` and the
thread map keyed by id: no "which slot" flag), 5 (no command, no dependency; every new helper has two users or is the
feature's one rule).

### Option B — option A's Rust, thread objects owned by each entry component

**Data structures:** a factory `createThread(source, shown, lock)` → `ThreadHandle { thread: ShallowRef<Thread>, send…,
dispose }`. The box's panel holds one handle, each expanded entry its own (`useThread(iid, id)` in
`MergeRequestPersonEntry.vue`). The slice keeps `replyTexts`, a window `WriteLock`, and a registry `Set<ThreadHandle>` so a
refresh, a list Refresh or a submit reaches every handle.

**Files:** as A, with `ui/mergeRequestThread.ts` split into the factory and the registry, and one composable more.

**Risks:** the thread state moves into components, so "where is this thread's state, who writes it" has two answers (the
handle and the registry; state.md's one-owner rule, vision 2); the registry is A's map under another name, plus disposal
order on unmount (a write in flight when an entry unmounts writes into a dead handle); the box's `panelRow` and the
discussions box's "close when another row's thread shows" need the registry anyway.

**Tests:** A's, plus disposal and registry tests.

**Visions:** none gained over A; against 2 (two owners) and 1 (more layers to trace).

### Option C — no Rust change: the first comment through the thread read

**Data structures:** `firstComments: ReadonlyMap<DiscussionId, FirstLoad>` (loading | read { createdAt, body } | failed),
filled by `readDiscussionThread` for each entry as it scrolls into view (`IntersectionObserver`); A's thread and core
structures otherwise.

**Files:** A's minus the Rust and ipc slices, plus a second queue for first comments.

**Risks:** every thread read is four glab runs re-reading the whole merge request's discussions (architecture.md:1052;
two after #187 remembers the login and project), so a view of 27 rows and ~50 discussions costs ~100 glab runs for text
GitLab already sent with the first read; a scroll starts dozens of reads; a second load path for one row, which plan #183
rejected; the entries show without text until each answer.

**Tests:** A's, plus the visibility queue.

**Visions:** against 2 (the same text read twice by two paths) and 5 (a second queue).

A raw-text variant (the starter's `body` instead of its rendering) is not an option: D2 asks GitLab's formatting, code
colours, images and links, and RK60 forbids interpreting an excerpt as markup.

## 2. Option A in detail (what the briefs implement)

### 2.1 The first comment's formatted text — "To be measured" item 1

- **Shape.** `OpenDiscussion { id, place, first: FirstComment, earlier, last }`, `FirstComment { created_at, body }`.
  `first` is the starter note (`earlier[0]`, else `last`): its `createdAt` as sent and its `bodyHtml` through
  `described_on(project, iid, …)` (RK60, RK66: no other reducer). D1's writer stays `(earlier[0] ?? last).author`.
- **Why in `OpenDiscussion`.** `open_discussion` is the one builder (§0), so the box, a reload and the thread get the same
  field and `threadRead` (`ui/mergeRequestDiscussionRows.ts` `threadRead`) keeps replacing an entry's discussion whole.
- **Offers.** `read_discussions` collects, in order, each discussion's `last.page` and its first comment's link pages, and
  every upload the first comments name, each once (`Offers`); `ReadDiscussions { rows, pictures, pages, uploads }`. The
  shell offers `pages` and `pictures` (`offer`) and `uploads` (`offer_uploads`) before returning the rows, so a link in a
  first comment opens (RK41) and its image loads (RK53). `comments_of` in the thread read moves onto the same `Offers`
  (clean cutover; one dedupe rule).
- **Cost on GitLab: none.** `bodyHtml` is already in the query since #179 (the measured 19.7 s → 23.5 s, §0).
- **Cost in yamt:** one `described_on` per open discussion more, and one `Description` per discussion in the IPC reply
  `[INFERENCE: bounded by the first notes' share of what GitLab sends; small next to glab's seconds]`. The Rust slice
  measures the fake batch's reply bytes before and after and reports them.
- **Images.** Offering is a map insert (`pictures.rs:66-72`); a fetch happens only when an `<img>` asks, lazily, ≤ 4 at
  once (§0). A collapsed entry cuts its image at four lines, but the browser may still fetch it once it is near the
  viewport `[INFERENCE]`.
- **Later commenters.** The pictures row needs only their order and authors: `[...earlier.slice(1), last]` when `earlier`
  is non-empty, else none (core `laterWriters`). Their times are not needed (D3 names the writer only).
- **Reopens #162/#179** (what the read keeps per note): the starter's described body and time are kept too.

### 2.2 Several expanded threads — "To be measured" item 2

`ui/mergeRequestThread.ts` keeps its types (`ShownThread`, `ThreadLoad`, `Sending`, `Thread`) and becomes a keyed owner:

- `threads: ReadonlyMap<DiscussionId, Thread>` holds a record exactly while the box's panel or the view shows it. The
  panel's discussion is private (`panel`); `thread` is the derived panel thread (`Readonly<Ref<Thread | null>>`, so every
  reader of today's `thread` — the box, `panelRow`, `refreshDiscussions` — reads it unchanged).
- `expanded: ReadonlySet<DiscussionId>` is the view's expanded entries; `expandThread(iid, id)` creates a `loading` record
  and reads it afresh (E3) unless already expanded; `collapseThread(id)` drops the record unless the panel shows it; the
  reply text stays (`replyTexts`, E4).
- **Read tokens.** A private `Map<DiscussionId, number>` replaces the window-wide `generation`: every show, expand, retry
  and re-read takes a new token for that discussion; an answer patches its record only while the record exists and the
  token is still that discussion's latest. The queue's `threadRead` still gets every `read` answer (today's "the box
  alone").
- **One write at a time (E4, C8).** `writing` stays the window's one lock and becomes public; `Thread.sending` is that
  record's own write (`sending` | `failed`); a field and the Submit button are writable when the record is read, not
  refreshing, and `writing === null` (`isWritable(thread, writing)`, exported, the one rule both hosts use). The trick of
  marking every newly shown thread `sending` (`show`, `:140`) goes.
- **Actions by discussion.** `sendReply(discussion, kind)`, `setResolved(discussion, resolve)`, `submitReview(discussion)`,
  `showPreview(discussion)`, `showWrite(discussion)`, `retryThread(discussion)`. `showThread`/`closeThread` keep their
  meaning for the panel. `refreshed(iid | null, asked?)` re-reads every record of `iid` (all for null).
- **The box's panel is unchanged:** it shows one discussion, replaces it on another Shift, closes with its box. The page
  never shows the panel and the view together (the view replaces the row list, so every discussions box unmounts and its
  `onBeforeUnmount` closes the panel, `MergeRequestDiscussions.vue:139-143`); should both ever show one discussion, they
  share its one record and text by construction.

### 2.3 The thread body reused inline — "To be measured" item 3

`MergeRequestThread.vue` splits along its placement:

- **`MergeRequestThread.vue` (the shell, beside the box):** `role="dialog"`, `fixed`, `useBesidePlacement`, the window
  Escape listener, focus on mount, the header (place, Resolved or turn, `MergeRequestThreadButtons`, Close).
- **`MergeRequestThreadBody.vue` (both hosts):** props `{ thread: Thread; author: string | null; now: number; placement:
  "beside" | "inline" }`; the comments (`MergeRequestThreadComment`), the pending drafts, "Loading…", the refusal with
  Retry, then `MergeRequestReplyField`. `beside`: the comments scroll in a `flex-1` area and the field sits at the bottom
  (today's layout); `inline`: natural height, no inner scroll. Emits `cancel` (the field's Escape) and `focusHost`.
- **`MergeRequestThreadButtons.vue` (both hosts):** Open on GitLab (the first comment's page) and Submit review with the
  merge request's pending count, disabled unless `isWritable`.
- **`MergeRequestReplyField.vue`:** passes `thread.shown.discussion` to every action; its emits are renamed `cancel` and
  `focusHost` (clean cutover, both hosts).
- Inline, the field's Escape (E5) focuses the entry's chevron and never collapses; beside, it closes the panel as today.

### 2.4 The five groups, held entries and the pictures row in the core — "To be measured" item 4

`mergeRequests/internal/personDiscussions.ts`, framework-free and self-contained (PM3):

- `personGroupOf(discussion, person, row)`: `"turn"` when `turnOf(discussion, person, row.author?.username ?? null)` is
  `viewer` (request-mr-threads B2 with the person as the viewer); else `"started"` when `starterOf` is the person; else
  `"wrote"` when `wroteIn`; else `"reviewer"` when `row.reviewers` names the person; else `"other"`. A null person (no
  login) is never 1–4. `starterOf` and `wroteIn` are exported from `discussions.ts` internally (not from `index.ts`), never
  copied.
- `personEntries(listed, person)`: every discussion of every listed row, each with its group and turn, ordered by group
  (C2), then newest `last.createdAt` first; equal keys keep the input order (rows in the list's shown order, GitLab's order
  inside a row).
- `keptInPlace(previous, next, held, keyOf)` (`internal/keptInPlace.ts`): today's `ui/mergeRequestsShown.ts` function made
  generic; the rows (by iid) and the entries (by discussion id) are its two users.
- `laterWriters(discussion)`, `foldedWriters(writers, fits)` → `{ folded: number; shown: readonly P[] }`: all when they
  fit; else the newest `fits − 1` with the `+N` chip taking the first slot (`N = count − (fits − 1)`), so the newest stay
  visible (D4). `fits` comes from the row's measured width.
- `personLines(people, me, chosen)`: "Me" first (when logged in), then everyone else by display name, each with its
  person, `chosen` marked; the menu's people are `peopleOnRow` of the listed rows plus every writer of their read
  discussions, each username once (B2). `narrowed` becomes generic over `{ readonly label: string }`, so
  `MergeRequestMenu` takes these lines without a fake count.

### 2.5 Loading every listed row — "To be measured" item 5

- **Through the one queue (plan #164).** `wantRows(iids)`: each iid without an entry gets `loading` and is queued, whatever
  the setting; an iid the queue dropped from a "lazy" switch (`unhovered`) is kept rather than asked again.
  `retryRows(iids)`: a `refused`/`failed` entry is asked again; a read entry whose reload failed is reloaded.
  `reloadRows(iids, askFirst)`: every entry stays until its answer (C4), as `reloadDiscussions` does per row.
  `viewLeft()`: with a setting other than "full", the queued iids not yet sent lose their `loading` entries (no call after
  Back); read entries stay until a refresh or a switch to "Off" drops them as today. `reloadDiscussions` under "off"
  reloads a row that has an entry (the view's, after a Submit review); one without stays refused.
- **The view's demand** is a `watch` in `ui/mergeRequestPersonView.ts`: while the view is open, every shown row with
  `openDiscussions > 0` and no entry is wanted. So a list page arriving, a filter change, or a switch to "Off" (which
  drops every entry) asks again for exactly the missing rows.
- **Per setting:** "Load fully" — usually nothing to ask (`listed` asked already); "Load lazily" — every row not hovered
  yet; "Off" — every row. Outside the view each setting behaves as today (the boxes under "Off" stay counts only,
  `MergeRequestDiscussions.vue` `boxed`).
- **Time** (one call at a time, 10 rows per call): the fixture's 27 rows with discussions are 3 calls × 400 ms
  (`fixtureMergeRequestDiscussions.ts:31-32`). On a big project each call took 12.2–23.5 s (§0), so 27 busy rows take
  about 37–70 s and 100 rows about 2–4 min `[INFERENCE: calls × measured per-call times]`; a batch past 20 s fails its 10
  rows, named by F2 with Retry.
- **Progress (F1).** `loading = { answered, asked }` over the shown rows with `openDiscussions > 0`: "Loading discussions —
  12 of 27 merge requests" while `answered < asked`; entries show as rows arrive (`personEntries` over the read ones).

### 2.6 The view

- **Place (A1).** The filter row stays; the "Discussions" button (Lucide `messages-square`, tooltip "Every open
  discussion, for one person", `aria-pressed`) sits in it after review mode; pressing it swaps the row list for the view.
  Pressing it again or "Back to list" swaps back. The list unmounts (so every box closes, §2.2); the page keeps the list's
  `scrollTop` in component state and restores it after the list renders again. Filters, search and review mode live in the
  slice and stay (`state.md:72-73`). Both windows host the page, so A2 needs nothing (`CompareApp.vue:96`,
  `RangeApp.vue:153`).
- **Header.** Back to list (Lucide `arrow-left`), the person menu opener (picture and name, "Me" for the viewer), the
  summary (`turnSummaryText` over the entries: "4 of 31 wait for Anna Berg"), or the loading sentence while loading, and
  the reload button (Lucide `refresh-cw`, "Reload discussions", spinning while any reload runs). Under it one line per
  failed row: "!615 Snooze a reminder — <`discussionsFailedText`>" and Retry.
- **Person (B1–B3).** Opening takes the slice's `viewer` (Me or review mode's reviewer). Picking another person reorders
  everything and empties the held set. Writes stay the logged-in user's (#185).
- **Entry (D1–D4), collapsed:** chevron; the starter's picture and name, "3 hours ago" (`agoText`; `dateTimeText` on
  hover), `!640` and the title muted, the place (`placeText`); the first comment's blocks (`MergeRequestDescriptionBlocks`)
  cut at four lines (`max-h` of four line heights, `overflow-hidden`); the writers row (`MergeRequestWriters.vue`, pictures
  oldest left, each with its writer's name as tooltip, `+N` first when folded, its tooltip naming the folded writers
  oldest first) and right of it the turn word ("Your turn", "<Name>'s turn", "Open"; "Resolved" with a check once resolved
  here, C3).
- **Entry, expanded (E3):** the head (turn word or Resolved at its right), `MergeRequestThreadButtons`, then
  `MergeRequestThreadBody placement="inline"`; the clamp and the writers row hide (the body shows every comment).
- **Keys (E1, E2, E5).** One `useShiftTaps` watch in the view: the entry under the pointer, else the focused one (focus
  anywhere inside it), expands; an expanded one: nothing; never while `isTypingTarget`. The chevron is a button
  (`aria-expanded`, Enter/Space native). Escape in a reply field focuses the chevron. The person menu has its own
  `useHoverMenu` and Escape listener (prevented); no Escape leaves the page (#189 C).
- **Held (C3).** Held = every entry expanded since the view opened, was refreshed or a person was picked; the order is
  `keptInPlace(previous, next, held)`. Writes happen only in expanded entries, so "answered or resolved from the view" is
  inside it. Leaving collapses every entry, calls `boxClosed(iid)` for each row with resolved marks (they leave the entry
  and the row's count, as closing a box does) and empties the held set.
- **Refresh (C4).** `refreshPersonView()`: one `askGitLabAgain`, then `reloadRows` of every shown row with an entry or a
  count, then every shown thread read again (`refreshed(null)`); the held set becomes the expanded entries, so the other
  entries take their new places as the answers land.

### 2.7 Fixtures — "To be measured" item 6

- `openDiscussion` (fixture) fills `first` from `comments[0]` (`createdAt`, `body`), so every script gets it.
- **Person cases** (`fixtureMergeRequestTurnCases.ts`, beside `THREADS_CASES`) on free rows (§0) — defaults !626, !620,
  !611 for the short cases and !621 for the long one; the ipc slice confirms in `fixtureRows` that no case row is authored
  by sam or anna (an author's discussions are all the author's turn, B2), that sam reviews one of them and anna another
  (else picks other free rows with those properties), and sets their counts in `OPEN_DISCUSSIONS`; no case mentions sam
  or anna:
  - `p1` anna → ben → chiara → dmitri; anna's first comment formatted (bold, inline code, a link, a 160 px image, six
    lines, so the clamp cuts). Anna: turn. Me: reviewer or other.
  - `p2` sam → anna. Me: turn. Anna: wrote (she wrote last).
  - `p3` anna → ben → anna. Anna: started. Me: reviewer or other.
  - `p4` sam → chiara → sam. Me: started.
  - `p5` ben → chiara → sam. Me: wrote. Anna: reviewer or other.
  - `p6` (!621) fourteen comments among ben, chiara, dmitri, anna and a deleted user, ending with chiara: the `+N` fold.
  - `p7` dmitri → chiara. Me and Anna: reviewer or other.
- The rows' other discussions and every scripted row named in §0 stay as they are, so the review orders, the threads
  smoke and the mentions smoke keep their expectations; the state slice pins Me's and Anna's view orders over this
  fixture in a test the verifier reads.

### 2.8 Decisions taken (the owner asked for no further questions; user experience first, then security; proposed #194)

Each decision below is final for this feature; the orchestrator records them as #194.

1. **The filter row stays visible in the view**; only the row list is swapped. Filters and search narrow the view live
   (C1 "its filters and search applied"), and the Discussions button sits where the user pressed it. The button is
   `aria-pressed` and toggles back, like "Back to list".
2. **The page header (Back to the files, the list's age, Refresh) stays** above the view: it is the page's, not the list's.
   A list Refresh keeps the view open; the view then loads again (F1) with its progress line.
3. **Back restores the list's scroll** from a `scrollTop` the page keeps while the view shows (the list unmounts, so
   every box and the panel close cleanly and no hidden list keeps hover listeners).
4. **Held entries** = every entry expanded since the view opened, was reloaded or a person was picked. It contains C3's
   "answered or resolved from the view" (writes happen only in expanded entries) and never makes an entry jump on
   collapse.
5. **Picking a person re-sorts everything** (the held set empties; expanded entries stay expanded and are held again).
6. **The person menu** reuses the page's narrow-box menu: the box appears from 8 lines (`NARROW_FROM`, the page's rule),
   lines show picture and name, no counts (B2 asks none; a count would be a second meaning of `Choice.count`).
7. **The writers row's `+N`** has a tooltip naming the folded writers oldest first; a deleted writer shows the "someone"
   picture (`MergeRequestPicture` with null) and "Someone" as its name (`noteAuthorName`).
8. **The collapsed first comment** is cut at four line heights (`max-h`, `overflow-hidden`), images included; links in it
   open in the browser as everywhere (RK41).
9. **An expanded entry** hides its clamp and writers row (the body shows every comment); its turn word or "Resolved"
   moves to the head's right.
10. **The view's "Reload discussions"** asks GitLab again once, reloads every listed row's discussions and re-reads every
    expanded thread; entries stay while it loads (C4).
11. **Leaving under "Load lazily"/"Off"** stops the asks not yet sent and keeps what was read until a refresh or a switch to
    "Off" (a second opening is immediate; nothing more is asked of GitLab after Back).
12. **Failures:** one line per failed merge request (`!615 <title> — <GitLab's reason>`) with its own Retry, under the
    header; a row whose reload failed shows its line too and keeps its entries.
13. **Escape in an inline reply field** focuses the entry's chevron; Shift over or on an entry expands only (never
    collapses, never while typing); the chevron is the only collapse.
14. **Security:** the first comment goes through the description reducer in Rust only (RK60, RK66); its pages and uploads
    are offered by the shell before the rows reach the window (RK41, RK53); every write stays the logged-in user's (#185),
    whoever is picked.

## 3. Decision record (proposed rows; the orchestrator records them, DR5)

**#193 — One person's discussions: the page's view over the one queue, the core's five groups, several threads in the one
thread owner, the first comment in the discussions read** (owner 2026-11-05; request
`docs/slices/request-mr-person-discussions.md` A1–F2; owner's answers 2026-11-05: every open discussion, load whatever the
setting, a chevron on every entry; design `briefs/mr-person-discussions-design.md` option A; reopens `state.md:89` and
#183's "one shown thread", request-mr-threads C1–C2 (the thread shows in the view's entries too), #162/#179 (the read keeps
the starter's described body and time); amends #164 (rows are asked whatever the setting while the view is open), #189
(held entries, `keptInPlace` shared), RK61).

- Rust: `OpenDiscussion.first: FirstComment { createdAt, body: Description }` by `open_discussion` through `described_on`;
  `ReadDiscussions.pages`/`uploads` offered before the rows; `Offers` the one collector (discussions and thread reads).
- Threads: `threads` by `DiscussionId`, `expanded`, the panel's `thread` derived, a read token per discussion, `writing`
  public and window-wide, every action by discussion; the body shared by the panel and the entry.
- Core: `PersonGroup` turn → started → wrote → reviewer → other, newest last comment first, ties in list order;
  `keptInPlace` generic; `laterWriters`/`foldedWriters`; `personLines`.
- Queue: `wantRows`, `retryRows`, `reloadRows`, `viewLeft`; `reloadDiscussions` under "off" for a row with an entry.

Rejected: B (per-entry thread objects: two owners, a registry that is the map again); C (first comment by thread reads:
~2–4 glab runs per entry for text the first read already sent, a second load path, #183); the starter's raw text (D2's
formatting, RK60); a `Screen` kind for the view (the page's filters and scroll belong to the page).

Visions 1, 2, 4, 5.

**#194 — Defaults decided with the person-discussions design** (orchestrator, OR13; the owner may veto): §2.8.

**Risk register:**

- **RK61 (amend).** "details asked while the setting is 'Off'" adds "— except the person view's, while it is open".
  Owner adds `ui/mergeRequestPersonView.ts` (the want watch) and the queue's `wantRows`/`viewLeft`. Proving tests add
  `the_view_asks_every_missing_row_under_each_setting`, `leaving_under_lazy_or_off_sends_nothing_more`.
- **RK77 (new).** **Risk:** the person view puts a discussion in the wrong group or order (the person's turn not first, a
  reviewer group for a non-reviewer, newest first broken), moves an expanded or answered entry before a refresh or a
  person pick, keeps a resolved one after Back, or shows the writers in the wrong order or folds the newest. **Owner:** core
  `personDiscussions.ts`, `keptInPlace.ts`; `ui/mergeRequestPersonView.ts`. **Proving:** the core tests by group name, the
  held test, `the_fold_keeps_the_newest_writers`, the WebKit Me → Anna step.
- **RK78 (new).** **Risk:** with several threads shown, an answer lands in another discussion's record, a write goes to a
  discussion other than the one pressed, two writes run at once, a collapsed entry's late answer brings it back, or an
  expansion changes the box's panel. **Owner:** `ui/mergeRequestThread.ts`. **Proving:**
  `two_expanded_threads_read_and_write_apart`, `one_write_at_a_time_across_threads`,
  `a_collapsed_threads_late_answer_is_dropped`, `an_expansion_leaves_the_panel_alone`.
- **RK41, RK53 (owners amended):** the discussions read offers its first comments' pages and uploads (`Offers`,
  `discussions_reply`). Proving: the shell test `a_first_comments_link_and_upload_are_offered_before_the_reply`.
- RK60, RK66, RK72, RK73 unchanged; the briefs name them.

**Docs keeper (once, after `mr-person-discussions-view`):**

- `skill://project-map` `tree.md`: core `personDiscussions.ts`, `keptInPlace.ts`; `ui/mergeRequestPersonView.ts`,
  `MergeRequestPersonView.vue`, `MergeRequestPersonEntry.vue`, `MergeRequestPersonMenu.vue`, `MergeRequestWriters.vue`,
  `MergeRequestThreadBody.vue`, `MergeRequestThreadButtons.vue` (`just map-check`, PM6).
- `state.md`: rows 87–90 (wanted rows; `threads`, `expanded`, `writing`, the panel's derived `thread`), a new row for the
  person view (`personView`, owner `ui/mergeRequestPersonView.ts`), row 81's `panelRow`.
- `docs/architecture.md` §3.9 (Open discussions: `first`, offers), §4 (the IPC types), §5.4 (the view, the split panel).
- `ui/AGENTS.md`, `CHANGELOG.md`; the plan rows and risk rows above.

## 4. Slices (option A)

| slice     | owns (summary)                                                                                                                                     | needs                              | wires           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------- |
| `rust`    | crate discussions read, `Offers`, thread read's `comments_of`, `lib.rs`, crate tests, two fake-glab files, the shell's `discussions.rs` + its test | —                                  | —               |
| `core`    | core `personDiscussions.ts`, `keptInPlace.ts`, `discussions.ts` exports, `choices.ts` `narrowed`, `index.ts`, `AGENTS.md`                          | —                                  | —               |
| `threads` | `mergeRequestThread.ts` + test, the panel split (three components), the reply field, the panel and box SSR tests, the box                          | —                                  | (box unchanged) |
| —         | orchestrator: `just bindings` after `rust`                                                                                                         | rust                               | —               |
| `ipc`     | `discussionDomain.ts`, the four fixture files, ipc tests, `ipc/AGENTS.md`; `first` in three ui tests' hand-built discussions (line-scoped)         | rust, bindings, threads committed  | —               |
| `state`   | queue additions, `mergeRequestPersonView.ts`, the slice, `mergeRequestsShown.ts`, `mergeRequestsRefresh.ts`, their tests                           | core, threads, ipc                 | —               |
| `view`    | `MergeRequestsView.vue` and the five view components, `MergeRequestMenu.vue`, `mergeRequestsText.ts`, SSR tests                                    | state                              | **the window**  |
| `verify`  | read-only                                                                                                                                          | smoke after view; final after docs | —               |

`rust`, `core` and `threads` run in parallel (round 1). `ipc` follows `rust` + bindings and `threads` (it edits one line
of `mergeRequestThread.test.ts` after `threads` lands). `state` follows `ipc` (it then owns the two ui test files whose
hand-built discussions `ipc` extended), `view` follows `state`, then the docs keeper and `verify`.

## 5. Consequences the owner will notice

- With "Load lazily" or "Off", the first opening of the view on a big project reads every listed merge request's
  discussions: on gitlab-org-sized merge requests about a minute per 30 rows, and some batches may fail on glab's 20 s
  deadline (each named with Retry). Back keeps what was read, so the second opening is immediate until a refresh.
- A list Refresh while the view is open reloads every row's discussions and every expanded thread.
- The box's thread panel and the view never show at once: opening the view closes any open discussions box.
