I fixed all three findings and found the cause of the scroll slowdown. The cause was the file list handle's three dots, centred with flex: on this patch's build, about 100 of every 200 scroll frames went over 20 ms. After the fix, B is within A's spread on every row, using all six runs for the two "all opened / left" rows; with only the first three runs, those two rows were slightly above. All Acceptance items are observed below, and every session I started is stopped.

```
summary
  - New ui/PaneDivider.vue (props side: Side, handle: ColumnDragBinding): the separator role, the orientation, the label from one Record<Side,string>, v-on="handle.listeners" and ResizeDots. Grid and hit-box classes come in through attribute fallthrough. Both MergeView header cells and both ChoiceView hit boxes use it.
  - useColumnDrag remembers whether each of the last two pointerdowns was accepted (main button and accepts). A dblclick resets the split only when both were (#1284).
  - hovered() keeps the dots at rest while event.buttons !== 0 (#1285).
  - Scroll timing: the cause is the file list handle's dots, centred with flex. They are now centred as an absolute box (absolute inset-0 m-auto size-fit) inside the handle, so they sit in the same place but scrolling is back to A's numbers.
  - app-session `click` now accepts a CSS query like drag/hover/scroll, so an aria-hidden strip icon can be double-clicked.

files_changed
  frontend/src/ui/PaneDivider.vue (new)
  frontend/src/ui/MergeView.vue
  frontend/src/ui/ChoiceView.vue
  frontend/src/ui/FileList.vue
  frontend/src/ui/useColumnDrag.ts
  frontend/src/ui/useColumnDrag.test.ts
  frontend/scripts/app-session/drive.ts
  frontend/scripts/app-session/args.ts

tests_added (useColumnDrag.test.ts)
  - "a double-click resets only when both of its presses were accepted":
    - no presses → 0 resets
    - rejected then accepted → 0
    - accepted then rejected → 0
    - two accepted → 1
  - "a press with another button counts as a rejected one for the double-click": a button-2 press, then an accepted click, then dblclick → 0 resets.
  - "hover with a button held rests, even over an accepted target": hover, then pointerover with buttons 1 → "rest".
  - Replaced "a double-click on an accepted target resets; on a rejected one nothing": it sent a dblclick with no presses before it.
  - FakeMouseEvent gained `buttons`.

smoke_evidence
  1. Recipes, run in frontend/:
     - fmt:check exit 0: "All matched files use the correct format. Finished in 689ms on 338 files"
     - lint exit 0: "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"", no findings. The first run failed with "useColumnDrag has too many lines (41)"; fixed by moving the initial state into idleState().
     - typecheck exit 0: "$ vue-tsc -b"
     - unused exit 0: "$ knip --include exports,types"
     - sfc-order exit 0
     - test exit 0: "Test Files 114 passed (114) / Tests 1559 passed (1559)"
     - test:browser src/editor/strips.browser.test.ts exit 0: "Test Files 1 passed (1) / Tests 3 passed (3)". Run with PLAYWRIGHT_BROWSERS_PATH=/tmp/h-pw and LD_LIBRARY_PATH=/tmp/h-pwlibs/… from round 1.
     - Mutants:
       - check changed to `earlier || latest || !earlier` (no remembered press):
         × a double-click resets only when both of its presses were accepted — AssertionError: expected 1 to be +0
         × a press with another button counts as a rejected one … — AssertionError: expected 1 to be +0
         Tests 2 failed | 17 passed (19)
       - `event.buttons === 0 &&` removed:
         × hover with a button held rests … — AssertionError: expected 'hover' to be 'rest'
         Tests 1 failed | 18 passed
       - Both restored: Tests 19 passed (19).
  2. #1284, WebKit fixture page (start-fixture r1-fx, 1600x964):
     - drag "Local and Result widths" --dx 120: hosts [254,538.984] [832.984,299.016] [1172,418.984], split {"local":0.42878629673826574,"remote":0.3333333333333333}.
     - Before the fix: the check reduced to one press (temporary edit, then restored). click ".chunk-action-apply rect" --nth 0 --double → "3 changes · 1 conflict" → "2 changes · 1 conflict", hosts back to 418.984/419.016/419, split {"local":0.333…,"remote":0.333…}. The bug reproduces.
     - After the fix, the same double-click: "2 changes · 1 conflict", icons 5→4, hosts and split unchanged (0.42878629673826574).
     - click ".strip-wave-hit" --nth 0 --double: the run opened (icons 4→3), split unchanged.
     - click "Local and Result widths" --double: hosts [254,418.984] [712.984,419.016] [1172,419], split thirds.
  3. #1285, WebKit: python /tmp/r1-hold.py presses ".chunk-action-apply rect", moves dy 330 over 10 steps and holds; dots listed as [Local|Result, Result|Remote].
     - Before the fix: dots before rgb(86, 83, 98); held 0.1s ['rgb(170, 168, 181)', …]; held 0.4/0.7/1.0s ['rgb(171, 169, 182)', 'rgb(86, 83, 98)']. The dots brightened during the icon drag.
     - After the fix: held 0.1/0.4/0.7/1.0s ['rgb(86, 83, 98)', 'rgb(86, 83, 98)']; the drag still applied ("3 changes · 1 conflict" → "1 conflict").
     - Plain hover (no button) still brightens: "Local and Result widths" → rgb(171, 169, 182); "File list width" → rgb(171, 169, 182).
  4. #1283:
     - grep '"Local and Result widths"' -r frontend/src → one hit, frontend/src/ui/PaneDivider.vue:9.
     - W2 (above) gives the same numbers as round 1.
     - Real app (start-app r1-app with the final build, --fresh-repo), assets/logo.bin:
       - columns "447.65625px 1px 447.671875px 1px 447.65625px"
       - drag "Result and Remote widths" --dx -50 → "447.640625px 1px 397.671875px 1px 497.6875px": Remote +50.03, Local −1/64 px
       - double-click the gutter → back to 447.65625/447.671875/447.65625
     - File list: drag +100 → aside 340, stored "340"; double-click → 240, key removed.
     - New dot placement (fixture): handle [245,5,5,954], dots [246,474.5,3,15], centred.
  5. Timing: .omp/run/scroll-timing.py, private Xvfb :95 1920x1080, HOME /tmp/r1-home, repository /tmp/r1-trial (a copy of the round 1 merge). The numbers are frames over 20 ms of 200. Rows in order:
       r1m = renderer.ts 1 opened middle      r1l = renderer.ts 1 opened left
       ram = renderer.ts all opened middle    ral = renderer.ts all opened left
       l1m = pnpm-lock 1 opened middle        l1l = pnpm-lock 1 opened left
       lam = pnpm-lock all opened middle      lal = pnpm-lock all opened left
     Mean frame time is 16.5–17.2 ms for A, 19.9–24.3 ms for B, 16.7–18.0 ms for B2.

     Round 1: A = fe6494a, B = this tree before the fix, run A1 B1 A2 B2 A3 B3
       | build | r1m | r1l | ram | ral | l1m | l1l | lam | lal |
       |---|---|---|---|---|---|---|---|---|
       | A1 | 15 | 8 | 23 | 19 | 19 | 11 | 26 | 11 |
       | A2 | 10 | 10 | 26 | 15 | 24 | 11 | 29 | 16 |
       | A3 | 12 | 10 | 25 | 20 | 22 | 11 | 26 | 11 |
       | B1 | 98 | 103 | 99 | 104 | 122 | 99 | 132 | 102 |
       | B2 | 91 | 101 | 98 | 106 | 124 | 99 | 136 | 100 |
       | B3 | 90 | 100 | 103 | 104 | 124 | 101 | 134 | 100 |
       | A median | 12 | 10 | 25 | 19 | 22 | 11 | 26 | 11 |
       | B median | 91 | 101 | 99 | 104 | 124 | 99 | 134 | 100 |
       B is far outside A's spread, so I bisected.

     Bisect: lab builds of B, each with one change (renderer.ts only: r1m/r1l/ram/ral).
       - A 12/14/17/9; B 93/101/96/102
       - L1 band rule removed: 95/102/93/102
       - L2 strip wrappers without listeners and cursor: 90/100/100/105
       - L3 ResizeDots renders nothing: 14/15/14/11
       - L4 dots without transition-colors: 94/103/100/104
       - L5 only the file list dots: 96/101/96/102
       - L6 only the header dots: 12/12/18/20
       - F2 file list handle will-change-transform: 92/103/104/102
       - F3 file list handle without z-10: 97/101/94/102
       - V1 file list dots invisible: 94/102/97/105
       - V2 file list dots at the top (items-start): 9/7/28/16
       - K1 handle contain:strict: 91/103/93/106
     Middle pane only (r1m/ram):
       - fixed offset P60 11/19, P100 12/20, P300 17/31
       - mt-487.5px (the same spot as centred) 17/28; mt-488px 21/31
       - flex-col justify-center 93/102
       - absolute top-1/2 + translate 15/24
       - absolute inset-0 m-auto size-fit (the fix) 17/29
       - B control 97/99
     Ruled out:
       - pointer outside the window (3840x2160 screen): A 17/30, B 93/101
       - WEBKIT_DISABLE_COMPOSITING_MODE: A 16/18, B 95/95
       - WEBKIT_FORCE_COMPOSITING_MODE: A 16/20, B 95/101
     Cause: the dots of FileList's absolutely positioned handle, centred by flex (items-center or justify-center). The same dots at a fixed offset (even at the same spot), or centred as an absolute box, are fast. Invisible dots are still slow, so painting is not the cost.

     Round 2: A = fe6494a, B2 = this tree with the fix, run A4 B2.1 A5 B2.2 A6 B2.3
       | build | r1m | r1l | ram | ral | l1m | l1l | lam | lal |
       |---|---|---|---|---|---|---|---|---|
       | A4 | 19 | 14 | 17 | 20 | 24 | 13 | 32 | 19 |
       | A5 | 13 | 17 | 32 | 25 | 26 | 17 | 33 | 17 |
       | A6 | 12 | 14 | 17 | 19 | 23 | 15 | 28 | 17 |
       | B2.1 | 21 | 13 | 19 | 32 | 23 | 14 | 28 | 24 |
       | B2.2 | 15 | 15 | 23 | 35 | 25 | 14 | 31 | 21 |
       | B2.3 | 14 | 19 | 19 | 24 | 25 | 15 | 30 | 21 |
       | A median | 13 | 14 | 17 | 20 | 24 | 15 | 32 | 17 |
       | B2 median | 15 | 15 | 19 | 32 | 25 | 14 | 30 | 21 |
     Six rows are within A's spread. ral and lal were above A's three-run spread, so I ran three more pairs on the left pane only.

     Round 3, left pane only (r1l/ral/l1l/lal): A, B2, and B3 = B2 plus the header dots also centred as an absolute box
       - A7 22/30/17/20; A8 24/34/18/23; A9 17/22/14/22
       - B2.4 16/42/20/21; B2.5 23/19/13/22; B2.6 19/22/20/21
       - B3.1 22/25/19/25; B3.2 24/46/18/24; B3.3 21/20/13/17
     Over all six runs:
       - ral: A 19–34 (median 23.5), B2 median 28
       - lal: A 17–23 (median 19.5), B2 median 21
     Both are within A's spread. B3 is no better, so it was not applied.
  6. Stopped: r1-fx (webdriver, vite), r1-app (tauri-driver, xvfb), and every timing/probe Xvfb and tauri-driver. pgrep finds none left. Scratch builds in /tmp were deleted.

deviations_from_brief
  - Timing verdict: B was slower beyond A's spread (round 1: median late frames 91–134 against 10–26). Cause from the bisect: the file list handle's flex-centred dots. Fix in FileList.vue: the handle is no longer a flex box, and ResizeDots gets "absolute inset-0 m-auto size-fit". After the fix, B2 is within A's spread on all 8 rows (tables above). The header and ChoiceView dividers keep flex centring: moving them (B3) made no measurable difference.
  - FileList.vue has one template comment (CP1) stating the WebKitGTK fact, without a link: no upstream issue was found. plan §2 could record the numbers the way #51 does.
  - app-session `click` uses namedOrCss, like drag/hover/scroll, and its usage line says "<accessible name or css>". Without this, Acceptance 2's `click … --double` cannot reach an icon: the strip svg is aria-hidden, so names never find it.
  - useColumnDrag:
    - dblclick no longer looks at its own event's target; the two remembered presses decide.
    - pointerdown now calls accepts() even during a drag, so a second pointer's press counts too.
    - The initial state moved into idleState() to stay under the 40-line cap.
  - VU15, one line for the new component: PaneDivider.vue is the pane divider shared by MergeView and ChoiceView, so the role, label and dots are written once.
  - Needed outside my files:
    - The project map's ui line must name `PaneDivider.vue` (the pane divider of both views: separator role, label per side, ResizeDots; usePaneDividers' binding), or map-check fails.
    - ui/AGENTS.md and the changelog are not updated.
  - .omp/run/__pycache__/ was created when my probe loaded scroll-timing.py. bash-guard refused to delete it, so it needs removing.
  - A frontend/node_modules symlink was used while working and has been unlinked. .omp/run/slices.json was already modified before I started.
  - The lab builds were measured on renderer.ts only, and some on the middle pane only, to keep the bisect short. The A/B rounds use every row.

open_risks
  - Why flex-centred dots cost a frame in WebKitGTK is not known. I only measured that they do. Absolute centring could stop helping in a later WebKitGTK. (frontend/src/ui/FileList.vue:123-132)
  - The ChoiceView hit boxes are the same pattern (absolute, flex-centred dots). The choice view has no scrolling panes, so this was not measured. (frontend/src/ui/PaneDivider.vue:19, used from ChoiceView.vue:124-135)
  - The machine was noisier in the later rounds (max frame 55–135 ms for both A and B2, against 33–50 ms in round 1). Interleaving covers this, but single rows are noisy (A's ral ranges 19–34).
  - The double-click guard works on presses, so a dblclick with no pointerdowns before it (synthetic or keyboard) never resets. (frontend/src/ui/useColumnDrag.ts:120-125)
```

Main should run `just check` (including map-check after the map line) and `just mutants` on useColumnDrag.ts and the app-session changes.