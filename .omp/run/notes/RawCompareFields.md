# RawCompareFields (3.C-fields, board Raw compare row 8)

All five compare building blocks now exist in `frontend/src/editor/internal/`, and tints, bands and word marks share one rule between the merge window and compare. Typecheck, test, lint and fmt:check pass. `pnpm unused` fails, but only on row 7's ipc compare exports that have no importer yet, not on anything I added.

**summary**
- `compareMarks.ts`: `columnMarks` builds one column's spans, bands and word marks from a comparison, in one pass. Both columns and the band use `changeTone(left.len, right.len)`, and an empty side gets a point band, as the merge window does.
- `compareFields.ts`: `showDifferences` and `differenceField`. The effect replaces spans and both decoration sets. Any other edit maps them through `tr.changes` (`from` −1, `to` −1) and never rebuilds them.
- `compareSettle.ts`: `Settle` holds both column versions, which columns were edited and the 300 ms pause timer. `accepts` needs both versions to match.
- `columnBytes.ts`: `utf8Length` counts UTF-8 bytes without encoding the text. `columnLimit` keeps a byte count per column, updated by the size of each change, and refuses an edit that would pass the limit.
- `compareNavigation.ts`: `nextDifference` steps down or up from the cursor, with no wrap.
- Made general for the second user: `changeTone` (now behind `chunkTone`), exported `Band`/`bandDecorations`, and `wordDecorations` (which `sideWordDecorations` now loops over).

**files_changed**
- `frontend/src/editor/internal/compareMarks.ts`, `compareFields.ts`, `compareSettle.ts`, `columnBytes.ts`, `compareNavigation.ts` (new), each with its `.test.ts` (new)
- `frontend/src/editor/internal/tone.ts`, `tone.test.ts`, `decorations.ts`, `words.ts`
- `frontend/src/editor/internal/lineSpan.ts`, `frontend/src/ipc/index.ts` (added to my files by Main, see deviations)

**tests_added**
Each line gives the test, then the hand mutation that made it fail. I applied every mutation, saw the test fail, and reverted it.
- `compareMarks.test.ts`
  - "an empty left side is inserted and an empty right side deleted, in both columns and their bands" ← `changeTone` arguments swapped: got `['modified','inserted','deleted']`, expected `['modified','deleted','inserted']`.
  - "word marks and removal bars sit on their own words in both columns, in the difference's tone" ← `+ 1` dropped on a word mark's line: got `"1 chunk-word-modified sam"`. Dropped on a bar's line: got `"… new| word"` instead of `"… new word|"`.
  - Also: "each column's spans cover its own lines of every difference" and "no differences leave a column without spans, bands or marks".
- `compareFields.test.ts`
  - "typing inside a difference grows it; typing at the start of the next line stays outside" ← `to` mapped with +1: got `['xold word\ny']`.
  - "bands and word marks follow their text through an edit above them" ← the field ignores `tr.changes`: got `'1 chunk-modified chunk-band'`, expected line 3.
  - "a new comparison replaces the spans, bands and word marks" ← effect replaces only `spans`: got 0 decorations, expected 2.
- `compareSettle.test.ts` (uses a fake `Timers`)
  - "one settle after the pause, with exactly the columns edited since the last one" ← edited set not cleared: the second call got `['left','right']`.
  - "an edit raises only its own column's version; a reply with an old right version is refused" ← only `left` compared: `accepts(start)` returned true.
  - "settleNow hands over the edited columns and cancels the pause" ← `#cancel()` removed from `settleNow`: 1 timer still pending, expected 0.
  - Also: "destroy cancels the pause and forgets the edits".
- `columnBytes.test.ts`
  - "a three-byte character that passes the limit is refused and reported" ← UTF-16 length counted: got `'ab€'`.
  - "an edit that reaches the limit exactly is accepted; one byte more is refused" ← `>` changed to `>=`: got `'ab'`, expected `'ab€'`.
  - Also: "utf8Length counts what TextEncoder writes…" and "the count follows each change: removed bytes make room, line breaks count one".
- `compareNavigation.test.ts`
  - "past the last or before the first difference there is nowhere to go: no wrap" ← `?? spans[0]` added: got the first span instead of null.
  - Also: the down and up stepping tests.
- `tone.test.ts`: "changeTone: lines only on the changed side are inserted, only on the base side deleted, on both modified". The existing `tone`, `words` and `decorations` tests all still pass, so the merge window's answers are unchanged.

**smoke_evidence**
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, no output, exit 0.
- `pnpm -C frontend test` → `Test Files 137 passed (137)`, `Tests 1847 passed (1847)`.
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings.
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- `pnpm -C frontend unused` → exit 1. It lists 1 unused export (`createTauriCompareSource`) and 16 unused types, all row 7's ipc compare exports (`compareDomain.ts:17,22`, `ipc/index.ts:6–21`). Nothing I added is listed: the new exports have their test files as importers.
- The eleven hand mutations and their failing output are listed under tests_added. Each was applied with `edit`, run with `vitest run --project node <file>`, and reverted. After reverting, the full `pnpm test` passed.

**deviations_from_brief**
- Main gave me `frontend/src/ipc/index.ts` (only `export type { SideWords } from "./words";`) and `frontend/src/editor/internal/lineSpan.ts`. I widened `lineSpan`'s range parameter to `{ readonly start: number; readonly len: number }`. The merge window and compare now share one line-range-to-span rule, and `compareMarks.ts` has no copy of it. I did not add a `lineSpan.test.ts`: the change is only a wider parameter type.
- Decided myself: `columnLimit` refuses only an edit that adds bytes (`added > 0 && count + added > limit`). A column that somehow starts over the limit can still shrink.
- Decided myself: `nextDifference` going down picks the first span with `from > cursor`. Going up it picks the last span with `from < cursor && to <= cursor`, so the difference the cursor is in, or a point at the cursor, is skipped.
- Decided myself: when one transaction carries several `showDifferences`, the last one wins. The effect's marks are taken as built for the new document.
- The tests get branded `Difference`s and `ColumnVersions` through `createFixtureCompareSource(log, "?raw=case", { "case.json": … })`. `ipc/index.ts` exports no other constructor, and tests may not use `as`.
- `just map-check` does not list the new files, so it most likely checks only committed files. After the commit, the project map needs entries for `compareFields`, `compareMarks`, `compareSettle`, `columnBytes` and `compareNavigation`, which is the docs owner's job. The ipc and format entries it already reports missing come from other slices.

**open_risks**
- `compareFields.ts:24-32`: every edit maps the spans array in O(number of differences) time. A column with ~100k small differences pays that on each key; the decoration sets themselves map cheaply.
- `columnBytes.ts:62-72`: the filter calls `refused()` while the transaction is being built, before the transaction exists. Row 10 must not dispatch from inside that callback, or must defer it.
- `compareFields.ts`: `showDifferences` has no `map` function. Its marks would be wrong if a spec carrying it were combined with a later spec that has changes, through `state.update(a, b)`. No caller does that today.
- `columnBytes.ts:41-47`: the count treats line breaks as `\n`, which matches the `eol: "Lf"` compare panes. A CRLF line separator would undercount by one byte per line.