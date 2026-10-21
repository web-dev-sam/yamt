# RawCompareController (3.C-controller, board Raw compare row 10)

I've built `CompareController`: two editable CodeMirror columns, one strip of bands between them, locked scroll, Format and language. Typecheck, node tests, lint and the format check pass, and all 7 tests in the new WebKit probe pass. `pnpm unused` still fails: it already failed at HEAD on the IPC types waiting for row 11, and it now also lists my new public exports, which nothing imports until row 11 does.

**summary**
- `editor/compare.ts` adds `CompareController` exactly as the contract lists it, plus one added method, `historyKey(event)`. `editor/index.ts` re-exports it and is now 290 lines.
- The parts live in five new `editor/internal/` files: `compareViews`, `compareFrame`, `compareStrip`, `compareFormat` and `compareLanguage`.
- **Format** replaces each column's whole text in one `yamt.format` change, so one undo takes it back. An unchanged or failed column gets no change at all.
- **Language**: Auto fires `detected` only when its finding changes. A picked language never fires it.
- Made general for a second user: `ScrollSync<P>` now takes its list of panes, `syncFindSpace` and `loadLanguage` take a list of views, `everyPane` is exported, and `language.ts` gained `languageNamed` and `languageNames`. The merge `Frame` passes `PANES`, so the merge window behaves as before.

**files_changed**
- New:
  - `frontend/src/editor/compare.ts`
  - `frontend/src/editor/compare.browser.test.ts`
  - `frontend/src/editor/internal/compareViews.ts`
  - `frontend/src/editor/internal/compareFrame.ts`
  - `frontend/src/editor/internal/compareFrame.test.ts`
  - `frontend/src/editor/internal/compareStrip.ts`
  - `frontend/src/editor/internal/compareFormat.ts`
  - `frontend/src/editor/internal/compareFormat.test.ts`
  - `frontend/src/editor/internal/compareLanguage.ts`
  - `frontend/src/editor/internal/compareLanguage.test.ts`
- Modified:
  - `frontend/src/editor/index.ts`
  - `frontend/src/editor/AGENTS.md`
  - `frontend/src/editor/internal/scrollSync.ts`
  - `frontend/src/editor/internal/scrollSync.test.ts`
  - `frontend/src/editor/internal/frame.ts`
  - `frontend/src/editor/internal/find.ts`
  - `frontend/src/editor/internal/language.ts`
  - `frontend/src/editor/internal/paneViews.ts`

**tests_added** (each hand mutation below was applied, failed its test as shown, and was reverted)
- `compareFormat.test.ts`
  - "one undo restores a formatted column, cursor at the start". Bug: Format written as one change per line. Mutation: one dispatch per formatted line → `expected 11 to be 1`.
  - "a failing column is left alone and named with its line while the other is formatted". Bug: stopping after a failed left column. Mutation: `if (left.kind === "failed") return { left, right: { kind: "unchanged" } };` → `expected { kind: 'unchanged' } to deeply equal { kind: 'formatted' }`.
  - "an already formatted column reports unchanged and adds no undo step". Bug: dispatching without checking the result. Mutation: an unconditional whole-text dispatch for unchanged/failed results → `expected 1 to be +0` (this test and the previous one).
- `compareLanguage.test.ts`
  - "Auto finds JSON at build, fires once for it, colours both columns and offers JSON's Format" and "plain text is reported once as no language…". Mutation: the changed-finding check made `|| true` → `[['JSON'],['JSON'],['JSON']]` instead of `[['JSON']]`, and `[[null],[null]]`.
  - "a picked language never fires detected, and Format follows the pick, not the text". Mutation: settling ignores the pick (`kind === "auto" || true`) → `expected "vi.fn()" to not be called at all, but actually been called 1 times`.
  - "languageNames lists every language-data name once, in alphabetical order". Mutation: sort dropped → `expected 1 to be less than 0`. Mutation: `.slice(1)` → `expected … to have a length of 143 but got 142`.
- `scrollSync.test.ts`: the existing cases, the 2,000-line drift case included, assert the same values through a small wrapper. New "two columns follow each other through their difference's anchors, the source left where it was". Mutation: the follower loop over `PANES` instead of the given panes → `TypeError: Cannot destructure property 'scrollDOM' of 'views[pane]' as it is undefined`.
- `compareFrame.test.ts` "a scroll paints the strip from the cached rows; an edit measures them again". Mutation: `this.#layoutCache = measure(views)` in every frame → `expected 12 to be 6`.
- `compare.browser.test.ts`: 7 WebKit tests covering the strip's bands, marks and bars in both columns, the bar's tooltip, locked scroll, the toolbar arrows, the find bar's space, and dark and light.

**smoke_evidence**
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, exit 0.
- `pnpm -C frontend test` → `Test Files  141 passed (141)`, `Tests  1857 passed (1857)`, exit 0.
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0.
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.` on 401 files, exit 0.
- `pnpm -C frontend unused` → exit 1. At HEAD it already fails on the IPC compare surface (`createTauriCompareSource`, `TabTexts`, `Comparison`, …). The new entries are the contract exports row 11 will import: `FORMAT_LANGUAGES`, `languageNames`, `ColumnFormat`, `ColumnText`, `FormatReport`.
- **How the WebKit probe was run:** plain `test:browser` cannot start Playwright's WebKit on this host (`MiniBrowser: error while loading shared libraries: libicudata.so.74`, the known #1445). I ran it on a private copy instead:
  - `/tmp/yamt-pw/webkit-2370`, with Ubuntu noble's libicu74, libxml2 2.9.14 and libflite1 copied into `minibrowser-wpe/sys/lib`. `ldd` then reported nothing missing.
  - A throwaway `/tmp/yamt-pw/vitest.probe.config.mts` extending the repo config with `server.fs.allow` for `/tmp`, so screenshots can be written there.
  - Command: `PLAYWRIGHT_BROWSERS_PATH=/tmp/yamt-pw pnpm -C frontend exec vitest run --config /tmp/yamt-pw/vitest.probe.config.mts --project browser --reporter=verbose src/editor/compare.browser.test.ts src/editor/strips.browser.test.ts src/editor/engine.browser.test.ts` → `Test Files  3 passed (3)`, `Tests  11 passed (11)`. Every compare test and the merge strips and engine probes pass.
- **Screenshots:** `/tmp/yamt-compare/compare-dark.png` and `compare-light.png`. Both show the left column's `old(a, b)` and the right's `new(a)` lines tinted, word marks and bars, and bands in the strip on lines 11 and 21. The light one uses the light palette.
- **Merge window unchanged:** the full browser project gives `Tests 4 failed | 14 passed (18)`. A `git archive HEAD` copy, run the same way, fails the same 4 tests (problems tooltip, 3 removals) with identical values (`expected 439.65625 to be greater than 786.65625`, …).

**deviations_from_brief**
- `historyKey(event)` is added to the contract. It undoes or redoes in the column that holds the keyboard (its find bar counts), and returns false when neither column does.
- `moveToChange` decides "the focused column" the same way (`view.dom.contains(activeElement)`). It writes the scroll with WebStorm's placement (`revealScrollTop`) and focuses the column.
- `format()` returns "unchanged" for both columns when `formatLanguage()` is null.
- The Format change carries `isolateHistory.of("full")`, so typing within 500 ms afterwards does not join its undo step.
- `targets()` now returns `(pane) => number`, as the design note says. `ScrollSync<P>(views, panes, requestFrame)` keeps its last positions in a `Map`, and `contentEnd` is exported with a narrow view type.
- `syncFindSpace`, `loadLanguage` and `CompareFrame` take small structural view types instead of `EditorView`, so the node tests can use fakes. `loadLanguage`'s last parameter is renamed `destroyed` → `stale`; compare passes the path "compare" to its log line.
- `FORMAT_LANGUAGES` and `FormatReport` are defined in `compareFormat.ts` and re-exported from `compare.ts`, as is `languageNames` from `language.ts`.
- The probe mounts its own grid instead of using `paneHarness.ts`, which builds the three-pane layout and is not in my Owned list.
- **Needed outside my globs:**
  - `.omp/skills/project-map/SKILL.md` must name the six new non-test files, or `just map-check` (PM6) fails.
  - `docs/architecture.md` §5.2 should list `CompareController`.
- The fixed `/tmp` screenshot paths fail under plain `test:browser` (`server.fs`). That is the same for the existing problems and removals probes.

**open_risks**
- `compareLanguage.ts:62`: Auto reads both columns' whole text at build, at every settle and on a switch back to Auto. For an 8 MiB column that is a large string, although `detectLanguage` only looks at about the first 4,096 characters.
- `compareStrip.ts:46`: band nodes are keyed by difference index and tone. After a reply that shifts the differences, a node is reused for another difference with only its `d` rewritten.
- `compare.ts:76`: `detected` fires synchronously inside `new CompareController`, before the constructor returns.
- `compare.ts:153`: Ctrl/Cmd+Z with neither column holding the keyboard does nothing. The merge window sends it to the Result instead.