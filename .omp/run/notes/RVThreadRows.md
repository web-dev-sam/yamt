Thread rows now sit inside both read-only range columns, and every acceptance item was observed, with two caveats. The probe file itself has never run: Playwright WebKit cannot launch here, so its checks ran in MiniBrowser. Second, `RangeController` gives `events` a default no-op so the tree still compiles; row 20 should pass real events and remove that default.

```
summary                 Range threads are block rows in both read-only columns: `anchorAt` turns a pressed line into a ThreadLine;
                        `threadRows` groups threads by aligned place; one shared `threadField` gives each row a block widget per column,
                        filled with persistent hosts that Vue will use.
                        `ThreadHosts` sizes each row to the larger column (ResizeObserver, then `requestMeasure`), keeps rows still under
                        horizontal scroll and gives focus back to a field after CodeMirror redraws it.
                        Line numbers carry a count badge and a hover comment icon, and a press reports `startThread` or `toggleThreads`.
                        `CompareFrame` now takes `{ views, strip, fields, anchors }` and merges extra anchors, sorted. The compare window
                        passes `[differenceField]` and `() => []`, and behaves as before.
files_changed           new: frontend/src/ipc/threadLine.ts
                             frontend/src/editor/internal/{threadAnchor,threadRows,threadField,threadWidget,threadHosts,threadNumbers}.ts
                             frontend/src/editor/internal/{threadAnchor,threadRows,threadField,threadNumbers}.test.ts
                             frontend/src/editor/rangeThreads.browser.test.ts
                        changed: frontend/src/editor/{range,index,compare}.ts, frontend/src/editor/internal/compareFrame.ts,
                             frontend/src/editor/internal/compareFrame.test.ts, frontend/src/editor/theme.css (the .markdown-* rules kept;
                             thread rules added at the end), frontend/src/editor/AGENTS.md, frontend/src/ipc/index.ts
tests_added             The design's 13-row editor table. Each test was checked once with its hand mutation (results under smoke_evidence):
                        threadAnchor.test.ts
                          "a left line inside a modified difference is removed"
                          "an unchanged right line after two differences pairs with its left line"
                          "a line just past a pure insertion is unchanged, the last inserted line added"
                        threadRows.test.ts
                          "a removed line's gap sits after the difference's right lines"
                          "an unchanged line's threads from both columns share one row"
                          "rows at one place keep their order by the other column's place"
                          "collapsed threads place no row, drafts do"
                          "a row's height is the larger column's sum"
                        threadField.test.ts
                          "a row widget with the same keys eqs the old one, so its DOM is kept when heights change"
                          extra: "each row is a block widget after its place's line, in row order; place 0 sits above line 1"
                            (positions and sides)
                        threadNumbers.test.ts
                          "the count mark counts open and collapsed threads shown in this column, not drafts"
                          "a press on the badge reports the line's keys; a press on the number starts a thread"
                        compareFrame.test.ts (the existing test kept, its fake given `type`, `fields` and `anchors`)
                          "an unchanged-line row adds the lines around it as anchors in both columns"
                            (`threadAnchors` values over joined [text, widget] blocks, then the follower lands at 210, not 166.67)
                          "merged anchors stay sorted in both columns"
                        rangeThreads.browser.test.ts: the four acceptance checks, plus number press → startThread and badge press →
                          toggleThreads.
smoke_evidence          pnpm -C frontend typecheck → exit 0
                        pnpm -C frontend lint → exit 0, nothing reported
                        pnpm -C frontend test → "Test Files 166 passed (166)", "Tests 2106 passed (2106)"
                        pnpm -C frontend fmt:check → "All matched files use the correct format."
                        pnpm -C frontend sfc-order → exit 0
                        pnpm -C frontend unused → fails only on RangeSideLabel (ipc/index.ts:92, rangeDomain.ts:6), which was there before
                          this slice and is not mine.
                        Hand mutations (vitest run --project node <file>); each failed its test, and every file was restored (tags back
                          to the originals #1B31, #9A00, #0739, #54D9, #718C):
                          1  threadAnchor `line < start + len` → `line < start`: × "a left line inside a modified difference is removed"
                             (and × the pure-insertion test)
                          2  `offset +=` → `offset =`: × "an unchanged right line after two differences…"
                          3  `<` → `<=` at the end test: × "a line just past a pure insertion…"
                          4  gapAfter returns the unchanged pairing (line + 1): × "a removed line's gap sits after…"
                             (and × the order test)
                          5  row key = place + shown column: × "an unchanged line's threads from both columns share one row"
                          6  sort by left only: × "rows at one place keep their order…"
                          7  collapsed treated like open: × "collapsed threads place no row, drafts do"
                          8  Math.max → a + b: × "a row's height is the larger column's sum"
                          9  a height snapshot in the widget, compared in eq: × "a row widget with the same keys eqs the old one…"
                          10 drafts counted: × "the count mark counts open and collapsed threads…"
                          11 press branches swapped: × "a press on the badge reports the line's keys…"
                          12 extra anchors dropped from measure: × "an unchanged-line row adds the lines around it…"
                             (and × the sorted test)
                          13 no sort: × "merged anchors stay sorted in both columns"
                        WebKit probe: `vitest run --project browser src/editor/rangeThreads.browser.test.ts` → "MiniBrowser: error while
                          loading shared libraries: libicudata.so.74" (#423/#1074). The same checks were run in MiniBrowser instead
                          (`just app-session start-fixture --name rvthreads --range-case review` + `just webdriver`, throwaway
                          /tmp/rvthreads/probe.mjs; it imports /src/editor/index.ts in the page, builds a RangeController with 800 lines,
                          one difference and an open unchanged thread on line 3, and uses real WebDriver key and click actions):
                          grow   {"before":{"left":104,"right":104,"band":244},"after":{"left":304,"right":304,"band":444},
                                  "moved":{"left":200,"right":200,"band":200},"cells":[200,200],"hostHeight":200}
                          typing (textarea in the host; h e l l o, Enter, Backspace, then Ctrl+F)
                                 {"value":"hello","focused":true,"findBars":[0,0],"panels":[0,0],
                                  "leftUnchanged":true,"rightUnchanged":true}
                          scroll away {"scrollTop":10000,"rightScrollTop":10000,"connected":false,"active":"BODY"}
                          scroll back {"connected":true,"sameHost":true,"value":"hello","focused":true,"scrollTop":0}
                          sideways {"scrollLeft":300,"before":{"host":46.40625},"after":{"host":46.40625,"line":-253.59375},
                                    "vars":{"left":"46.40625px","width":"733.59375px"}}
                          presses {"started":[{"kind":"unchangedOnLeft","left":4,"right":4}],"toggled":[["thread-1"]],"count":"1",
                                   "gutterWidth":46.40625}
                          hover (`just app-session hover` on right line 7)
                                {"hovered":true,"content":"\"\"","width":"14px","colour":"rgb(129, 126, 141)"
                                 (= --color-fg-muted #817e8d),"gutter":46.40625}
                          Screenshots: /tmp/rvthreads/hover.png (icon beside 7), badge-zoom.png (badge "1" on line 3), grown.png,
                            sideways.png.
                        Compare window before/after, fixture `--diff-case words` and `--diff-case json-payload --size 1200x320`
                          ("before" = `git archive HEAD` of this tree's base, served from its own vite):
                          words, both trees: the same 5 band paths, character for character
                            ("chunk-modified chunk-band M0 4 C19 4 19 4 38 4 L38 24 …", …), bandLines [4,5], words 6, threadLines 0;
                            Ctrl+F → {"findBars":[0,1],"focused":"find-field"}; typing "the" → "1 of 13".
                          json-payload, both trees: bands identical; scroll left 140 → {"left":140,"right":120}; find "1 of 3".
                          Screenshots: /tmp/rvthreads/compare-{before,after}{,2}-{1,scrolled,find}.png. `magick compare -metric AE`
                            gives 0.4 % per pair, and the diff image (diff-1.png) covers only glyph edges. A 3× crop (ba.png) shows the
                            text, bands and word marks the same in both: the two MiniBrowser instances antialias text differently.
deviations_from_brief   - `RangeController`'s `events` argument defaults to a no-op (`NO_EVENTS`), so `ui/useRangeController.ts:129` and
                          `editor/range.browser.test.ts:119` still compile with three arguments. Row 20 should change
                          useRangeController.ts:129 to `new RangeController(texts, shown, { preferences }, events)`, wiring startThread
                          and toggleThreads to the store and hosts into a shallowRef. Then the default in range.ts should go.
                        - `destroy()` also calls `events.hosts(new Map())` when hosts existed, so ui drops its teleports. This is how
                          "drops every host" is reported.
                        - `threadRows(differences, shown)` takes the reply's `Difference`s, not "spans". It shares `linePlace` with
                          `anchorAt` (one rule for the anchor and for the gap).
                        - `ThreadRow` gains `key` (`"<left>:<right>"`, used by the widget's eq and by RowHeights) and `unchanged`
                          (which rows `threadAnchors` uses).
                        - Rows at place 0 use `side: index − rows.length` (all negative, ending at −1), not a flat −1, so several
                          rows above line 1 keep their order.
                        - There is one module-level `threadField`, not one per column. `ReadOnlyWiring.extensions` is shared by both
                          columns and compareViews.ts is not owned, so each column's `showThreadRows` payload carries its column, rows,
                          counts and the `RowCells` (ThreadHosts). The frame's list is `[differenceField, threadField]` as the contract
                          says.
                        - The unchanged-row anchors use the text part of a joined line block (`BlockInfo.type` array). CodeMirror's
                          `lineBlockAt` joins a line with the block widgets after it. For this, `compareFrame.ts` exports `LineBlock`,
                          and its `FrameView.lineBlockAt` returns `Span & { type }`.
                        - ipc/threadLine.ts adds `changedThreadLine(column, line)` and `unchangedThreadLine(column, { left, right })`,
                          both exported from ipc/index.ts. They brand through domain.ts's `isLeftLine`/`isRightLine` and throw
                          `invalid` otherwise, because the editor cannot create brands.
                        - The lucide raw SVG has no `xmlns`, so as a CSS mask it drew nothing (seen in MiniBrowser).
                          threadNumbers.ts adds the namespace before building `--thread-icon` (two-line CP1 comment).
                        - Focus return: ThreadHosts records focus inside its hosts (document `focusin`). When a field's host was
                          detached, or rebuilt into a new cell, it refocuses the field on the next view update, with `preventScroll`,
                          if focus fell to `<body>`.
                        - Shared docs this slice does not own and that are needed (`just map-check` already fails on the base for
                          range files):
                          .omp/skills/project-map/SKILL.md, frontend/src/editor entry: name threadAnchor, threadRows, threadField,
                            threadWidget, threadHosts, threadNumbers.
                          The frontend/src/ipc entry: name threadLine.ts (`ThreadLine`, `shownColumn`, `changedThreadLine`,
                            `unchangedThreadLine`).
                          frontend/src/ipc/AGENTS.md: one line on threadLine.ts.
                          cm6-rules CM15 (design D0) if not yet written.
                        - The probe ran in MiniBrowser through a throwaway script outside the tree. rangeThreads.browser.test.ts
                          exists as asked but has never run.
open_risks              - frontend/src/editor/rangeThreads.browser.test.ts: never run in Playwright WebKit. Its waits and selectors
                          (`.cm-lineNumbers .cm-gutterElement` with textContent "5", `.cm-thread-count`) were only proven through the
                          MiniBrowser script.
                        - frontend/src/editor/internal/threadHosts.ts `restoreFocus`: while a focused field's row is scrolled out of
                          the viewport, focus is on `<body>`. Keys typed then go to the window, and the ui's keydown guard sees `body`,
                          not a typing target. Focus comes back only when the row is drawn again.
                        - The same `restoreFocus` relies on `focusin` to forget the field. Clicking a non-focusable area does not
                          forget it, so if the field's row is redrawn later, focus returns to it.
                        - threadField.ts `threadAnchors`: the anchors around a row add nothing when both columns are measured exactly
                          (an unchanged region keeps a constant offset). The node test uses fake geometry to prove the frame uses them.
                        - Rows for added or removed lines next to a pure insertion or deletion: the insertion point of an empty side
                          sits below the widget, so that band edge starts at the row's bottom (an inference; not seen in MiniBrowser).
                        - theme.css `.cm-thread-count`: the badge sits in a 20 px left padding, so counts of three digits or more would
                          overflow it.
```

Checks for Main: `pnpm -C frontend test:browser src/editor/rangeThreads.browser.test.ts` on a machine where Playwright WebKit launches, then `just check` on the merged tree (`just map-check` stays red until the docs above are updated).