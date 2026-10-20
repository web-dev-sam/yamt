```
summary
  - When the pointer leaves the handle with no drag running, useColumnDrag now resets lastTwoPressesAccepted to [false, false]
    (left(), frontend/src/ui/useColumnDrag.ts:108-113). A double-click whose first press landed outside the handle no longer
    counts an older accepted press, so it does not reset the split or the file-list width (#1287).
  - Two new node cases cover this: a fresh handle with one press, and a handle that the pointer has left.

files_changed
  frontend/src/ui/useColumnDrag.ts
  frontend/src/ui/useColumnDrag.test.ts

tests_added (useColumnDrag.test.ts)
  - "one accepted press on a fresh handle, then a double-click, does not reset": a fresh rig, one accepted click, then dblclick
    → 0 resets. This kills the idle-state mutant [false, true].
  - "leaving the handle forgets its presses, so a double-click begun outside it does not reset": accepted click, pointerleave,
    accepted click, dblclick → 0 resets. This kills removing the clearing in left().

smoke_evidence
  1. Recipes, in frontend/, on the final tree:
     - lint: "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"" → exit 0
     - typecheck: "$ vue-tsc -b" → exit 0
     - test: "Test Files 114 passed (114) / Tests 1561 passed (1561)" → exit 0
     - unused: "$ knip --include exports,types" → exit 0
     - fmt:check: "All matched files use the correct format. Finished in 803ms on 338 files" → exit 0
  2. Mutants, each a temporary edit that was then restored:
     - Clearing in left() removed:
         × leaving the handle forgets its presses, so a double-click begun outside it does not reset
         AssertionError: expected 1 to be +0  ❯ src/ui/useColumnDrag.test.ts:311:26
         Tests 1 failed | 20 passed (21)
     - Idle state [false, true]:
         × one accepted press on a fresh handle, then a double-click, does not reset
         AssertionError: expected 1 to be +0  ❯ src/ui/useColumnDrag.test.ts:300:26
         Tests 1 failed | 20 passed (21)
     - Restored: "Tests 21 passed (21)". The existing double-click cases are among them.
  3. WebKit fixture page (start-fixture r2-fx, 1600x964). Raw W3C actions went over curl to the session's driver. I logged events
     with capture listeners on document.
     - Before the fix (clearing temporarily removed, page reloaded):
       - Drag "Local and Result widths" --dx 30 → split {"local":0.4526582719057268,"remote":0.33332504630377763}.
       - Then press the gutter at x 862, then the strip svg at x 861, y 600.
       - Events: pointerdown d1 DIV 862, click d1, pointerdown d2 svg 861, click d2, dblclick d2 DIV 861.
       - Split after: {"local":0.3333333333333333,"remote":0.3333333333333333}. The bug reproduces in WebKit.
     - After the fix (page reloaded):
       - Drag --dx 120 → split {"local":0.42878629673826574,"remote":0.3333333333333333}.
       - One accepted press on the empty strip (828,600), pause 1000 ms, then the gutter (832,600), then the strip (831,600).
       - Events: pointerdown d1 svg 828, click d1, pointerdown d1 DIV 832, mousedown d1, click d1, pointerdown d2 svg 831,
         click d2, dblclick d2 DIV 831.
       - Split after: {"local":0.42878629673826574,"remote":0.3333333333333333}, unchanged.
     - Then click "Local and Result widths" --double → split {"local":0.3333333333333333,"remote":0.3333333333333333},
       widths [419,419,419].
     - Stopped: {"stopped":"r2-fx","session":"ended", webdriver and vite "stopped", folder removed}.

deviations_from_brief
  - Acceptance 2 says both new cases fail when the clearing is removed. Only the pointerleave case depends on the clearing, so
    only that one can fail that way. The fresh-handle case targets the [false, true] idle-state mutant, as #1287 asks, and I
    showed it failing against that mutant instead.
  - The second press of the WebKit double-click is on the strip's svg next to the gutter, not on text. The gutter is the Result
    pane's first column next to the strip, and #1287 names "pane text or gutter". The text starts too far away: WebKitGTK only
    counts a second click 1 px from the first. At 4 px apart (863 → 859) it gave "pointerdown d1", so no dblclick fired.
  - The clicks were raw W3C actions sent with curl to the driver from start-fixture (port 36549). `app-session click` sends
    one press pair per call, so it cannot make two presses at different points inside the double-click time.

open_risks
  - Every pointerleave with no drag now clears the remembered presses. A real double-click where the pointer crosses the
    handle's edge between its two presses no longer resets; it needs a pixel-level jitter at the edge.
    (frontend/src/ui/useColumnDrag.ts:108-113)
  - The WebKit double-click only fires at 1 px between the presses. Whether a user's real double-click behaves the same
    depends on GTK's double-click distance; I did not test this in the real app. [INFERENCE]
```

Main should run `just check` and `just mutants` on `frontend/src/ui/useColumnDrag.ts`.