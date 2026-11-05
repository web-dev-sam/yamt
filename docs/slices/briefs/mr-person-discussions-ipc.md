# Slice mr-person-discussions-ipc — `first` on the window's discussions, and fixtures with multi-writer threads across rows

Feature: one person's discussions across every merge request. Sources:

- Request `docs/slices/request-mr-person-discussions.md` D1–D4, C2 and "To be measured" (the fixtures).
- Design `docs/slices/briefs/mr-person-discussions-design.md` option A §2.1, §2.7; proposed plan row #193.

Runs in round 2: after `mr-person-discussions-rust`, the orchestrator's `just bindings` (commit the regenerated
`bindings.ts` with this slice) and after `mr-person-discussions-threads` is committed (you then add one field to its test
file's discussion builder). `mr-person-discussions-state` follows you. It wires no window.

Facts (given):

- Rust now sends `OpenDiscussion.first: FirstComment { createdAt: string (ISO 8601), body: Description }` (generated
  `Generated.FirstComment`); the starter is `earlier[0]`, else `last`.
- `ipc/discussionDomain.ts`: `OpenDiscussion` (`:30-35`), `toDiscussion` (`:96-111`, used by `toRowDiscussions` and
  `toDiscussionThreadReply`), `toDescription(raw, field)` from `descriptionDomain.ts` (brands every link page), `toTime`.
- Fixture: `fixtureMergeRequestDiscussions.ts` `openDiscussion(discussion)` builds the generated value from a
  `FixtureDiscussion`'s comments (`:157-173`); each `FixtureComment` already has `createdAt` and `body`
  (`fixtureMergeRequestRendering.ts`); `turnCases(seed)` scripts !637 (`THREADS_CASES`, serials 1–13) and !636 (14–16)
  (`fixtureMergeRequestTurnCases.ts:38-103, 166-204`); `scripted` puts each discussion's comments an hour apart from 48 h
  before the store's creation and its last `at + 1` hours before it; `RICH_CHANGES` shows how one comment gets a rich
  body (`:113-163`, `fixtureWebImage`, `pixels`, `richDescriptionBlocks`).
- `fixtureMergeRequestData.ts:17-25`: `OPEN_DISCUSSIONS` overrides a row's count (`index % 3` otherwise); people sam (Me),
  anna, ben, chiara, dmitri (`:65-71`).
- Rows named by earlier smoke expectations, which must not change: !602 !603 !605 !606 !608 !612 !614 !615 !617 !618
  !622 !623 !627 !629 !630 !632 !633 !635 !636 !637 !638 !639 !640 (`briefs/mr-review-mode-design.md:203-206`,
  `mr-review-mode-verify.md:36-39`, `mr-threads-verify.md:26-65`, `mr-discussions-verify.md:67-71`,
  `mr-mentions-verify.md`). Free rows with discussions today: !609 (1), !611 (2), !620 (2), !621 (1), !624 (1), !626 (2).
- Hand-built `OpenDiscussion` literals: `ipc/discussionDomain.test.ts:46`, `ipc/fixtureMergeRequests.test.ts:521`,
  `ipc/tauriMergeRequests.test.ts:517-806`, `ui/mergeRequestThread.test.ts` (its discussion builder),
  `ui/mergeRequestDiscussions.test.ts:66-74`, `ui/mergeRequests.test.ts:1700-1752`.

## Target

**Owned:**

- `frontend/src/ipc/discussionDomain.ts`, `frontend/src/ipc/discussionDomain.test.ts`
- `frontend/src/ipc/tauriMergeRequests.test.ts` (expected values only)
- `frontend/src/ipc/fixtureMergeRequestDiscussions.ts`, `…/fixtureMergeRequestDiscussions.test.ts`
- `frontend/src/ipc/fixtureMergeRequestTurnCases.ts`, `frontend/src/ipc/fixtureMergeRequestData.ts`,
  `frontend/src/ipc/fixtureMergeRequestData.test.ts`
- `frontend/src/ipc/fixtureMergeRequests.test.ts`, `frontend/src/ipc/fixtureMergeRequestThreads.test.ts` (expected values)
- `frontend/src/ipc/AGENTS.md`
- **Line-scoped, only the `first` field of each hand-built discussion:** `frontend/src/ui/mergeRequestThread.test.ts`,
  `frontend/src/ui/mergeRequestDiscussions.test.ts`, `frontend/src/ui/mergeRequests.test.ts`.

**Read-only:** everything else. `frontend/src/ipc/bindings.ts` is generated (PM4): the orchestrator hands it to you, you
commit it unchanged. `frontend/src/mergeRequests/**` (the core's `OpenDiscussion` is structural, so an ipc value with
`first` still fits). `docs/**`: lines in `deviations_from_brief`.

**Non-goals:** any `ui/` state or component; real Markdown rendering in the fixture.

## Contract

Fixed. You may add, never change.

```ts
// ipc/discussionDomain.ts
export type FirstComment = {
  /** Milliseconds since 1970, from GitLab's ISO 8601 time. */
  readonly createdAt: number;
  readonly body: Description;
};
export type OpenDiscussion = {
  readonly id: DiscussionId;
  readonly place: DiscussionPlace;
  /** The first person note (earlier[0], else last): its time and GitLab's rendering (request D1, D2). */
  readonly first: FirstComment;
  readonly earlier: readonly TurnComment[];
  readonly last: DiscussionNote;
};
```

`FirstComment` is re-exported wherever `OpenDiscussion` is (`ipc/index.ts` re-exports `discussionDomain`'s types: check,
and add it there only if that file lists names one by one; otherwise nothing).

**Fixture person cases** (design §2.7), `fixtureMergeRequestTurnCases.ts` beside `THREADS_CASES`, serials from 17 on
(after !636's), each row's last comments at distinct hours (no tie across rows):

| case | row (default) | comments, oldest first                                                                          | Me (sam)          | Anna              |
| ---- | ------------- | ----------------------------------------------------------------------------------------------- | ----------------- | ----------------- |
| p1   | !626          | anna (rich: bold, inline code, a link, a 160 px web image, six lines), ben, chiara, dmitri      | reviewer or other | turn              |
| p2   | !626          | sam, anna                                                                                       | turn              | wrote             |
| p3   | !626          | anna, ben, anna                                                                                 | reviewer or other | started           |
| p4   | !620          | sam, chiara, sam                                                                                | started           | reviewer or other |
| p5   | !620          | ben, chiara, sam                                                                                | wrote             | reviewer or other |
| p6   | !621          | fourteen comments among ben, chiara, dmitri, anna and a deleted user (null), ending with chiara | reviewer or other | turn              |
| p7   | !611          | dmitri, chiara                                                                                  | reviewer or other | reviewer or other |

- Before writing them, read `fixtureRows(0, 40)`: no case row may be authored by sam or anna (an author's discussions are
  all the author's turn, B2); sam must review one of the case rows and anna another, so group "reviewer" has an entry for
  each. When a default row does not give that, pick another free row (Facts) that does; report the rows in
  `deviations_from_brief`.
- Set each case row's count in `OPEN_DISCUSSIONS` to its case count; no other row's count or discussions change.
- No mention of sam or anna in any case (so the groups are as the table says).

## Change

1. `discussionDomain.ts`: `first` per the Contract, converted in `toDiscussion` (`toTime(raw.first.createdAt,
   "<field>.first.createdAt")`, `toDescription(raw.first.body, "<field>.first.body")`), so rows and threads both get it.
2. Fixture `openDiscussion`: `first` from `comments[0]` (`createdAt`, `body`).
3. The person cases per the Contract, wired into `turnCases` for their rows; `OPEN_DISCUSSIONS`.
4. Every hand-built discussion literal listed in the Facts gains `first` (in the three ui test files, only that field).
5. `ipc/AGENTS.md`: the fixture paragraph names the person cases, their rows and what each proves.

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches:

- `discussionDomain.test.ts`: `the_first_comment_converts_its_time_and_brands_its_links` (a bad `first.createdAt` or a
  link page throws, naming the field).
- `tauriMergeRequests.test.ts`: the rows and the thread carry `first` converted.
- `fixtureMergeRequestDiscussions.test.ts`:
  - `every_discussion_starts_with_its_first_comment`: for every listed row, `first` equals `comments[0]`'s time and body.
  - `the_person_cases_have_their_writers_in_order`: p1's later writers are ben, chiara, dmitri; p6 has thirteen later
    writers.
  - `the_person_case_rows_have_sam_and_anna_as_reviewers`: one each (the reviewer group's precondition).
  - The existing `the_review_orders_the_smoke_expects` passes unchanged (the earlier smokes' rows are untouched).
- `fixtureMergeRequestData.test.ts`: the case rows' counts.

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`; `just bindings-check` (the committed
bindings equal a fresh export); `just mutants HEAD` (`fixture*` files are wiring and data: list the survivors with that
reason; `discussionDomain.ts`'s must die).

## Skills

`skill://ts-conventions`, `skill://ipc-contract` (a converted IPC field), `skill://verification`.
