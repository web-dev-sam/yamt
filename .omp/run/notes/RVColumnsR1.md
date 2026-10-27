All three items are fixed. The probe's assertions all passed when run in MiniBrowser, and the compare window (`?diff`) still behaves as before: word marks, bands, arrows and preferences.

```
summary                 Both controllers now call the same three column helpers: `showColumnDifferences` and
                        `setColumnPreferences` in compareViews.ts, and `moveToDifference` in compareFocus.ts.
                        The arrows' "left column when no column has the keyboard" rule is now `arrowColumn`, with a node test.
                        The SFC order check sorts `defineSlots` as a macro.
                        In the range probe the right column has an extra leading line, so the two columns' marks fall on different line numbers.
files_changed           frontend/src/editor/range.ts
                        frontend/src/editor/compare.ts
                        frontend/src/editor/internal/compareViews.ts
                        frontend/src/editor/internal/compareFocus.ts
                        frontend/src/editor/internal/compareFocus.test.ts (new)
                        frontend/src/editor/range.browser.test.ts
                        frontend/scripts/check-sfc-order.ts
                        frontend/scripts/check-sfc-order.test.ts
tests_added             compareFocus.test.ts "the arrows move in the left column when no column has the keyboard":
                          `keyboardColumn` is null and `arrowColumn` is "left".
                        compareFocus.test.ts "the arrows move in the column that has the keyboard": right → right, left → left.
                        check-sfc-order.test.ts "a defineSlots after state reports the macro line":
                          the result matches `Slots.vue:4: macro after state`.
                        range.browser.test.ts, first test reworked: "each column is marked with its own lines from one reply…":
                          3 strip bands; 2 modified band lines in each column; left has 1 `.chunk-marker-inserted` and right
                          has 1 inserted band line; left's first word mark is {old, line 2}, right's is {new, line 3};
                          left's `.chunk-removal` is on line 4, right's on line 3.
smoke_evidence          pnpm -C frontend typecheck → exit 0
                        pnpm -C frontend lint → exit 0
                        pnpm -C frontend test → "Test Files 160 passed (160) / Tests 2072 passed (2072)"
                        pnpm -C frontend sfc-order → exit 0
                        pnpm -C frontend fmt:check → "All matched files use the correct format."
                        The new SFC test fails without the entry: with the `defineSlots` line removed,
                          `vitest run scripts/check-sfc-order.test.ts` → "× a defineSlots after state reports the macro line …
                          Tests 1 failed | 3 passed (4)". With the line back → "Tests 6 passed (6)" (this file plus compareFocus.test.ts).
                        Probe in MiniBrowser (`just webdriver` + `just app-session start-fixture --name rvcol --range-case review`,
                          then `read` of a script that imports /src/editor/index.ts and builds a RangeController with the probe's CASE in the page):
                          {"stripBands":[true,true,true],
                           "left":{"modifiedBandLines":2,"insertedBandLines":0,"insertedMarkers":1,"removals":1,"firstWord":{"text":"old","line":2},"removal":{"line":4}},
                           "right":{"modifiedBandLines":2,"insertedBandLines":1,"insertedMarkers":0,"removals":1,"firstWord":{"text":"new","line":3},"removal":{"line":3}},
                           "moveDown":["const value = old(a, b);","call(x);","call(x);"],"leftFocused":true}
                          Screenshot: /tmp/rvcol-probe.png (left: old/removal on line 4; right: green "// added", "new" on line 3).
                        Compare window, `start-fixture --name rvcmp --diff-case words`:
                          - Marks: bandLines [4,5]; words [["nine","printed ","Visitors sign the book at reception."],["ten","Guests wait…","All rooms…"]];
                            removals [0,1]; 5 strip bands. Screenshot: /tmp/rvcmp-1.png.
                          - Arrows: "Next change" ×2 with no column focused → {"line":"Questions go to the front desk.","column":"left","focused":true}.
                            After clicking into the right column, "Next change" → {"line":"Badges are handed out at the door.","column":"right"}.
                          - Preferences: Settings → Light → Back. Both editors went from "cm-editor ͼ1 ͼ3 ͼ4 ͼ22 ͼo" to "cm-editor ͼ1 ͼ2 ͼ4 ͼ22 ͼo",
                            theme "light"; still 6 word marks and 5 strip bands. Screenshot: /tmp/rvcmp-light.png.
deviations_from_brief   - `showColumnDifferences` lives in compareViews.ts, not compareMarks.ts. compareFields.ts already imports the
                          `ColumnMarks` type from compareMarks.ts, so compareMarks importing `showDifferences` back would be an
                          `import/no-cycle` error. compareViews.ts already imports compareFields.ts and owns `COLUMNS`.
                        - `revealDifference` is now private to compareFocus.ts; `moveToDifference` was its only caller.
                        - `keyboardColumn` now takes a narrow `Focusable` record (`dom.contains`, `root.activeElement`) instead of
                          `ColumnViews`, and `arrowColumn` is exported. That lets the node test use plain objects without `as`:
                          node tests have no DOM, so no EditorView. `ColumnViews` still fits both, and `historyKey` is unchanged.
                        - `showColumnDifferences` and `setColumnPreferences` have no node test: they only loop over the columns and
                          need real EditorViews. The per-column rule is checked by the MiniBrowser probe and the existing `columnMarks` tests.
                        - The probe fixture now lists the real insertion difference (left {0,0}, right {0,1}), so the strip shows 3 bands
                          and the assertions check the inserted marker on the left and the inserted band on the right.
                        - The Playwright browser test itself was not run (WebKit cannot launch here, as the brief says). Its assertions
                          were run as the in-page script shown under smoke_evidence. That script finds a mark's line by its `.cm-line`
                          index instead of `EditorView.posAtDOM`.
open_risks              - The range window's own view (`--range-case review`) showed 0 `.cm-editor` elements: RangeController is not
                          mounted there yet, so in the real window it was only seen through the in-page probe.
                        - `pnpm -C frontend unused` fails on `RangeSideLabel` (src/ipc/index.ts:92, src/ipc/rangeDomain.ts:6),
                          which this slice does not own. Nothing in my files is reported.
```

Checks for Main to run: `pnpm -C frontend test:browser` where Playwright WebKit can launch, and `just check` on the merged tree.