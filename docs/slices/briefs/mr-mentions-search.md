# Slice mr-mentions-search — one people-search factory, two instances: the people box's and the mention list's

Feature: `@` completion in comment fields. Sources:

- Request `docs/slices/request-mr-mentions.md` rule 6 ("the people box's search and the mention list never change each other's results") and rule 7 (the search writes nothing, RK54).
- Design `docs/slices/briefs/mr-mentions-design.md` option A §2.3. Proposed plan row #191; amends #169; RK65 (amend).

Runs in round 1, in parallel with `mr-mentions-core`. It wires no window: the people box behaves exactly as today.

Facts (given):

- `ui/mergeRequestPeople.ts:96-130` `searchOf(source)` is the window's one search:
  - `shallowRef<PeopleSearch>(EMPTY)`;
  - a `calls` counter that drops a stale answer;
  - `SEARCH_PAUSE_MS` (250) after the last call;
  - `searchedText(typed) === ""` → `empty` at once with no call;
  - while waiting, `searching { text, people: last shown }`.
- `createPeopleChanges` spreads it into `PeopleChanges` (`:46-62, 209-217`) as `peopleSearch`/`searchPeople`/`endPeopleSearch`.
- The slice type `MergeRequests` (`ui/mergeRequests.ts:50-78`) includes `PeopleChanges`. `peopleOf(state)` (`:115-132`) creates it.
- Callers:
  - `MergeRequestPeople.vue:86-87, 193, 209` (`searchPeople("")` when a field opens, `endPeopleSearch()` when it closes);
  - `MergeRequestPeopleSearch.vue:21, 33, 69, 85`;
  - `mergeRequestPeople.test.ts` (`live.slice.searchPeople`/`peopleSearch`/`endPeopleSearch`, about 25 uses);
  - `ui/AGENTS.md:75` (the doc line; `mr-mentions-list` owns that file and rewrites the line).

## Target

**Owned:**

- `frontend/src/ui/mergeRequestPeople.ts`, `frontend/src/ui/mergeRequestPeople.test.ts`
- `frontend/src/ui/mergeRequests.ts`, `frontend/src/ui/mergeRequests.test.ts`
- `frontend/src/ui/MergeRequestPeople.vue`, `frontend/src/ui/MergeRequestPeopleSearch.vue` (the calls only)

**Read-only:**

- everything else;
- `frontend/src/ui/AGENTS.md`: write its new line for `peopleSearch`/`mentionSearch` in `deviations_from_brief`; `mr-mentions-list` applies it.

**Non-goals:**

- Any use of `mentionSearch` (the `mr-mentions-list` slice).
- Any change to the people box's behaviour, words or timing.
- A Rust command (design §2.3: `search_people` suffices).

## Contract

Fixed. You may add to it, but never change it.

```ts
// ui/mergeRequestPeople.ts
/** One search over GitLab's people (plan §2 #169, #191): SEARCH_PAUSE_MS after the last `search`, newest answer only. */
export type PeopleSearcher = {
  readonly state: Readonly<ShallowRef<PeopleSearch>>;
  /** core searchedText(typed) "" → empty at once; the same text as a `searching`/`found` state → nothing; else
   *  searching (the last people kept), asked SEARCH_PAUSE_MS after the last call. */
  search(typed: string): void;
  /** empty; a pending or running search's answer is dropped. */
  end(): void;
};
export function createPeopleSearch(source: MergeRequestSource): PeopleSearcher;

// PeopleChanges: `peopleSearch: PeopleSearcher` replaces `peopleSearch`/`searchPeople`/`endPeopleSearch`.

// ui/mergeRequests.ts: MergeRequests gains
/** The mention list's own search (request rule 6): a second instance, never the people box's. */
readonly mentionSearch: PeopleSearcher;
```

## Change

1. Lift `searchOf` to the exported `createPeopleSearch`. Its body is unchanged except for one new rule:
   - `search(typed)` returns at once, without touching the state or the timer, when `searchedText(typed)` equals `state.text` and `state.kind` is `searching` or `found`.
   - A `refused` or `failed` state asks again.
2. `createPeopleChanges` returns `peopleSearch: createPeopleSearch(deps.source)` in place of the three members.
3. `mergeRequests.ts` creates `mentionSearch: createPeopleSearch(source)` beside `peopleOf(state)`, so the slice holds two instances.
4. Migrate the callers. Clean cutover; no alias is left:
   - `MergeRequestPeople.vue`: `peopleSearch.search("")` and `peopleSearch.end()`.
   - `MergeRequestPeopleSearch.vue`: `peopleSearch.state.value` and `peopleSearch.search(text)`.
   - The tests.
5. Tests below.

## Acceptance

**Tests** (`pnpm -C frontend test`):

- The existing `mergeRequestPeople.test.ts` search tests stay green, rewritten over `slice.peopleSearch.{search,end,state}`:
  - the pause;
  - `an_answer_after_more_typing_is_dropped`;
  - empty texts;
  - an end drops answers;
  - RK65's `an_older_search_answer_is_dropped_once_a_newer_search_was_sent`.
- `the_same_text_again_asks_nothing` (`mergeRequestPeople.test.ts`):
  - `search("an")`, pause, answer → `found`;
  - `search(" an ")` and `search("@an")` → still that `found`, and no second call after 4 pauses;
  - after a `failed` answer, `search("an")` asks again.
- `the_people_box_and_mention_searches_never_touch_each_other` (`mergeRequests.test.ts`, over the slice; RK65, request rule 6):
  1. `peopleSearch.search("er")` and `mentionSearch.search("an")` → two calls, `er` and `an`, after one pause.
  2. Each state holds its own answer.
  3. `peopleSearch.end()` leaves `mentionSearch.state` `found an`.
  4. A held `mentionSearch` answer arriving after `peopleSearch.search("b")` lands only in `mentionSearch`.
- No other behaviour changes: the existing people box tests (`MergeRequestPeople*`, `mergeRequestPeopleLines.test.ts`) stay green untouched.

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`, `sfc-order`. `just mutants HEAD`: kill every survivor on the changed lines; the new same-text guard and its kind check are killed by `the_same_text_again_asks_nothing`.

**Smoke (WebKit fixture, the people box unchanged):**

1. `just app-session start-fixture --name mms --diff --mr list --open-mr --size 1600x1000`.
2. Open the people box of the first row that offers "Add assignee" and press it: the empty field's suggestions (Me first).
3. Type `er`: after the pause one `mergeRequests.fixture_people_search {"text":"er"}` and Erik listed.
4. Escape, Escape: field, then box.
5. `just app-session stop --name mms`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (RK54, RK65), `skill://verification`.
