```
summary                 The scroll jump is fixed. When a column has an unchanged thread on the line just before a pure deletion or
                        insertion and a thread on a removed or added line, its rows no longer make the other column jump.
                        `threadField.ts` `topBelow` now measures the joined block's top (`view.lineBlockAt(doc.line(place + 1).from).top`)
                        instead of its text top. The empty side's rows now sit below the unchanged row's anchor, so the anchor no longer
                        shares a left value with the band-top anchor. Two new tests in compareFrame.test.ts pin this down, one for the
                        deletion and one for the insertion.
files_changed           frontend/src/editor/internal/threadField.ts
                        frontend/src/editor/internal/compareFrame.test.ts
tests_added             compareFrame.test.ts "an unchanged row on the line before a pure deletion keeps the scroll inside the band
                          continuous": unchanged row {20,20} plus a removed-line row {22,20} (rightEmpty, which sits before right line 21).
                          threadAnchors = [(400,400),(500,500)]. Left scrollTop 470 (middle 570, inside the band left {500,640} /
                          right {500,600}) gives right scrollTop 450.
                        compareFrame.test.ts "an unchanged row on the line before a pure insertion keeps the scroll inside the band
                          continuous": the mirror case, unchanged {20,20} plus an added-line row {20,22} (leftEmpty). The same anchors,
                          and right leading at 470 gives left 450.
                        Failing path: with the old text-top `topBelow` put back by hand, both tests fail (× ×, 2 failed | 4 passed).
                          The old anchor is (500,600) for deletion, which gives right 500 rather than 450.
smoke_evidence          pnpm -C frontend exec vitest run --project node compareFrame.test.ts threadField.test.ts → 2 files passed, 9 tests passed
                        pnpm -C frontend test → Test Files 168 passed (168), Tests 2151 passed (2151). This includes the round-1 tests
                          "a removed line's row in a pure deletion grows both band edges by the row" and "merged anchors stay sorted…",
                          plus the compare window's own frame test, whose spans are unchanged.
                        pnpm -C frontend fmt:check → "All matched files use the correct format."
                        pnpm -C frontend typecheck → only src/ui/problemText.ts(120,64) TS2366 (the known one)
                        pnpm -C frontend lint → only src/ui/problemText.ts:122:11 switch-exhaustiveness-check (the known one)
                        MiniBrowser: `just app-session start-fixture --name rvthr2 --range-case review` (this starts `just webdriver`
                          itself), then `just app-session read` with a throwaway /tmp script, which is now deleted. The script imports
                          /src/editor/index.ts in the page and builds a RangeController: 800 lines, lines 301–302 removed (and the
                          inserted mirror), an open unchanged thread on line 300, a thread on line 302, and 200 px boxes in each host.
                          It then moves the leader 2 px per step across the band, waiting 3 frames per step.
                          fixed, deletion (left leads): tops left 300:[5980,6200] 301:[6200,6220] 302:[6220,6440];
                            right 300:[5980,6200] 301:[6200,6420] (the row joined above the text) 302:[6420,6440]; rows [200,200,200,200];
                            maxExtraFollowerStepPx 0; samples [5950,5950] [5960,5959] [5970,5967] … [6000,5992] … [6190,6150] [6200,6160] [6230,6190]
                          fixed, insertion (right leads): the same tops mirrored, maxExtraFollowerStepPx 0, the same samples.
                          old code (text top back in, page reloaded) for contrast: maxExtraFollowerStepPx 198 in both cases;
                            [5950,5950] → [5960,6154], then the follower stays at 6154 until [6200,6160]. That is the jump.
deviations_from_brief   - I hand-reverted `topBelow` twice to prove the failing path (in node and in MiniBrowser). The fix was restored
                          both times, and the final file and recipe run above are on the fixed code.
                        - editor/AGENTS.md (read-only) still describes `threadAnchors` as "the text lines around each unchanged row". The
                          lower anchor is now the joined block's top of the next line. Suggested wording: "the text bottom above and the
                          next line's block top below each unchanged row".
open_risks              - frontend/src/editor/internal/threadField.ts:64: the next line's block top now includes every widget joined
                          before that line. Today only empty-side thread rows sit before a line (`sitsBeforePlace`). A future
                          before-widget on a non-empty column, such as a fold wave or another block decoration, would move this anchor
                          above that widget too.
                        - frontend/src/editor/rangeThreads.browser.test.ts: still never run in Playwright WebKit (#423/#1074). This
                          round added no browser test; the check was the MiniBrowser probe above.
```