# Implementer report V0EditorFindDragR1

## deviations_from_brief
[
  "How the overlay is built: still the @codemirror/search panel (our `FindPanel`, `top = true`). `darkTheme` in `pane.ts` turns `.cm-panels.cm-panels-top` into an absolutely positioned box (`position: absolute; left: auto; right: 16px; max-width: calc(100% - 32px)`, a border and rounded bottom corners) inside `.cm-editor`, which CodeMirror's base theme already positions relatively. The panel box no longer takes flex space, so the scroller keeps its size and position. CodeMirror's own panel scroll margin (`PanelGroup.scrollMargin`: the panel's bottom minus the scroller's top) now equals the bar's height, so `scrollIntoView` keeps the current match below the bar. No new JS was needed. `.find-field` gets `width: 200px` as its preferred width; it can still shrink.",
  "CM7 wording for the orchestrator (cm6-rules). The phrase \"original coordinates\" no longer holds. Suggested text: \"[CM7] An action over several changes (drag, bulk apply) builds each change on the document the previous ones produced: a throwaway `state.update` per change (that change plus its `setStatus`, so chunkField maps the spans exactly as a click would), composed into one ChangeSet passed in its action step. The text and spans equal clicking one by one, and the whole action is one undo step.\" The CM6 note on the replacement range should also say the range is the chunk's span after the earlier changes of the same action.",
  "`chainedChanges` in `apply.ts` is used by both `actionSteps` (drag or click) and `bulkApplySteps` (apply all non-conflicting), so changes are built one way only. Bulk apply was not named in #435.",
  "#425: `coveredField` is now exported from `covered.ts`. `MergeController.#showCovered` compares against `views.left.state.field(coveredField)`, and the `#covered` member is deleted.",
  "#434: the platform comes from `navigator.platform`, read once per side pane when the extension is built, and tested with `/Mac/` — the same test as @codemirror/view's `browser.mac`. Decision left open by the brief: a click with both Ctrl and Cmd held does nothing on any platform.",
  "#436: the pure function is `labelOutdated(before, after)`. It returns true when the document object is different, the selection differs (`selection.eq`) or the search query differs. `FindPanel.update` calls it with `update.startState` and `update.state`.",
  "#437: the signature is `openBlockAt(states, { side, doc: Text, pos })`. The mousedown handler passes `lineBlockAtHeight(height).from`.",
  "#429: the hex value of `--color-search-match: #2d543f` is my [INFERENCE] of the JetBrains New UI dark search-result tint; I did not check it against the IDE's colour scheme file. The palette test passes.",
  "#432: the CP1 comment is at `find.ts:162-163` (\"Mod-f on an open bar refocuses the element carrying this attribute (@codemirror/search openSearchPanel → getSearchInput).\"). It is checked against `node_modules/@codemirror/search/dist/index.js:997-1018`.",
  "#431: `top: true` was removed from the `search({...})` call. `FindPanel.top = true` stays, because CodeMirror uses it to place our panel in the top group, which the overlay CSS targets.",
  "The worktree had no `node_modules`; I ran `pnpm -C frontend install --frozen-lockfile --prefer-offline`. `package.json` and the lockfile are unchanged.",
  "The smoke script is outside the tree at /tmp/yamt-smoke-3e-r1/smoke.mjs, next to its screenshots. A stale screenshot from an earlier failed run (`find-open-scrolled.png`) was deleted."
]

## open_risks
[
  {
    "location": "frontend/src/editor/internal/pane.ts:57-65",
    "risk": "When a match is on one of the first lines and under the bar horizontally, the pane cannot scroll it down: scrollTop is already 0. A long line 1 or 2 with the match near its right end stays under the bar. VS Code avoids this by adding extra space at the top (addExtraSpaceOnTop), but that would shift this pane's lines against the other two, so it was not done."
  },
  {
    "location": "frontend/src/editor/internal/pane.ts:60",
    "risk": "`right: 16px` assumes a classic scrollbar about 16px wide. With overlay scrollbars the gap is purely visual; with wider scrollbars the bar could cover part of the scrollbar."
  },
  {
    "location": "frontend/src/editor/internal/apply.ts:63-79",
    "risk": "`chainedChanges` runs one throwaway update of the middle pane's state per change, so every middle-pane extension runs that many times. This is fine for drags and the fixtures, but an apply-all on a file with hundreds of non-conflicting changes was not timed."
  },
  {
    "location": "frontend/src/editor/internal/sides.test.ts:355-374",
    "risk": "Not observed: I did not run the new #435 test against the round-1 code, because git write commands are not allowed. That it fails on the old one-call `state.changes([...])` rests on the review's reproduction (composed 'a\\nB\\n')."
  },
  {
    "location": "/tmp/yamt-smoke-3e-r1/*.png",
    "risk": "The WebKitGTK paint artifact from round 1 is still there: strip bands and parts of panes scrolled by scroll sync can look unpainted in the screenshots. The alignment numbers come from DOM rects, not from pixels."
  },
  {
    "location": "frontend/src/editor/internal/modClick.ts:35",
    "risk": "`navigator.platform` is deprecated. It is what CodeMirror uses, and WebKit still supplies it, but if WebKit ever stops, Ctrl would count everywhere, including macOS."
  }
]

## smoke_evidence
[
  {
    "command": "pnpm -C frontend lint",
    "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"\nlint exit 0"
  },
  {
    "command": "pnpm -C frontend typecheck (tail) ; pnpm -C frontend exec vue-tsc -b 2>&1 | grep -c 'src/editor/'",
    "observed": "Fails as the brief expects, only in ipc/:\nsrc/ipc/fixture.ts(88,3): error TS1360 … Property 'deleted' is missing … 'SchemaOf<FileMergeData>'.\nsrc/ipc/fixture.ts(96,21): error TS2345 … Property 'deleted' is missing …\nsrc/ipc/tauri.test.ts(20,7): error TS2741: Property 'deleted' is missing …\nsrc/ipc/tauri.ts(25,5): error TS2322: Type '() => Promise<{ status: \"ok\"; data: FileEntry[]; } | …>' is not assignable to type '() => Promise<FileEntry[]>'.\n[ELIFECYCLE] Command failed with exit code 2.\nCount of errors in src/editor/: 0"
  },
  {
    "command": "pnpm -C frontend test",
    "observed": "Test Files  29 passed (29)\n      Tests  294 passed (294)"
  },
  {
    "command": "pnpm -C frontend fmt:check",
    "observed": "All matched files use the correct format.\nFinished in 436ms on 97 files using 24 threads."
  },
  {
    "command": "pnpm -C frontend unused ; pnpm -C frontend sfc-order",
    "observed": "$ knip --include exports,types   (no findings)\n$ tsx scripts/check-sfc-order.ts   (no findings)"
  },
  {
    "command": "pnpm -C frontend dev --port 5291 --strictPort; just webdriver 4491 (\"test-screen: test windows go to Samsung (HDMI-A-1, KWin screen 0, at 2600,40)\"); node /tmp/yamt-smoke-3e-r1/smoke.mjs — find bar (MiniBrowser, 1600x1000, fixture language-tools-script-setup.ts)",
    "observed": "Right scroller before opening the bar: {\"top\":72.5,\"height\":891.5}, scrollTops [0,0,0], maxDriftPx 0 over 28 unchanged rows.\nClick the right pane, Ctrl+F, type \"const\": bar {\"left\":1224.6,\"right\":1584,\"top\":72.5,\"bottom\":103,\"count\":\"1 of 47\"}. Right scroller still {\"top\":72.5,\"height\":891.5}; scrollTops [406,406,406]; the sample unchanged lines sit at the same y in all three panes (161.5625, 197.9375).\nEnter → \"2 of 47\".\nBar open, middle scrolled to 900: scrollTops [900,900,900]; sample rows aligned (85.875, 104.0625); scroller unchanged.\nBar open, right scrolled to 1400: scrollTops [1363,1400,1400].\nEnter: current match at {\"top\":526.2,\"bottom\":543.2}, bar {\"top\":72.5,\"bottom\":103}, overlaps false, \"3 of 47\".\nEscape: bar null; scroller {\"top\":72.5,\"height\":891.5}; scrollTops [824,824,824]; rows aligned (89.125, 107.3125).\nControl run with the bar closed, same two scrolls: \"open vs closed identical: true\" (same scrollTops and the same sample row y values). maxDriftPx was also equal open vs closed (36.375 and 37); that is existing scroll-sync interpolation near changes of different sizes, unrelated to the bar.\nScreenshots: /tmp/yamt-smoke-3e-r1/find-open.png, find-open-middle-scrolled.png (bar open after a scroll, lines 50–98 on the same rows in all three panes), find-open-right-scrolled.png, find-closed.png"
  },
  {
    "command": "same smoke run — drag, one Ctrl+Z, Ctrl+click",
    "observed": "left apply icons visible: 3, summary: 3 changes · 1 conflict\nHolding after a drag from the first to the third icon: {\"coveredIcons\":3,\"coveredLeftLines\":5}\nReleased: left apply icons visible: 0, summary: 1 conflict\nOne Ctrl+Z: left apply icons visible: 3, summary: 3 changes · 1 conflict\nPlain click on a tinted left line (\"`import('${vueCompilerOptions.lib}').Ext\"): summary unchanged, 3 changes · 1 conflict\nCtrl+click on the same line: left apply icons visible: 2, summary: 2 changes · 1 conflict\nScreenshots: /tmp/yamt-smoke-3e-r1/drag-highlight.png, after-drag.png, after-undo.png, ctrl-click.png\nThe dev server and WebDriver services are stopped; pgrep for WebKitWebDriver, MiniBrowser and vite --port 5291 finds nothing."
  }
]
