# Implementer report V0EditorFindDragR2

## deviations_from_brief
[
  "How the space on top is added and removed: `find.ts` defines a `showFindSpace` StateEffect and a `findSpace` boolean StateField. The field gives the editor the class `find-space` through `EditorView.editorAttributes`, and the theme rule `&.find-space .cm-content { paddingTop: FIND_BAR_HEIGHT_PX }` adds the space. CodeMirror reads the content padding as `documentPadding.top`, and the gutters, `documentTop`, the strips and scroll sync already use it. `MergeController.#repaint` asks for a frame when `searchPanelOpen` changes in any pane. Each frame, `#showFindSpace` checks whether any of the three panes has its bar open and sends `showFindSpace` to every pane whose field differs. So all three panes get the space together, and closing the last bar removes it from all three.",
  "The bar now has a fixed height of 29px (box-sizing border-box, same as its natural height), so the space and the bar use one constant and nothing is measured. The `.cm-panels.cm-panels-top` overlay rule moved from `pane.ts` `darkTheme` into a `findTheme` inside `find.ts`, next to the only users of `FIND_BAR_INSET_PX` and `FIND_BAR_HEIGHT_PX`. The `.cm-panels` colours stay in `pane.ts`.",
  "The space replaces CodeMirror's default 4px top padding instead of adding to it, so with the bar open line 1 starts exactly at the bar's bottom edge.",
  "`editor/index.ts` now imports `searchPanelOpen` from `@codemirror/search`, a package that is already on the closed dependency list.",
  "#448: `statusAfter` was deleted. A new `chosenAction(target, spans, action)` returns `{ changes, effects }`: `chainedChanges` for apply, and an empty ChangeSet plus `statusAfterIgnore` effects for ignore. The `setStatus` effect built for each throwaway click is the same object returned to the caller.",
  "`apply.test.ts` `synthetic` got an optional `remote` range, defaulting to `side`, so the sides.test.ts setup (local and remote ranges differ) can be used without changing other tests.",
  "Not done: docs. CM7 in `skill://cm6-rules` still says the throwaway update is made \"with its setStatus\", which is still true, so I propose no wording change. Plan §2 #44 and architecture.md are outside Owned and were not edited; the orchestrator may want to mention the space above line 1 there."
]

## open_risks
[
  {
    "location": "frontend/src/editor/index.ts (#showFindSpace in #requestFrame)",
    "risk": "The 'any bar open' decision only runs with real EditorViews, so it has no node test (`openSearchPanel` needs a view, and the panel toggle effect is not exported). The WebKit smoke covers it, and `pnpm test:browser` does not run on this host (#423)."
  },
  {
    "location": "frontend/src/editor/internal/find.ts (FIND_BAR_HEIGHT_PX = 29)",
    "risk": "The fixed bar height is the current natural height: 3px padding + 22px buttons + 3px padding + 1px bottom border. If `.find-bar` CSS in theme.css changes, the contents could overflow the fixed panel; the space would still match the panel itself."
  },
  {
    "location": "frontend/src/editor/index.ts (#requestFrame)",
    "risk": "When the bar opens while a pane is scrolled, each pane's lines move by 25px (29 minus the default 4). All three move together, so they stay aligned (smoke: scrollTops unchanged, open vs closed identical), but the visible text jumps slightly on open and close."
  }
]

## smoke_evidence
[
  {
    "command": "pnpm -C frontend lint && pnpm -C frontend test && pnpm -C frontend fmt:check && pnpm -C frontend unused && pnpm -C frontend sfc-order && echo ALL-GREEN",
    "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" / Test Files  29 passed (29) / Tests  296 passed (296) / All matched files use the correct format. Finished in 421ms on 97 files / $ knip --include exports,types / $ tsx scripts/check-sfc-order.ts / ALL-GREEN"
  },
  {
    "command": "pnpm -C frontend exec vue-tsc -b 2>&1 | grep -c 'src/editor/'",
    "observed": "0. The remaining typecheck error is src/ipc/fixture.ts(88,3) TS1360, missing 'deleted', which belongs to the other task."
  },
  {
    "command": "just webdriver 4591 + pnpm -C frontend dev --port 5391 --strictPort + node /tmp/yamt-smoke-3e-r2/smoke.mjs (MiniBrowser, WebKitGTK; fixture language-tools-script-setup.ts)",
    "observed": "Bar closed at the top: contentPaddingTop [4px,4px,4px], line1OffsetInDoc [4,4,4], maxDriftPx 0.\nCtrl+F in the right pane: findSpaceClass [true,true,true], contentPaddingTop [29px,29px,29px], line1OffsetInDoc [29,29,29], bar height 29, maxDriftPx 0.\nTyped 'import' (line 1 of the right pane): count '1 of 31', matchLineInDom 1, scrollTop 0. Match top 102.09, bar bottom 101.5, matchBelowBar true, overlaps false, topmostAtMatchCentreIsMatch true.\nBar open, middle scrolled to 925: scrollTops [925,925,925]. Right scrolled to 1425: scrollTops [1388,1425,1425].\nEscape: findSpaceClass [false,false,false], paddings back to 4px.\nBar closed, middle at 900 and right at 1400: 'open (+space) vs closed, middle source identical: true' and 'right source identical: true'. Drift (36.375 and 37), sample row tops and relative scrollTops are the same with the bar open and closed, so that drift comes from scroll sync between chunks and not from the bar.\nScreenshots: /tmp/yamt-smoke-3e-r2/find-open-line1-match.png (line-1 'import' highlighted just below the bar; numbers 1..47 on the same rows in all three panes), find-open-middle-scrolled.png, find-open-right-scrolled.png, find-closed.png, find-closed-middle-scrolled.png.\nThe driver and dev server were stopped; pgrep shows nothing left."
  }
]
