# Slice line-ranges-window — drafts, place text and the AI's value for a range

Design: `docs/slices/briefs/line-ranges-design.md` option A (§1 "Window"). Request rules 6, 7. Facts with a source
below are given; re-check only `[INFERENCE]`.

## Target

**Owned:** `frontend/src/ui/rangeDrafts.ts`, `frontend/src/ui/rangeThreads.ts`, `frontend/src/ui/rangeThreads.test.ts`,
`frontend/src/ui/rangeOpen.ts`, `frontend/src/ui/rangeOpen.test.ts`, `frontend/src/ui/rangeThreadText.ts`,
`frontend/src/ui/rangeThreadText.test.ts`, `frontend/src/ui/rangeStore.ts`, `frontend/src/ui/rangeStore.test.ts`,
`frontend/src/ui/useRangeController.ts`, `frontend/src/ui/useRangeController.test.ts`,
`frontend/src/ui/RangeThreadBox.vue`, `frontend/src/ui/rangeAi.test.ts`, `frontend/src/ui/rangeGitLab.test.ts`,
`frontend/src/ui/AGENTS.md`, `frontend/src/agent/internal/firstMessage.ts`,
`frontend/src/agent/internal/firstMessage.test.ts`.

**Read-only:** `frontend/src/ipc/**` (the domain build: `ThreadPlace`, `DiffLine`, `ShownThread { key, place, shown }`,
`onePlace`, `diffLineOf`, `sameDiffLine`, `isOneLine`, `shownLine`; `line-ranges-domain.md` Contract),
`frontend/src/editor/**`.

**Needs:** the domain build committed. Runs beside the editor build; writes against its `RangeEvents.startThread(place:
ThreadPlace)` (`line-ranges-editor.md` Contract). This build's commit with the editor's starts the smoke pass.

**Typecheck while the editor build runs:** errors are expected only in files under `src/editor/` and where your code
meets `RangeEvents.startThread` (`useRangeController.ts` `rangeThreadParts`, and its test's `events.startThread` calls),
which the editor build's new signature resolves; zero elsewhere under `src/ui/` and `src/agent/`.

**Open question this build depends on:** none (the wording below is the design's; the owner may change it later).

**Non-goals:** quoting the lines' text to the AI; renaming `RELATIVE_FILE_PATH_WITH_LINE` (users' saved templates use it,
plan §2 #113); any editor behaviour (drag, tint, hover).

## Contract

Fixed:

- `RangeThreads.startThread(file: RangeFileId, place: ThreadPlace): void`; `RangeDrafts.startThread(file, place)`;
  the thread draft is `{ kind: "thread", file, place: ThreadPlace, text, focus }`.
- Draft identity (rule 7): a new `place` focuses (bumps `focus` of) the open thread draft of the same file whose place
  has the same `start` (`sameDiffLine`) and the same end by today's rule (same `shownLine(end)` column and line,
  `rangeDrafts.ts:120-123`); any other place is a new draft (even one ending on the same line: they share its row).
- `rangeThreads.shownFor` gives drafts as `{ key, place: draft.place, shown: "draft" }`; `rangeOpen.shownFor` gives
  stored threads as `{ key, place, shown }`; `addThread` sends `draft.place`.
- `rangeThreadParts(...).events.startThread = (place) => threads.startThread(file.id, place)`.
- `threadPlaceText(entry: Pick<RangeEntry, "path" | "change">, place: ThreadPlace): string`. Each end is named by
  today's rule: a removed line by `entry.change.oldPath` when renamed, else `entry.path`, and its old number (`left + 1`);
  any other line by `entry.path` and its new number (`right + 1`). Then:
  | case                                                                                                  | text                                                                    | example                                                   |
  | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
  | `isOneLine(place)`                                                                                    | `<end path>:<end>` (today's text)                                       | `src/board/board.ts:204`                                  |
  | both ends removed, or neither                                                                         | `<end path>:<start>-<end>`                                              | `src/board/board.ts:201-204`; `src/api/mockBoards.ts:2-5` |
  | one end removed, one not, one path                                                                    | `<path>:<sign start><start> to <sign end><end>`, `-` removed, `+` other | `src/board/board.ts:-200 to +204`                         |
  | the same, paths differ (renamed)                                                                      | `<start path>:<sign><start> to <end path>:<sign><end>`                  | `docs/shortcuts.md:-3 to docs/keys.md:+4`                 |
  | The same text is the box header, its `aria-label` (`RangeThreadBox.vue:42-45, 157, 161`) and the AI's |
  | `RELATIVE_FILE_PATH_WITH_LINE` (`rangeStore.ts` `askContext`, `:122`).                                |
- `DEFAULT_FIRST_MESSAGE` line 3 (`firstMessage.ts:14`) becomes exactly:
  `A line removed by the changes is named by its place in {{ OLD_COMMIT }}; in a range such as \`-5 to +8\`, \`-\` marks a line of {{ OLD_COMMIT }} and \`+\` one of {{ NEW_COMMIT }}.`
  Every other line and every placeholder name unchanged.

## Change

1. `rangeDrafts.ts`, `rangeThreads.ts`, `rangeOpen.ts`, `useRangeController.ts`: `line` → `place` as above; the
   identity rule in `rangeDrafts.ts` (private `samePlace`).
2. `rangeThreadText.ts` `threadPlaceText(entry, place)`; `RangeThreadBox.vue` reads `draft.value?.place ??
   thread.value?.place`; `rangeStore.ts` `askContext` passes `thread.place`.
3. `firstMessage.ts` default line 3; `firstMessage.test.ts`'s expected text.
4. Tests (`onePlace(changedThreadLine(…))` where a one-line place is meant):
   - `rangeThreadText.test.ts`: today's one-line cases through `onePlace`; the four range cases above, including a
     renamed file (`{ kind: "renamed", oldPath: "docs/shortcuts.md" }`, path `docs/keys.md`), a removed-only range in a
     deleted file, and a range whose start is unchanged in the left column (named by its new number).
   - `rangeThreads.test.ts`: "dragging exactly a draft's range focuses it; another range ending on the same line is a
     new draft" (start differs, end the same; end column differs); seeded keys `thread-0`…`thread-5` and counts
     `[[board, 6]]` (the domain build appends threads 4 and 5, both `notQueued`); `shownFor` gives `place`.
   - `rangeStore.test.ts`: `askContext` of a both-sides thread gives `src/board/board.ts:-255 to +260` (seeded thread 5:
     `removed { left: 254 }` → `-255`, `added { right: 259 }` → `+260`).
   - `useRangeController.test.ts`: `events.startThread(place)` makes a draft with that place.
   - `rangeAi.test.ts`, `rangeOpen.test.ts`, `rangeGitLab.test.ts`: mechanical (`place`, seeded count) where they
     break.
5. `ui/AGENTS.md`: the range thread paragraph names the place, the identity rule and `threadPlaceText`'s cases.

## Acceptance

- `pnpm -C frontend test src/ui src/agent` → all pass (paste the summary line and the new test names).
- `pnpm -C frontend typecheck` → zero errors under `src/ui/` and `src/agent/` except the `RangeEvents.startThread` ones
  named in Target (paste them); none once the editor build is in the tree.
- `pnpm -C frontend exec oxlint --type-aware src/ui src/agent` and `pnpm -C frontend exec eslint --max-warnings 0
  src/ui/RangeThreadBox.vue` clean.
- `just mutants HEAD`; survivors on changed lines killed or kept with a reason (SP11).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://comment-policy`.
