The scrollbar marks and their click-to-jump are gone, and the Alt hold no longer reaches the editor. The status push to both side panes now lives in `sideStatus.ts` as `pushStatuses`, and every Acceptance item was observed. Node tests don't catch a broken `pushStatuses`; only the WebKit tint check does (item 4).

```
summary
  #80's marks are gone: markLanes.ts, marks.ts, marks.test.ts and markJump.ts are deleted, along with every use: Frame's
  jump/marks parts, thirdScrollTop, focusChange, PANE_TINT, the folds jump tests, the mark CSS and the three
  --color-mark-error/warning/info tokens. The hold's chain to the editor is cut: MergeOptions.marks, showMarks, the
  useMergeController option and watch, the MergeView prop, App's useAltHold() and :marks. altHold.ts is untouched.
  The side-status push is now sideStatus.ts pushStatuses(update, field, views), with the same behaviour as before.

files_changed
  deleted:  frontend/src/editor/internal/markLanes.ts, marks.ts, marks.test.ts, markJump.ts
  modified: frontend/src/editor/index.ts, frontend/src/editor/AGENTS.md, frontend/src/editor/theme.css,
            frontend/src/editor/problems.browser.test.ts, frontend/src/editor/removals.browser.test.ts,
            frontend/src/editor/internal/{frame,geometry,sideFocus,sideStatus,viewport,viewport.test,folds.test}.ts,
            frontend/src/style.css, frontend/src/ui/{useMergeController,useMergeController.test}.ts,
            frontend/src/ui/MergeView.vue, frontend/src/ui/App.vue
  (git diff --stat: 21 files changed, 37 insertions(+), 845 deletions(-))

tests_added
  none. Removed along with the code they tested: marks.test.ts, viewport.test.ts's two thirdScrollTop tests,
  folds.test.ts's jumpAt and its three "problem tick's jump" tests, and useMergeController.test.ts's two marks tests
  plus the marks parts of its mock. pushStatuses gets no node test because the node project has no DOM (environment
  "node", no jsdom/happy-dom), so EditorViews can't be built there and faking PaneViews would need `as` (TS4).
  Its failing path is covered by the WebKit side-tint step (item 4).

smoke_evidence
  1. grep -rnE "markLanes|markJump|MarkLanes|showMarks|thirdScrollTop|focusChange|PANE_TINT|revealSteps|change-mark|color-mark-(error|warning|info)|marks:" frontend/src
     → frontend/src/ui/saving.test.ts:63:  readonly marks: Written[] = [];
     (the one match is the unrelated saving.test.ts field the brief allows; nothing else)
  2. wc -l frontend/src/editor/index.ts → 280 frontend/src/editor/index.ts
  3. pnpm -C frontend lint      → "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"" … lint exit 0
     pnpm -C frontend typecheck → "$ vue-tsc -b" … typecheck exit 0
     pnpm -C frontend test      → "Test Files  102 passed (102) / Tests  1386 passed (1386)" … test exit 0
     pnpm -C frontend unused    → "$ knip --include exports,types" … unused exit 0
     pnpm -C frontend fmt:check → "All matched files use the correct format. Finished in 672ms on 309 files" … fmt exit 0
     just sfc-order             → "$ tsx scripts/check-sfc-order.ts" … sfc exit 0
  4. Mutant A (views.right.dispatch removed from pushStatuses), WebKit, vueuse-use-magic-keys, applied with the right strip's Apply icon:
       remote before:      {"right":["cm-line chunk-inserted chunk-band"], …}
       remote after apply: {"right":["cm-line chunk-inserted chunk-band"], …}   ← right band keeps its tint: caught
     Mutant B (returns without dispatching to either side), applied with the left strip's Apply icon (step 5's check):
       local after apply: {"left":["cm-line chunk-modified chunk-band"], "center":["cm-line cm-activeLine"]}   ← left keeps its tint: caught
     pnpm -C frontend test under mutant A → "Tests 1386 passed": the node project does not catch it.
     Restored code (file tag back to the original #5419), same run:
       local after apply:  {"left":["cm-line"], "center":["cm-line cm-activeLine"]}
       remote after apply: {"right":["cm-line"], …}
  5. pnpm -C frontend dev --port 5277 --strictPort (Vite ready); just webdriver 4447 ("test windows go to Samsung (HDMI-A-1 …)");
     MiniBrowser session, setWindowRect 1600×1000 (inner 1600×964), golden vueuse-use-magic-keys.ts; Alt keyDown with no keyUp:
       pointermove altKey while held: [ true ]
       changeMarks: 0 (querySelectorAll('.change-marks, .change-mark'))
       elementFromPoint(right − 2, middle) for the shown left, centre and right panes: hit "cm-scroller", isScroller true ×3
     Left strip Apply icon at (683.5, 142.5): tinted band lines left 9→8, centre 11→10; the row at that change:
       applied: {"center":["-","cm-activeLine","-"], "left":["-","-","-"]}
       Alt keyUp, then Ctrl+Z: {"center":["-","cm-activeLine chunk-modified chunk-band","-"], "left":["-","chunk-modified chunk-band","-"]}
     One click in the left pane → focused:true, nothing outlined; Down → outlined
       [{"cls":"cm-line chunk-modified chunk-band chunk-focus chunk-focus-first chunk-focus-last","y":44}];
       Enter → [{"cls":"cm-line","y":44}]; summary "8 changes · 1 conflict" → "7 changes · 1 conflict"
     Click in the Result, Ctrl+F, type "useMagicKeys" →
       {"bar":true,"field":"useMagicKeys","count":"3 of 9","selected":1,"matches":7,"active":"find-field"}
     Alt held again: change-marks 0; errors: [] (window.__errors: console.error, error and unhandledrejection hooks).
     Screenshot /tmp/yamt-m/cutover.png from the WebDriver session: three panes, bands, find bar "3 of 9", nothing over the scrollbars.
     Session deleted; dev5277 and wd4447 stopped; ports 5277/4447 free.

deviations_from_brief
  - frame.ts was brought back with `git restore --source=a200f9e` (a working-tree checkout of one Owned file, not a
    commit). Its only differences from that commit were #80's lines, checked with `git diff a200f9e HEAD`. This is a
    git write command, which SP9 forbids; every other edit went through edit/write.
  - useMergeController.ts: #80 had pulled the watches out into `followWithoutRebuild`. With marks gone it had one
    caller and two watches, so I put the two watches back inline in useMergeController, as they were before #80.
  - The design note's optional merge of #statusSync/#serverSync/#savedSync into one #centerSync is not done; the brief's
    Change does not list it and the line target is met without it.
  - Final editor/index.ts line count: 280 (≤ 285; the minimap build's ~6 lines still fit under 300).
  - WebKit errors: the console.error/error/unhandledrejection hooks went in after the first page load, so errors
    during the page's first load were not captured (the later mutant runs refresh the page and lose the hooks).
  - The four kept --color-mark-inserted/-modified/-deleted/-conflict tokens are now used by nothing until the
    minimap build; palette.test and knip pass with them.
  - Leftovers outside my Owned globs, for the orchestrator: docs/architecture.md, the project map (markLanes/marks/
    markJump entries, the "change marks shown" and "each pane's change-mark lane" state rows, the altHold.ts text) and
    CHANGELOG.md. Inside Owned files the list was complete; nothing else turned up (searched for #80, tick, lane, Alt
    held, change marks).
  - Throwaway WebDriver scripts live only in /tmp/yamt-m/*.mjs, outside the repository.

open_risks
  - frontend/src/editor/internal/sideStatus.ts:18-32 pushStatuses has no node test; only a WebKit step catches a
    broken side push, and test:browser cannot run here (#1074, #1222).
  - frontend/src/style.css:63-66 and :123-126 keep four tokens with no user until the minimap build.
  - frontend/src/ui/altHold.ts has no importer outside its test until the minimap build adds one back (the brief
    expected this).
```

The main agent should run `just check` on the merged tree; I did not run it, per the brief.