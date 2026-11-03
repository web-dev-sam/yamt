# Slice mr-discussions-state — the source call, the setting in the window, the one queue, the fixture's discussions

Feature: whose turn it is, per open discussion. Sources:
- Request `docs/slices/request-mr-discussions.md`: rules 2, 6, 7, 8.
- Design `docs/slices/briefs/mr-discussions-design.md` option A, §1.5–1.7, §1.10.
- Proposed plan §2 #162, #164; proposed RK61.

Needs `mr-discussions-rust` landed and `just bindings` run, which brings `Generated.RowDiscussions`,
`DiscussionsAnswer`, `OpenDiscussion`, `DiscussionPlace`, `DiscussionNote`, `DiscussionDetails`,
`StoredSettings.discussionDetails`, `commands.readDiscussions` and `commands.setDiscussionDetails`. Until this slice
lands, the typecheck fails on `StoredSettings` literals (design "Shared edits"). It runs beside `mr-discussions-core`
if that one is still running; this slice does not use the core.

## Target

**Owned** (27 files; five of them, marked ¹, gain one `setDiscussionDetails: notUsed` line only):
- `frontend/src/ipc/`:
  - Sources and domain: `MergeRequestSource.ts`, `mergeRequestDomain.ts`, `domain.ts`, `index.ts`, `ChunkSource.ts`.
  - Tauri: `tauriMergeRequests.ts`, `tauriMergeRequests.test.ts`, `tauri.ts`, `tauri.test.ts`.
  - Fixtures: `fixtureMergeRequests.ts`, `fixtureMergeRequests.test.ts`, `fixtureMergeRequestDiscussions.ts` (new),
    `fixtureMergeRequestDiscussions.test.ts` (new), `fixtureSettings.ts`, `fixtureSettings.test.ts`.
- `frontend/src/ui/`:
  - Settings: `settings.ts`, `settings.test.ts`.
  - The merge-request slice: `mergeRequestDiscussions.ts` (new), `mergeRequestDiscussions.test.ts` (new),
    `mergeRequests.ts`, `mergeRequests.test.ts`, `mergeRequestsStore.ts`.
  - Literals only: `store.test.ts` (its `StoredSettings` literals gain `discussionDetails: "full"`), `listing.test.ts`¹,
    `saving.test.ts`¹, `stops.test.ts`¹, `diskChanges.test.ts`¹, and the settings source literal in
    `settings.test.ts`¹.

**Read-only:** everything else.
- `frontend/src/ipc/bindings.ts` (generated, PM4).
- `frontend/src/mergeRequests/**` (the core's).
- `ui/settingsStore.ts` and its test (the page slice's), every `.vue`, `ui/mergeRequestsText.ts`, `ui/problem.ts`,
  `ui/problemText.ts`.
- `ui/compareStore.ts`, `ui/rangeStore.ts`: they already pass `refs` holding `settings` to `windowMergeRequests`
  (`compareStore.ts:127`, `rangeStore.ts:180`).
- `ui/mergeRequestJobLogs.ts` (the pattern).
- `ipc/AGENTS.md`, `ui/AGENTS.md`, `docs/**`: put their lines in `deviations_from_brief`.

**Non-goals:**
- Any rendering, words or the Settings choice (page).
- Turns and order (core).
- Retrying failed rows before a refresh (#164).
- Review mode.
- Reporting to the problem bar (rule 7: the box says why).

## Contract

**Domain and source** (`ipc/domain.ts` beside `Antialiasing`; `ipc/mergeRequestDomain.ts`; all exported from
`ipc/index.ts`):

```ts
export type DiscussionDetails = Generated.DiscussionDetails;              // "full" | "lazy" | "off" — domain.ts
export type DiscussionPlace = Readonly<Generated.DiscussionPlace>;
export type DiscussionNote = {
  readonly author: Person | null;
  readonly createdAt: number;        // ms, Date.parse of GitLab's time (toTime)
  readonly text: string;
  readonly page: WebPage | null;     // toWebPage
};
export type OpenDiscussion = { readonly place: DiscussionPlace; readonly last: DiscussionNote };
export type DiscussionsAnswer =
  | { readonly kind: "open"; readonly discussions: readonly OpenDiscussion[] }
  | Readonly<Exclude<Generated.DiscussionsAnswer, { kind: "open" }>>;
export type RowDiscussions = { readonly iid: MergeRequestIid; readonly answer: DiscussionsAnswer };
export function toRowDiscussions(
  raw: Generated.RowDiscussions,
  index: number,
  uploadedPicture: (username: string) => string,
): RowDiscussions;   // throws on a bad iid, time or page as toRow does (mergeRequestDomain.ts:119-139)

// MergeRequestSource, beside readJobLog
/** The open discussions of the first rows of `iids` (at most Rust's DISCUSSION_BATCH), in their order, each once: a
 *  non-empty answer for a non-empty ask; ask again for the rest (plan §2 row 162). */
readDiscussions(iids: readonly MergeRequestIid[]): Promise<SourceResult<readonly RowDiscussions[]>>;
// ChunkSource and the SettingsSource Pick, beside setAntialiasing
setDiscussionDetails(current: StoredSettings, details: DiscussionDetails): Promise<SourceResult<SettingsRead>>;
```

`tauriMergeRequests.ts`: `converted(toResult(await commands.readDiscussions([...iids])), (rows) => rows.map((row, at)
=> toRowDiscussions(row, at, uploadedPicture)))`. `tauri.ts` `createTauriSettings`: `setDiscussionDetails` as
`setAntialiasing`.

**Settings in use** (`ui/settings.ts`):
- `SettingsInUse.discussionDetails: DiscussionDetails`, starting `"full"` in `startSettings`.
- It is sent back in `storedSettings`, compared in `sameStored` (the `rest satisfies Record<string, never>` guard
  keeps the destructuring complete), adopted in `adopt`.
- `SettingsActions.setDiscussionDetails(details): Promise<void>`, sent as `setAntialiasing` is.

**The queue** (`ui/mergeRequestDiscussions.ts`; `MergeRequests` becomes `RowActions & Rerequests & JobLogs &
Discussions & Shown & {…}`):

```ts
export type DiscussionLoad =
  | { readonly kind: "loading" }                                   // queued or asked
  | { readonly kind: "read"; readonly discussions: readonly OpenDiscussion[] }
  | { readonly kind: "refused"; readonly answer: Exclude<DiscussionsAnswer, { readonly kind: "open" }> }
  | { readonly kind: "failed"; readonly cause: ProblemCause };    // the source call failed
export type Discussions = {
  /** Each asked row's discussions while this list stands; no entry: not asked, or (count 0) none open. */
  readonly discussions: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, DiscussionLoad>>>;
  /** Settings' "Discussion details" in use. */
  readonly discussionDetails: ComputedRef<DiscussionDetails>;
  /** A count's box opened: with "lazy", asks this row first unless it has an entry; else nothing. */
  askDiscussions(iid: MergeRequestIid): void;
};
export function createDiscussions(deps: {
  readonly source: MergeRequestSource;
  readonly mode: () => DiscussionDetails;
  readonly rows: () => readonly MergeRequestRow[];
}): Discussions & {
  /** Rows the list now shows: with "full", queues each with `openDiscussions > 0` and no entry. */
  listed(rows: readonly MergeRequestRow[]): void;
  /** A refresh replaced the rows: every entry, the queue and any answer in flight dropped; then `listed(rows)`. */
  replaced(rows: readonly MergeRequestRow[]): void;
};
```

`createMergeRequests`'s `Deps` gains `readonly discussionDetails: () => DiscussionDetails`. `windowMergeRequests`'s
`WindowRefs` gains `readonly settings: Readonly<ShallowRef<{ readonly discussionDetails: DiscussionDetails }>>` and
passes `() => refs.settings.value.discussionDetails`.

Rules (design §1.6, §1.7):
1. **One call at a time.** It sends the whole queue in order. Each answered row gets `read { discussions }` or
   `refused { answer }`, and its iid leaves the queue. Then the queue is sent again while it is not empty. A source
   failure gives every asked row `failed { cause }` and they leave the queue.
2. **Generation.** `replaced`, and a switch to `"off"`, start a new generation. An answer from an older generation
   is dropped whole, and the queue goes on with the current one.
3. **Full.**
   - `mergeRequests.ts` `received` calls `listed(rows of the page)` for a load that is not buffered.
   - `ended` calls `replaced(state.rows.value)` where a buffered load swaps its rows in (`mergeRequests.ts:102-106`).
   - A switch to `"full"` (a `watch` on `mode`) calls `listed(rows())`. Rows already `refused` or `failed` stay until
     the next refresh (#164).
4. **Lazy.** `askDiscussions(iid)` with no entry: `loading`, put **first** in the queue, send. An entry of any kind:
   nothing (a second hover asks nothing). A switch to `"lazy"` drops the queued, unsent asks and their `loading`
   entries; an answer in flight is kept.
5. **Off.** A switch to `"off"` drops every entry and the queue. `askDiscussions` and `listed` ask nothing.
6. **Log.** One `log.info("mergeRequests.discussions_read", { asked, answered, refused, ms })` per settled call
   (`failed` instead of the counts for a source failure). Never a name, a text or an address (RK57's rule).

**Fixture** (`ipc/fixtureMergeRequestDiscussions.ts`). `createFixtureMergeRequests` gains `readDiscussions(iids)`:
`log.info("mergeRequests.fixture_discussions", { iids })`, then `pause(DISCUSSIONS_PAUSE_MS)` (400), then it answers
the first `FIXTURE_ANSWERED` (10) iids through `toRowDiscussions(…, fixtureUploadedPicture)`. That makes the fixture
answer prefixes as Rust does.

```ts
/** The fixture's answer for `iid` among the listed rows (`fixtureRows(0, 500)`, every script's rows). */
export function fixtureDiscussions(iid: number): Generated.DiscussionsAnswer;
export const DISCUSSIONS_FAILED_IID: number;     // a row with open discussions → failed { message: "glab timed out" }
export const DISCUSSIONS_LOGGED_OUT_IID: number; // another → notLoggedIn { detail: LOGGED_OUT_DETAIL }
```

- **Where the discussions come from.** A row with `openDiscussions` k (k = index % 3,
  `fixtureMergeRequestData.ts:221`) gets k open discussions; an iid no row has → `failed { message: "GitLab sent no
  merge request !<iid>" }`.
- **Discussion 0:**
  - Last author: `PEOPLE[(index + 2) % PEOPLE.length]`, so some rows' last author is `sam` (`FIXTURE_ME`).
  - Place: Overview on even indexes; on odd ones `file` `src/board/card.ts`, line `10 + index`.
  - Time: one hour after the row's `createdAt`.
- **Discussion 1** (k = 2): last author `sam`, three hours after; place `file` `src/board/column.ts` with `line:
  null`.
- **Mixed headers.** Rows of k = 2 whose discussion 0 is not sam's have one discussion of each turn, the newer one
  sam's. Some rows hold only sam's ("0 of 2 wait for you"). The turn order then beats the time order.
- **Texts.**
  - Every 4th discussion holds `Please RENAME this.\n**not bold** <b>not bold</b> &amp; <script>x</script>\nThird
    line\nA fourth line the box leaves out`.
  - One holds a 400-character single line.
  - The others hold a short line.
- **Pages.** `${ORIGIN}/-/merge_requests/<iid>#note_<7000 + 10·index + k>`, except one discussion per 6 rows with
  `page: null`.
- **The palette fence.** No string contains `#` followed by 3, 4, 6 or 8 hex digits (`frontend/scripts/palette.ts`).
  `#note_` digits follow `_`, so they pass.

## Change

1. Domain types, `toRowDiscussions`, exports. Source method, tauri method and test. Settings source method on
   `ChunkSource`, `tauri.ts` and `fixtureSettings.ts` (its `copied` and a setter), with tests. The one-line literals.
2. `fixtureMergeRequestDiscussions.ts` and test. The fixture source's `readDiscussions` and test.
3. `ui/settings.ts` and test.
4. `ui/mergeRequestDiscussions.ts` and test. Wire it into `mergeRequests.ts` (`received`, `ended`, the spread) and
   `mergeRequestsStore.ts`. `mergeRequests.test.ts`: its `MergeRequestSource` literal (`:147-176`) gains
   `readDiscussions`, its rig a mode ref.

## Acceptance

**Vitest** (`pnpm -C frontend test -- src/ui src/ipc`), each test named for the bug it catches, at least:

- `mergeRequestDiscussions.test.ts`:
  - `full_queues_each_page_with_open_discussions_as_it_arrives` (count-0 rows never asked)
  - `a_prefix_answer_sends_the_rest_until_the_queue_is_empty`
  - `one_call_runs_at_a_time`
  - `the_refresh_swap_drops_every_entry_and_asks_again` (old entries gone; an old answer arriving after the swap is
    dropped)
  - `lazy_asks_the_hovered_row_first_and_once`
  - `lazy_never_asks_unhovered_rows`
  - `off_asks_nothing_and_drops_an_answer_in_flight` (RK61)
  - `switching_to_full_asks_what_is_missing_without_a_reload`
  - `switching_to_lazy_drops_unsent_asks_and_keeps_what_was_read`
  - `a_refused_answer_is_kept_per_row`
  - `a_source_failure_is_kept_per_asked_row_not_reported`
  - `the_log_event_never_carries_text_or_names`
- `settings.test.ts`:
  - `before_any_read_the_discussion_details_are_full_and_sent_so`
  - `setDiscussionDetails_sends_the_settings_in_use_and_adopts_the_reply`
  - `a_failed_setDiscussionDetails_is_a_settings_problem_and_keeps_the_settings`
  - `a_load_whose_only_difference_is_the_discussion_details_is_adopted`
- `mergeRequests.test.ts`:
  - `a_buffered_refresh_replaces_details_only_at_its_swap`
  - `the_window_setting_drives_the_slice` (through `windowMergeRequests` with a settings ref)
- `fixtureMergeRequestDiscussions.test.ts`:
  - `every_listed_row_with_open_discussions_has_that_many`
  - `both_turns_occur_for_sam_and_some_rows_wait_only`
  - `the_markup_text_and_a_pageless_discussion_exist`
  - `the_scripted_rows_refuse_as_named`
  - `an_unlisted_iid_fails`
- `fixtureMergeRequests.test.ts`: `discussions_answer_a_prefix_of_ten_after_400_ms_and_log_the_ask` (fake timers).
- `fixtureSettings.test.ts`: `setDiscussionDetails_replaces_the_value_keeps_the_rest_and_the_next_load_reads_it`.
- `tauriMergeRequests.test.ts`: `readDiscussions_calls_the_command_with_the_iids_and_converts_each_row` (a time, an
  uploaded author, a page); `readDiscussions` in the "a %s failure comes back unchanged" table.
- `tauri.test.ts`: `setDiscussionDetails sends the settings in use and the value, and returns the read or the error`.

**Commands:**
- `pnpm -C frontend lint`, `typecheck` (clean), `test` (palette fence green on the new fixture): summary lines.
- `just map-check`: its expected findings are only the new names the docs keeper adds (paste them).
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://ipc-contract`, `skill://comment-policy`, `skill://risk-register` (proposed RK61),
`skill://verification`.
