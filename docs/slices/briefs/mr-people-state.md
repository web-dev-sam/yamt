# Slice mr-people-state — the source's search and change, the fixture's people, the window's search and queues

Feature: people on a merge request. Sources:

- Request `docs/slices/request-mr-people.md`: rules 2 (pause, latest answer only), 4 (one change at a time per merge
  request), 5 (the row follows GitLab's answer; filters count the new people), 6 (sentences until the box closes),
  8 (one person, one list), and the WebKit acceptance's fixture.
- Design `docs/slices/briefs/mr-people-design.md` option A, §1.3, §1.6–1.8; §5 question 3 answered by the owner
  (#2246, request rule 9): the row whose people box is open stays shown until the box closes.
- Proposed plan §2 #169, #170; RK64, RK65.

Runs after `mr-people-rust` (with the orchestrator's `just bindings`) and `mr-people-core` have landed.

## Target

**Owned:**

- `frontend/src/ipc/MergeRequestSource.ts`
- `frontend/src/ipc/mergeRequestDomain.ts`, `frontend/src/ipc/mergeRequestDomain.test.ts`
- `frontend/src/ipc/tauriMergeRequests.ts`, `frontend/src/ipc/tauriMergeRequests.test.ts`
- `frontend/src/ipc/fixtureMergeRequests.ts`, `frontend/src/ipc/fixtureMergeRequests.test.ts`
- `frontend/src/ipc/fixtureMergeRequestPeople.ts` (new), `frontend/src/ipc/fixtureMergeRequestPeople.test.ts` (new)
- `frontend/src/ipc/fixtureMergeRequestData.ts`, `frontend/src/ipc/fixtureMergeRequestData.test.ts`
- `frontend/src/ipc/index.ts`, `frontend/src/ipc/AGENTS.md`
- `frontend/src/ui/mergeRequestPeople.ts` (new), `frontend/src/ui/mergeRequestPeople.test.ts` (new)
- `frontend/src/ui/mergeRequests.ts`, `frontend/src/ui/mergeRequests.test.ts`
- `frontend/src/ui/problem.ts`, `frontend/src/ui/problemText.ts`, `frontend/src/ui/problemText.test.ts`
- `frontend/src/ui/mergeRequestsShown.ts` (rule 9 only)

**Read-only:** everything else.

- `ipc/bindings.ts` is generated (PM4).
- `mergeRequests/**` is the core's: use `searchedText` as contracted.
- `ui/mergeRequestRerequests.ts` keeps its `Deps.replaced(iid, reviewers)`. `mergeRequests.ts` adapts it.
- `ui/MergeRequest*.vue`, `ui/mergeRequestsText.ts` and `ui/AGENTS.md` are the page slice's: put `ui/` lines for
  `AGENTS.md` in `deviations_from_brief`.

**Non-goals:**

- Any component or word shown on the page, other than the two problem steps.
- Logging each change in the window: Rust logs it; the fixture logs its calls.
- Keeping the fixture's changes across a fixture refresh: a refresh shows the scripted rows again (design option A
  risks).

## Contract

Given (fixed): the Rust slice's generated `PeopleGroup`, `PeopleAction`, `PeopleChange`, `MergeRequestPeople`,
`PeopleSearchReply`, `PeopleChangeReply`, `commands.searchPeople(text)` and `commands.changePeople(iid, change)`; the
core's `searchedText`.

Fixed here (add-only beyond this):

```ts
// ipc/mergeRequestDomain.ts
export type PeopleGroup = Generated.PeopleGroup;
export type PeopleChange = Readonly<Generated.PeopleChange>;
export type MergeRequestPeople = { readonly assignees: readonly Person[]; readonly reviewers: readonly Reviewer[] };
export type PeopleSearchReply =
  | { readonly kind: "found"; readonly people: readonly Person[] }
  | Readonly<Exclude<Generated.PeopleSearchReply, { kind: "found" }>>;
export type PeopleChangeReply =
  | { readonly kind: "changed"; readonly people: MergeRequestPeople }
  | { readonly kind: "unchanged"; readonly people: MergeRequestPeople }
  | Readonly<Exclude<Generated.PeopleChangeReply, { kind: "changed" | "unchanged" }>>;
/** Each person's picture as toMergeRequestPage converts it (toPerson, toReviewers); other replies pass unchanged. */
export function toPeopleSearchReply(raw: Generated.PeopleSearchReply, uploadedPicture: UploadedPicture): PeopleSearchReply;
export function toPeopleChangeReply(raw: Generated.PeopleChangeReply, uploadedPicture: UploadedPicture): PeopleChangeReply;

// ipc/MergeRequestSource.ts — added
/** The project's people whose name, username or public email matches `text` (GitLab's autocomplete, ≤ 20, plan #169). */
searchPeople(text: string): Promise<SourceResult<PeopleSearchReply>>;
/** One person added to or removed from one list of merge request `iid`, against GitLab's list at that moment. */
changePeople(iid: MergeRequestIid, change: PeopleChange): Promise<SourceResult<PeopleChangeReply>>;

// ui/mergeRequestPeople.ts
export const SEARCH_PAUSE_MS = 250; // GitLab's DEFAULT_DEBOUNCE_AND_THROTTLE_MS (lib/utils/constants.js), design §1.1

export type PeopleSearch =
  | { readonly kind: "empty" }
  /** Asked or waiting for the pause; `people` are the last answer's, still shown ([] at first). */
  | { readonly kind: "searching"; readonly text: string; readonly people: readonly Person[] }
  | { readonly kind: "found"; readonly text: string; readonly people: readonly Person[] }
  | { readonly kind: "refused"; readonly text: string; readonly reply: Exclude<PeopleSearchReply, { kind: "found" }> }
  | { readonly kind: "failed"; readonly text: string; readonly cause: ProblemCause };

export type PeopleChangeFailure =
  | { readonly kind: "unchanged" }
  | { readonly kind: "refused"; readonly reply: Exclude<PeopleChangeReply, { kind: "changed" | "unchanged" }> }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type NotDone = { readonly change: PeopleChange; readonly why: PeopleChangeFailure };
/** One merge request's changes: `queue[0]` is the one GitLab is answering, the rest wait in order (rule 4);
 *  `notDone` the changes GitLab did not make, until the box closes (rule 6). */
export type RowPeopleAsks = { readonly queue: readonly PeopleChange[]; readonly notDone: readonly NotDone[] };

export type PeopleChanges = {
  readonly peopleSearch: Readonly<ShallowRef<PeopleSearch>>;
  readonly peopleAsks: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, RowPeopleAsks>>>;
  /** core searchedText(typed) "" → empty at once; else searching, asked SEARCH_PAUSE_MS after the last call. */
  searchPeople(typed: string): void;
  /** empty; a pending or running search's answer is dropped. */
  endPeopleSearch(): void;
  /** Queues `change` (an equal one already queued: nothing); settles when it is answered. */
  changePeople(iid: MergeRequestIid, change: PeopleChange): Promise<void>;
  /** Request rule 9 (owner #2246): the rows whose people box is open. */
  readonly openPeopleBoxes: Readonly<ShallowRef<ReadonlySet<MergeRequestIid>>>;
  /** The box of row `iid` opened: the row stays shown while it is open. */
  peopleBoxOpened(iid: MergeRequestIid): void;
  /** The box of row `iid` closed (or unmounted while open): the row is released and its notDone dropped; its
   *  queue stays. */
  peopleBoxClosed(iid: MergeRequestIid): void;
};
export function createPeopleChanges(deps: {
  readonly source: MergeRequestSource;
  readonly replaced: (iid: MergeRequestIid, people: MergeRequestPeople) => void;
}): PeopleChanges;

// ui/mergeRequests.ts
export type MergeRequests = /* today's */ & PeopleChanges;
export type { PeopleSearch, RowPeopleAsks, NotDone, PeopleChangeFailure } from "./mergeRequestPeople";
// one writer of a row's people after the list: rows and, while a buffered refresh runs, its buffer (as today's
// rerequestsOf.replaced, mergeRequests.ts:137-148, which now calls it with { reviewers })
function withPeople(state: State, iid: MergeRequestIid, people: Partial<MergeRequestPeople>): void;

// ui/problem.ts MergeRequestStep gains "searchPeople" | "changePeople" (box only, as "discussions"); problemText.ts:
//   searchPeople: "Could not search people", changePeople: "Could not change the merge request's people"
```

**Rules of `mergeRequestPeople.ts`:**

- **The pause and the latest answer.**
  - Every `searchPeople` and `endPeopleSearch` call cancels the pending timer and makes any answer in flight stale.
  - A search is sent only when its timer fires.
  - Its answer is written only when no `searchPeople` or `endPeopleSearch` call came after it was sent (RK65).
  - So at most one answer is ever shown, the newest text's.
- **A thrown search** (`attempt` not ok) → `failed { text, cause }`. It is never reported to the problem bar (rule 6:
  in the box).
- **Queueing a change.**
  - An equal change (same group, action and username) already in the row's queue is not queued again.
  - Queueing drops that row's `notDone` entries for the same group and username.
- **Answering the head of the queue.** On its answer:
  - `changed { people }` → `replaced(iid, people)`;
  - `unchanged { people }` → `replaced(iid, people)` and `notDone { unchanged }` (RK64);
  - another reply → `notDone { refused, reply }`;
  - a thrown call → `notDone { failed, cause }`, with no report;
  - then the next change of that row is sent.
  - Rows run independently of each other.
- The map holds an iid only while its queue or `notDone` is non-empty (`setRow`, `mergeRequestActions.ts:62`).
- **The open row stays** (request rule 9). `mergeRequestsShown.ts` `shownOf` passes a row that is in the listed
  `rows` and either passes today's filters and search or is in `openPeopleBoxes`; the order rules stay as today over
  that set (the summary counts it). A row no longer in `rows` (a refresh dropped it) is not shown, open box or not.
  `peopleBoxClosed` of an iid not in the set only drops its notDone. A set, not one iid: the box of the row left
  may close after the next row's box opened.

**Fixture** (`ipc/fixtureMergeRequestPeople.ts`, spread into `createFixtureMergeRequests` beside `discussionsScript`):

```ts
export function peopleScript(
  log: Log,
  listedRows: number,
): Pick<MergeRequestSource, "searchPeople" | "changePeople">;
```

- **`searchPeople(text)`.**
  - It logs `mergeRequests.fixture_people_search { text }`.
  - After `FIXTURE_SEARCH_MS` 300 it answers `found`: `PEOPLE`, then `SEARCH_ONLY_PEOPLE`, whose username or name
    contains `text` (case-insensitive), at most 20, converted by `toPeopleSearchReply(…, fixtureUploadedPicture)`.
  - "zzz" finds no one.
- **`changePeople(iid, change)`.**
  - It logs `mergeRequests.fixture_people_change { iid, group, action, username }`, then waits `PEOPLE_CHANGE_PAUSE_MS`
    1,000.
  - The script keeps each changed iid's people. Their first state is the listed row's (`fixtureRows(0, listedRows)`).
  - `REFUSED_PERSON` → `refused { message: "Cannot assign @rita to !<iid>" }`.
  - Add `FREE_TIER_PERSON` → `unchanged { people }`, the current people.
  - Otherwise an add appends them if absent (a reviewer as `"requested"`), a remove filters them out → `changed {
    people }`.
  - An iid never listed → `failed { message: "GitLab sent no merge request !<iid>" }`.
- **`fixtureMergeRequestData.ts`** exports:
  - `PEOPLE`, which is private today (`:54-60`);
  - `FREE_TIER_PERSON = "olga"`, `REFUSED_PERSON = "rita"`;
  - `SEARCH_ONLY_PEOPLE`: erik "Erik Lund" (`gravatar` `PNG_DATA`, so it loads), olga "Olga Novak" (`none`), rita
    "Rita Moreau" (`none`).
  - The listed rows do not change, so the existing data tests stay as they are.

## Change

1. Domain types and conversions; the two source methods in the interface, `tauriMergeRequests.ts` (`converted(toResult(
   await commands.…), (reply) => toPeopleXReply(reply, uploadedPicture))`, as `rerequestReview`,
   `tauriMergeRequests.ts:87-91`) and the fixture; `ipc/index.ts` exports.
2. `fixtureMergeRequestData.ts` exports and people; `fixtureMergeRequestPeople.ts` and its test; spread into
   `createFixtureMergeRequests`.
3. `ui/mergeRequestPeople.ts` and its test (`vi.useFakeTimers()`; a hand-driven source as
   `mergeRequestRerequests.test.ts:46-55`).
4. `ui/mergeRequests.ts`: `withPeople`, `rerequestsOf` through it, `createPeopleChanges` spread into the slice;
   `mergeRequests.test.ts`'s full source literal (`:162-195`) gains the two methods.
5. `problem.ts`, `problemText.ts` and the step table in `problemText.test.ts` (`:326-329`).
6. `ipc/AGENTS.md`: the two methods, their conversions and the fixture's people script, beside the re-request paragraph
   (`:15`).

## Acceptance

- Vitest, each test named for the bug it catches, at least:
  - `mergeRequestPeople.test.ts`:
    - `typing_waits_250_ms_then_asks_once_with_the_last_text`: three calls within 250 ms send one search.
    - `an_older_search_answer_is_dropped_once_a_newer_search_was_sent` (RK65)
    - `an_answer_after_more_typing_is_dropped`
    - `an_empty_or_at_only_text_shows_the_suggestions_and_asks_nothing`
    - `ending_the_search_drops_the_answer_in_flight`
    - `searching_keeps_the_last_answers_people`
    - `a_refused_search_keeps_the_reply_and_a_thrown_one_is_failed_without_a_report`
    - `a_second_change_on_a_merge_request_waits_for_the_first`: the second is sent only after the first's answer.
    - `changes_on_two_merge_requests_run_side_by_side`
    - `an_equal_change_already_queued_is_not_sent_twice`
    - `changed_hands_gitlabs_people_to_the_row`
    - `an_unchanged_reply_takes_gitlabs_lists_and_keeps_its_sentence` (RK64)
    - `a_refused_or_thrown_change_keeps_a_notice_and_the_queue_goes_on`
    - `closing_the_box_keeps_the_running_and_waiting_changes`
    - `a_box_opened_on_two_rows_keeps_both_until_each_closes`
    - `a_new_change_for_the_person_drops_their_old_notice`
  - `mergeRequests.test.ts`:
    - `a_people_change_rewrites_both_lists_in_rows_and_in_a_buffering_refresh`
    - `a_rerequest_still_rewrites_only_the_reviewers`
    - `the_filters_count_a_person_added_by_a_change` (core `personChoices` over the slice's rows after a `changed`)
    - `a_row_whose_people_box_is_open_stays_shown_after_a_change_drops_it_from_the_filters` (owner #2246; "Reviewer:
      None", add a reviewer: shown while open, gone after `peopleBoxClosed`)
    - `a_row_whose_people_box_is_open_stays_shown_when_the_search_no_longer_matches`
    - `an_open_box_does_not_bring_back_a_row_a_refresh_dropped`
  - `mergeRequestDomain.test.ts`: `found_and_changed_replies_get_pictures_like_a_rows_and_others_pass_unchanged`.
  - `tauriMergeRequests.test.ts`:
    - `searchPeople_and_changePeople_call_their_commands_with_the_arguments` (`commands.changePeople(iid, change)`)
    - the IPC failure table gains both methods (`:450-460`).
  - `fixtureMergeRequestPeople.test.ts`:
    - `a_search_matches_username_or_name_after_300_ms_and_logs_its_text`
    - `adding_then_removing_follows_the_scripts_own_lists`
    - `olga_is_unchanged_and_rita_refused`
    - `a_new_reviewer_is_requested`
    - `each_call_is_logged`
  - `problemText.test.ts`: the two new steps' sentences.
- `pnpm -C frontend lint`, `typecheck` (clean: the page still compiles; `MergeRequestPeople.vue` does not use the new
  state yet), `test`: summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://ipc-contract`, `skill://risk-register` (proposed RK64, RK65), `skill://verification`.
