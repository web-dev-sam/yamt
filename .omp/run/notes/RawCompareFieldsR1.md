# RawCompareFieldsR1 (3.C-fields rework 1, board Raw compare row 8)

The three blocks are fixed. Typecheck, the node tests, lint and the format check pass. The block 1 test fails under the old rule as required. I could not run the changed browser test, because WebKit does not start on this host.

**summary**
- `nextDifference(doc, spans, cursor, direction)` now takes the column's `Text`. Going "up", it picks the last span with `from < cursor` that ends at or before the start of the cursor's line (WebStorm's `getEndLine <= caretLine`). The cursor at the end of a last-line difference no longer returns that same difference.
- `Settle` has no `timers` parameter any more. `Timers` and `SYSTEM_TIMERS` are gone, and the tests use `vi.useFakeTimers()`.
- New `loadCompareFixture(name, files?) → Promise<TabTexts>` in `ipc/fixtureCompare.ts`, exported from `ipc/index.ts`. It reuses the source's own steps (`firstTabs`, plus a new `tabTexts` that `loadTab` also uses now). Every editor test now gets its comparison from it.

**files_changed**
- `frontend/src/editor/internal/compareNavigation.ts`
- `frontend/src/editor/internal/compareNavigation.test.ts`
- `frontend/src/editor/internal/compareViews.ts` (only the `nextDifference` call)
- `frontend/src/editor/internal/compareSettle.ts`
- `frontend/src/editor/internal/compareSettle.test.ts`
- `frontend/src/editor/internal/compareFields.test.ts`
- `frontend/src/editor/internal/compareMarks.test.ts`
- `frontend/src/editor/compare.browser.test.ts`
- `frontend/src/ipc/fixtureCompare.ts`
- `frontend/src/ipc/index.ts`
- `frontend/src/ipc/fixtureCompare.test.ts`

**tests_added**
- `compareNavigation.test.ts` "up from the end of a text without a final line break skips the last-line difference the cursor is in": text `a\nb\nlast` with the cursor at `doc.length`. "Up" returns the earlier difference, or null when the last-line difference is the only one. It catches the old `to <= cursor` rule. The three existing navigation tests now pass a `Text` whose lines start at the spans' offsets.
- `fixtureCompare.test.ts` "loadCompareFixture reads a committed or an in-memory case as tab 1 and rejects an unknown name": checks the committed `words` case, an in-memory case at versions 0/0, and the unknown-name error naming the known cases.
- `compareSettle.test.ts`: the same four tests, now on `vi.useFakeTimers()`, `vi.advanceTimersByTime` and `vi.getTimerCount()` instead of the hand-written clock.

**smoke_evidence**
- Old rule applied by hand (`span.to <= cursor`), then `pnpm -C frontend exec vitest run --project node src/editor/internal/compareNavigation.test.ts`:
  `× up from the end of a text without a final line break skips the last-line difference the cursor is in` / `AssertionError: expected { from: 4, to: 8, tone: 'modified' } to be { from: +0, to: 2, tone: 'modified' }` / `Tests 1 failed | 3 passed (4)`. The new rule was put back afterwards.
- `pnpm -C frontend typecheck` → `vue-tsc -b`, exit 0.
- `pnpm -C frontend test` → `Test Files 145 passed (145)`, `Tests 1907 passed (1907)`.
- `pnpm -C frontend lint` → `oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0, no findings.
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- No `Timers` left: grep `Timers\b|SYSTEM_TIMERS` over `frontend/src/editor` finds only `vi.useFakeTimers` and `vi.useRealTimers`. `compare.ts:73` builds `new Settle(versions, settled)` with no third argument, so the controller never passed one.
- No editor test builds the fixture source: grep `createFixtureCompareSource|openCompare` over `frontend/src/editor` finds nothing.

**deviations_from_brief**
- "Down" keeps `from > cursor`. Every span starts at a line start, so this already means "the first span starting after the cursor's line". A `lineAt`-based rule would make a point difference past the end of a text without a final line break (`from === doc.length`) unreachable from the last line.
- The one-caller fixture wrappers in `compareFields.test.ts` and `compare.browser.test.ts` were inlined into their single caller. `compareMarks.test.ts` keeps its `differences()` because three tests call it.
- `compareSettle.test.ts` takes its starting versions from the committed `words` case instead of an empty source. Every start is versions 0/0.
- In `fixtureCompare.ts`, `firstTabs` now takes the `raw` value (the source parses the query string) and returns `{ tabs, first }`. `tabTexts` was pulled out of `loadTab` so the helper and the source share it.
- `Settle`'s timer field is `number | null` with `globalThis.setTimeout`/`clearTimeout`, as in `lsp/internal/timers.ts`.

**open_risks**
- `frontend/src/editor/compare.browser.test.ts`: I changed it but could not run it. Playwright's WebKit fails to launch here (`MiniBrowser: error while loading shared libraries: libicudata.so.74`). Main should run `pnpm -C frontend test:browser` on a host where WebKit starts.
- `pnpm -C frontend unused` exits 1. It is not one of this rework's acceptance commands, and none of the findings are my exports: `FORMAT_LANGUAGES`, `languageNames`, `ColumnFormat` (`editor/compare.ts`, `editor/index.ts`, `editor/internal/compareFormat.ts`), `ColumnText`, `FormatReport`, `createTauriCompareSource`, `ColumnWrite`, `CompareStart`, `LeftLine`, `RightLine`. `loadCompareFixture` is not flagged.

Checks for Main: `pnpm -C frontend typecheck`, `test`, `lint`, `fmt:check`, `test:browser`.