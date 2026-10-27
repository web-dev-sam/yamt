All five items from the fix brief are in, and each hand mutation was caught. `typecheck`, `lint`, `test` and `fmt:check` all pass. The new browser tests in `rangeThreads.browser.test.ts` have never run, because Playwright WebKit still can't launch here; I ran the same checks in MiniBrowser instead.

```
summary                 1. A press on a line number past the file's end does nothing: CodeMirror's empty line after a last newline, and an
                           added or deleted file's empty column (`pressedLine` in threadNumbers.ts).
                        2. `shownLine(line) → { column, line }` in ipc/threadLine.ts is the one exhaustive switch. `shownColumn` is
                           `shownLine(line).column`; `lineInShownColumn` is deleted.
                        3. A thread row on a difference's empty side now sits inside the band. Each `ThreadRow` has a `kind`
                           (`unchanged | changed | leftEmpty | rightEmpty`); empty-side rows sit before line rs, and `columnSpan`
                           measures an empty range from the joined block's top to its text's top.
                        4. `ThreadHosts` forgets a remembered field when a capturing document `pointerdown` lands outside every host;
                           the listener is removed in `destroy()`.
                        5. `ThreadHosts` is built after the views, takes them directly and observes scrollers and gutters in its
                           constructor. The views thunk and `watchColumns()` are gone.
files_changed           frontend/src/ipc/threadLine.ts, frontend/src/ipc/index.ts,
                        frontend/src/editor/range.ts, frontend/src/editor/AGENTS.md, frontend/src/editor/rangeThreads.browser.test.ts,
                        frontend/src/editor/internal/{threadNumbers,threadRows,threadField,threadHosts,compareFrame}.ts,
                        frontend/src/editor/internal/{threadNumbers,threadRows,threadField,threadAnchor,compareFrame}.test.ts
tests_added             threadNumbers.test.ts
                          "a press on the empty line after a text's last newline is no line of the file" — "a\nb\n": line 2 → 1, line 3 → null
                          "a text without a last newline keeps its last line pressable"
                          "an added file's empty left column has no line to press" — Text "" → null
                        threadAnchor.test.ts
                          "every line of an added file's right column is added"
                        threadRows.test.ts
                          "a removed line in a pure deletion places its row on the right's empty side" — kind rightEmpty; the unchanged
                            row of line rs−1 stays unchanged at the same right place
                          the existing cases now also check `kind` (changed / unchanged / leftEmpty)
                        threadField.test.ts
                          "each row is a block widget after its place's line, in row order; an empty side's rows sit above the next line"
                            — place 0, place 2 before line 3 (from 8, side −2), and the end of a text without a last newline falls back
                            to after the last line
                          "an empty side's rows sit above the next line only in the empty column"
                        compareFrame.test.ts
                          "a removed line's row in a pure deletion grows both band edges by the row" — left {400, 540}, right {400, 500}
                            (100 px row); follower scrollTop 150 when the leader is at 150
                        rangeThreads.browser.test.ts (never run, see open_risks)
                          a pure-deletion band with a 200 px box: both edges and the follower's scrollTop
                          a field left by a press outside every box is not focused again
                          an added file's empty left column and the trailing empty line start no thread
smoke_evidence          pnpm -C frontend typecheck → "$ vue-tsc -b", no errors
                        pnpm -C frontend lint → "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"", exit 0
                        pnpm -C frontend test → "Test Files  167 passed (167)  Tests  2128 passed (2128)"
                        pnpm -C frontend fmt:check → "All matched files use the correct format."
                        Hand mutations, each reverted (the reverts restored the original file tags):
                          M1 pressedLine `line < gitLines` → `line < doc.lines`: × "a press on the empty line after a text's last
                             newline…", × "an added file's empty left column has no line to press"
                          M2 shownLine unchangedOnLeft returns line.right: × "the count mark counts open and collapsed threads…"
                          M3 rowDecorations puts empty-side rows before a line only at place 0: × "each row is a block widget…"
                          M4 columnSpan always uses rangeSpan: × "a removed line's row in a pure deletion grows both band edges by the
                             row". In MiniBrowser the right band collapses to a point {304, 304], and below the deletion the follower
                             is at 7800 instead of 7960 for leader 8000.
                          M5 gapAfter always gives "changed": × "a removed line in a pure deletion places its row on the right's empty
                             side", × "rows at one place keep their order by the other column's place"
                          M6 no pointerdown listener (MiniBrowser): left field → {"afterPress":"BODY","focused":true,"active":"TEXTAREA"}
                          M7 no observe loop in the ThreadHosts constructor (MiniBrowser): vars {"width":"","left":""}
                        MiniBrowser probe (`just app-session start-fixture --name rvthr1 --range-case review`; its own WebKitWebDriver
                        on port 43731; throwaway /tmp/rvthr1/probe.mjs). The probe uses its own texts: 800 lines with right lines
                        300–301 removed, an open removed-line thread on left line 301, a 200 px box, line height 20:
                          deletion atBand {"band":{"left":{"top":304,"bottom":544},"right":{"top":304,"bottom":504}},
                                           "leftScrollTop":5700,"rightScrollTop":5700,"rows":[200,200],"hostHeight":200,
                                           "line295":{"left":244,"right":244}}
                          above the deletion {"leftScrollTop":3000,"rightScrollTop":3000}
                          below the deletion {"leftScrollTop":8000,"rightScrollTop":7960}   (the two removed lines' 40 px only)
                          added-file presses: left "1", right "3", right "2" → [{"kind":"added","right":1}]
                          left field {"afterPress":"BODY","focused":false,"active":"BODY"}
                          kept field {"afterPress":"TEXTAREA","focused":true,"active":"TEXTAREA"}
                        Round-1 probe re-run (/tmp/rvthreads/probe.mjs) for item 5 and no regressions:
                          grow moved {"left":200,"right":200,"band":200}, cells [200,200]; typing value "hello", findBars [0,0], both docs
                          unchanged; scroll back sameHost true, focused true, value "hello"; sideways host 46.40625 → 46.40625;
                          presses started [{"kind":"unchangedOnLeft","left":4,"right":4}], toggled [["thread-1"]]
                        Compare window unchanged: HEAD's frontend (`git archive HEAD frontend`, served by vite on :5199) against this
                        tree, `?diff=` each case's band `d` paths plus scroll → "json-payload identical", "words identical",
                        "typescript identical". The words case's empty-side bands, e.g. "M0 104 … L38 104 …", are among them.
deviations_from_brief   - Item 1's check is a pure exported `pressedLine(doc, from): number | null` in threadNumbers.ts, which the
                          `mousedown` handler calls, instead of an inline `line >= gitLines(doc)`. That way the rule has node tests.
                        - Item 3 needs to know which column of a row is a difference's empty side, so `ThreadRow.unchanged: boolean`
                          became `kind: RowKind`. `sitsBeforePlace(row, column)` lives in threadRows.ts. `threadAnchors` filters
                          `kind === "unchanged"`.
                        - `textBlock` moved from threadField.ts to compareFrame.ts (exported), so `columnSpan` and `threadAnchors`
                          share it. threadField's import from compareFrame was type-only and is now a value import; no cycle.
                        - `columnSpan` also handles an empty range at a document end with no last newline: from the text's bottom to the
                          block's bottom, with a fallback row placed after the last line. Without widgets this is the old point, and
                          the compare-window paths are unchanged.
                        - rangeThreads.browser.test.ts: `opened()` now takes a `ProbeCase` (default: the old modified case), and the
                          new `bandEdges`/`lineNumber` helpers were added.
                        - The `NO_EVENTS` default is still in place: making `events` required is row 20's job, as the brief says.
open_risks              - frontend/src/editor/internal/compareFrame.ts:35-45: at the end of a text with no last newline, a pure
                          deletion's empty-side rows fall back to after the last line, together with an unchanged row on that last
                          line if one exists. The empty span then also covers that unchanged row, so the band's right top is off by
                          that row's height. It needs a thread on the last line of a file with no trailing newline, right before a
                          deletion at the end.
                        - frontend/src/editor/rangeThreads.browser.test.ts: never run in Playwright WebKit (MiniBrowser cannot load
                          libicudata.so.74, #423/#1074). Its new waits and the path-number positions in `bandEdges` (1, 7, 9, 15 of
                          `bandPath`) were proven only through the MiniBrowser probe.
                        - frontend/src/editor/internal/threadHosts.ts:140-146: any press outside the hosts forgets the field, including
                          a press on a toolbar button that keeps focus in the field (preventDefault on mousedown). Restoring focus after
                          scrolling then no longer applies to that field.
```