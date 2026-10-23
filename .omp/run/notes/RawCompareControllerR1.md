# RawCompareControllerR1 (3.C-controller rework 1, board Raw compare row 10)

All six blocks are fixed, and the controller's public surface is unchanged. Typecheck, the node tests, lint, the format check and both WebKit probes pass. One thing outside my files must change: the project map has to name the new `compareFocus.ts`, or `just map-check` fails (exact edit under deviations).

**summary**
- **#1536:** a new WebKit test runs the controller's own version loop: the settle timer, which replies it shows, `settleNow` and `destroy`.
- **#1529:** the band placement rule is one function, `placedBand` in `gap.ts`. The merge strips (`bandPaints`) and `CompareStrip` both use it, and `CompareStrip` reuses `dropMissing` and `keepEditorFocus` from `strips.ts`.
- **#1530:** focus moved out of `compareViews.ts` into a new `internal/compareFocus.ts` (`keyboardColumn`, `revealDifference`). One `revealSpan(view, span)` in `viewport.ts` now serves `sideFocus.ts` and compare.
- **#1531:** `COLUMNS` is declared once, in `compareViews.ts`; `compareSettle.ts` imports it.
- **#1537:** Format reports `unchanged` when the column limit refuses the replace. **#1538:** Auto detection reads only each column's opening (`columnOpening`), with `OPENING_CHARS` exported from `detectLanguage.ts`.

**files_changed**
- `frontend/src/editor/compare.ts`
- `frontend/src/editor/compare.browser.test.ts`
- `frontend/src/editor/internal/compareFocus.ts` (new)
- `frontend/src/editor/internal/compareViews.ts`
- `frontend/src/editor/internal/compareSettle.ts`
- `frontend/src/editor/internal/compareStrip.ts`
- `frontend/src/editor/internal/compareFormat.ts`
- `frontend/src/editor/internal/compareFormat.test.ts`
- `frontend/src/editor/internal/compareLanguage.ts`
- `frontend/src/editor/internal/compareLanguage.test.ts`
- `frontend/src/editor/internal/detectLanguage.ts`
- `frontend/src/editor/internal/gap.ts`
- `frontend/src/editor/internal/strips.ts`
- `frontend/src/editor/internal/viewport.ts`
- `frontend/src/editor/internal/sideFocus.ts`

**tests_added** (each mutation was applied by hand, failed as shown, then reverted)
- **`compare.browser.test.ts`, "edits settle with the next version, only a reply for the current versions is shown, and destroy stops the timer" (#1536).**
  - Steps: an edit at line 11 of the left column; nothing is sent at `SETTLE_PAUSE_MS − 1`, then exactly one call `[{column:"left", text, version: start+1}]`.
  - A reply carrying the start versions returns `false` and leaves the tinted lines at `[2,2]`. The same reply with the settled versions returns `true` and both columns go to `[1,1]`.
  - After a second edit, `settleNow()` returns the left column at version start+2. After a third edit and `destroy()`, nothing more fires.
  - Mutation `accepts(...) && false` in `showComparison` → `expected true to be false`.
  - Mutation `#columnText` sends the other column's version → `expected [[[{column:'left',…}]]] to deeply equal …`.
  - Mutation `settleNow` sends the right column's version → `-"version": 2, +"version": 0`.
  - Mutation `this.#settle.destroy()` removed from `destroy` → `expected "vi.fn()" to be called 1 times, but got 2 times`.
- **`compareFormat.test.ts`, "a formatted text past the column limit is refused and reported unchanged" (#1537).** The left column carries `columnLimit(MINIFIED.length, refused)`. Mutation: `formatColumn` always returns `{ kind: "formatted" }` → `expected { left: { kind: 'formatted' }, … } to deeply equal { left: { kind: 'unchanged' }, … }`.
- **`compareLanguage.test.ts`, "Auto reads each column's opening only, past any leading blank lines" (#1538).** The column starts with 4,096 blank lines; Auto still finds JSON.
  - Mutation `doc.sliceString(start)` (the whole text) → `expected '{"a": 1,…' to have a length of 4096 but got 67423`.
  - Mutation `doc.sliceString(0, OPENING_CHARS)` (no whitespace skip) → `expected false to be true`.

**smoke_evidence**
- `pnpm -C frontend typecheck` → exit 0.
- `pnpm -C frontend test` → `Test Files  145 passed (145)`, `Tests  1909 passed (1909)`.
- `pnpm -C frontend lint` → exit 0.
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.` (410 files), exit 0.
- **How the WebKit probes ran:** the same way as round 1, using the private Playwright WebKit in `/tmp/yamt-pw/webkit-2370` (Ubuntu noble's libicu74, libxml2 and libflite1 copied into `minibrowser-wpe/sys/lib`).
  - The existing `/tmp/yamt-pw/vitest.probe.config.mts` points at another worktree (`t85617c70e`), so a first run there tested that tree, not this one. I wrote `/tmp/yamt-pw/vitest.probe.t83ddc0a1f.config.mts` (the same `mergeConfig`, with root and `server.fs.allow` set to this tree and `/tmp`).
  - Command: `PLAYWRIGHT_BROWSERS_PATH=/tmp/yamt-pw pnpm -C frontend exec vitest run --config /tmp/yamt-pw/vitest.probe.t83ddc0a1f.config.mts --project browser src/editor/compare.browser.test.ts src/editor/strips.browser.test.ts`
  - Result: `Test Files  2 passed (2)`, `Tests  11 passed (11)`. That is all 8 compare tests, the new one included, and the 3 merge strips tests.
- `pnpm -C frontend unused` → exit 1, but only on entries that were already listed: the row-11 surface (`FORMAT_LANGUAGES`, `languageNames`, `ColumnFormat`, `ColumnText`, `FormatReport`) and IPC types such as `createTauriCompareSource`. None of the new exports is listed.

**deviations_from_brief**
- **The version-loop test does not type through the keyboard.** It finds the left view with `EditorView.findFromDOM` and dispatches the edit with `userEvent: "input.type"`, with `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })`, so the pause is exact rather than a real wait. It imports `SETTLE_PAUSE_MS` from `./internal/compareSettle`.
- **"Bands unchanged / re-tinted" is checked as the count of tinted lines** (`.cm-line.chunk-band.chunk-modified`) in each column.
- **`COLUMNS` lives in `compareViews.ts`, not `compareSettle.ts`.** `compareFrame.ts` already imports it from there, and that file is outside my Owned list.
- **`columnOpening(doc)` is exported from `compareLanguage.ts` so the test can reach it.** `detectLanguage` keeps its string signature and its own whitespace skip, so other callers that pass strings behave as before.
- **Needed outside my globs:** in `.omp/skills/project-map/SKILL.md`, the compare `internal/` list must add `compareFocus (keyboard column, reveal a difference)`. `compareViews` should then read `(the two "center" panes, COLUMNS)` instead of `(… navigation)`. `frontend/src/editor/AGENTS.md` could name `compareFocus.ts` too.
- I created the scratch file `/tmp/yamt-pw/vitest.probe.t83ddc0a1f.config.mts`. I deleted the failure screenshots my mutation runs left in `frontend/.vitest/`.

**open_risks**
- `compareFormat.ts:43`: "unchanged" is decided by whether the document object is still the same after the dispatch. A transaction filter that let a different, equal-text replace through would be reported `formatted`. No such filter exists today.
- `compareStrip.ts:5`: `CompareStrip` now imports `strips.ts`, and with it `folding` and `stripIcons`, only for `dropMissing` and `keepEditorFocus`. There is no import cycle, but the compare window loads those modules.
- `compareStrip.ts:38`: band nodes are still keyed by difference index and tone, as round 1 noted.