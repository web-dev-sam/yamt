# KeyboardFocusBuildR2 — rework 2 report (commit 40d8601, base 75cebbc)

## summary

Fixed findings #607/#609, #610 and #608/#611. After a decision, the view now moves only when the focused side's mark points to a different change than before (a newly focused change). If the decision emptied the focused side, the keyboard moves to the other side (handover), which takes precedence over moving the view. A new pure helper `afterDecisionFocus` in navigation.ts makes this choice and has unit tests. `SideFocus.deciding(dispatch)` snapshots the focused side's mark and the chunk states before the dispatch. historyKey falls back to the physical key only when `key` is a single letter outside a–z, so Dvorak Ctrl+; (physical Z) no longer undoes. editor/index.ts is 296 lines.

## files_changed

[
  "frontend/src/editor/index.ts",
  "frontend/src/editor/internal/sideFocus.ts",
  "frontend/src/editor/internal/navigation.ts",
  "frontend/src/editor/internal/navigation.test.ts",
  "frontend/src/editor/internal/historyKey.ts",
  "frontend/src/editor/internal/historyKey.test.ts"
]

## tests_added

[
  {
    "name": "navigation.test.ts: after a decision that moved the focused side's mark on, the view reveals its new change",
    "proves": "mark moved (change 2 → change 5, and alone remembering 2 → change 5) with no handover → reveal. Failed on the 'never reveal' mutant."
  },
  {
    "name": "navigation.test.ts: after a decision on another change the mark stays and the view does not move",
    "proves": "mark unchanged (change 2 → change 2) → stay. This is the #607/#609 bug case. Failed with the old behaviour (reveal after every decision)."
  },
  {
    "name": "navigation.test.ts: after a decision that left the focused side alone the view does not move",
    "proves": "change 8 → alone, and alone remembering 2 → alone remembering 5 → stay. Failed with the old behaviour (reveal after every decision)."
  },
  {
    "name": "navigation.test.ts: a handover wins over revealing on the emptied side",
    "proves": "handover 'remote' → {kind:'handover', side:'remote'}, even when the mark moved. Failed on the mutant that only hands over when the mark did not move."
  },
  {
    "name": "historyKey.test.ts: a Latin layout's non-letter on the physical Z or Y never undoes: Dvorak Ctrl+; does nothing",
    "proves": "key ';' + code KeyZ → null; ':' + KeyZ + Shift → null; 'f' + KeyY → null. Failed with the old fallback (code for any non-Latin key). The 'я'/KeyZ and QWERTZ rows still pass."
  }
]

## smoke_evidence

[
  {
    "command": "pnpm -C frontend lint; pnpm -C frontend typecheck; pnpm -C frontend test",
    "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" → lint exit 0 / $ vue-tsc -b → exit 0 / Test Files  41 passed (41)  Tests  444 passed (444) → exit 0"
  },
  {
    "command": "just sfc-order; just web-unused; pnpm -C frontend fmt:check",
    "observed": "$ tsx scripts/check-sfc-order.ts → exit 0 / $ knip --include exports,types → exit 0 / fmt:check first flagged navigation.test.ts; after oxfmt on that file: \"All matched files use the correct format. Finished in 425ms on 125 files\""
  },
  {
    "command": "wc -l frontend/src/editor/index.ts",
    "observed": "296 frontend/src/editor/index.ts (sideFocus.ts 260, navigation.ts 159)"
  },
  {
    "command": "Fail-on-bug: afterDecisionFocus temporarily returns {kind:'reveal'} whenever there is no handover (the old behaviour); vitest run navigation.test.ts",
    "observed": "× after a decision on another change the mark stays and the view does not move / × after a decision that left the focused side alone the view does not move — Tests  2 failed | 16 passed (18)"
  },
  {
    "command": "Fail-on-bug: afterDecisionFocus temporarily returns 'stay' when the mark moved, and checks for a handover only after that; vitest run navigation.test.ts",
    "observed": "× after a decision that moved the focused side's mark on, the view reveals its new change / × a handover wins over revealing on the emptied side — Tests  2 failed | 16 passed (18). Fix restored afterwards."
  },
  {
    "command": "Fail-on-bug: letterOf temporarily falls back to `code` for any non-empty key (the old rule); vitest run historyKey.test.ts",
    "observed": "× a Latin layout's non-letter on the physical Z or Y never undoes: Dvorak Ctrl+; does nothing — Tests  1 failed | 5 passed (6). Fix restored, then 24/24 passed in both files."
  },
  {
    "command": "WebKit setup: pnpm -C frontend dev --port 5297 --strictPort + just webdriver 4497 (\"test windows go to Samsung (HDMI-A-1…)\"), MiniBrowser 1600×1000, fixture vueuse-use-magic-keys.ts. Every action was a real WebDriver pointer, key or wheel action at a rect read from the DOM; state was read through execute/sync.",
    "observed": "Session, dev server and driver were stopped afterwards; the /tmp client is deleted."
  },
  {
    "command": "Step 1: click A = c0 text (local 3), plain wheel on the left pane, click the local apply icon of B = c2 (local 54)",
    "observed": "after clicking A: active=left, markLeft {change,0}, focusLeft '3', scrollTop [0,0,0]. After the wheel: A visible false, B visible true at 0.96. Before B: scrollTop [120,120,120]. Icon local apply line 54 at (676,936). After: markLeft {change,0}, focusLeft '3', active=left, scrollTop [120,120,120] (before = after: true), B status {local:applied, remote:pending}, middleLen 4525→4521."
  },
  {
    "command": "Step 2: same, but Ctrl+click on B's text (local 54)",
    "observed": "before: scrollTop [120,120,120], markLeft {change,0}. After: markLeft {change,0}, focusLeft '3', active=left, scrollTop [120,120,120] (equal: true), B status {local:applied, remote:pending}, middleLen 4525→4521."
  },
  {
    "command": "Step 3: click A = c1 text (local 22), then A's own local apply icon at (676,474); the next waiting change c2 (local 54) is off screen",
    "observed": "next visible before: false. Before: markLeft {change,1}, focusLeft '22', scrollTop [0,0,0]. After: markLeft {change,2}, focusLeft '54', active=left, scrollTop [672,672,672]; line 54 visible at 0.33 of the pane height; A status {local:applied}."
  },
  {
    "command": "Step 4: click A = c1 text (local 22), press Enter",
    "observed": "next visible before: false. Before: markLeft {change,1}, scrollTop [0,0,0]. After: markLeft {change,2}, focusLeft '54', active=left, scrollTop [672,672,672]; line 54 at 0.33 of the pane height."
  },
  {
    "command": "Step 5a (rework 1 step 3): click local line 3, Enter ×6, ArrowLeft, click the remote apply icon of c8 (remote 141)",
    "observed": "after 6× Enter: active=right, markLeft alone{null}, markRight alone{null} (the keyboard moved over only when the left side emptied). ArrowLeft: active=left. Icon remote apply line 141 at (1164,275). After: active=left (kept), scrollTop [2036,2072,2363] unchanged, c8 status {local:applied, remote:applied}, middleLen 4495→4917."
  },
  {
    "command": "Step 5b (rework 1 step 4): scroll to c8, click local 129, ArrowRight, click middle line 140, Ctrl+click remote line 160 (no change)",
    "observed": "after ArrowRight: active=right, markRight {change,8}, focusRight '141-154'. After clicking the middle: active=center. After the Ctrl+click on 160: active=right, markRight {kind:alone, remembered:8}, focusRight '', middle unchanged: true."
  }
]

## deviations_from_brief

[
  "Added helper `afterDecisionFocus({ beforeMark, afterMark, handover: Side | null })` in navigation.ts. It returns a discriminated union `{kind:'handover', side} | {kind:'reveal'} | {kind:'stay'}` (module-private type `AfterDecision`), not the bare string union the brief gave as an example. The handover case carries its side, so `deciding()` can switch over it exhaustively without a second null check.",
  "Rename and signature change: `SideFocus.decided(before)` became `SideFocus.deciding(dispatch: () => void)`. SideFocus now takes both snapshots itself (chunk states and the focused side's mark) before calling the dispatch, as the brief allowed ('or have SideFocus snapshot it'). `MergeController.#decide` passes the dispatch as a closure and no longer reads the center field itself.",
  "The focused side is now found before the dispatch, not after. A center-pane dispatch does not move DOM focus. With no focused side, `deciding()` only dispatches, as before.",
  "historyKey.ts: added a constant `ANY_LETTER = /^\\p{L}$/u`. The CP1 comment now states why CodeMirror's keyCode fallback skips Dvorak's ';' (keyCode follows a Latin layout).",
  "WebKit run: a throwaway Node WebDriver client in /tmp (deleted afterwards). For steps 1–2, A = c0 (local 3) and B = c2 (local 54). For steps 3–4, A = c1 (local 22) and the next waiting change is c2 (local 54)."
]

## open_risks

[
  {
    "location": "frontend/src/editor/internal/sideFocus.ts:107-138 (deciding)",
    "risk": "In WebKit, drag-over-icons and remote-side icon decisions while the left side has a mark were not run as separate steps for #607 (only an apply-icon click and a Ctrl+click were). They take the same `deciding()` path."
  },
  {
    "location": "frontend/src/editor/internal/sideFocus.ts:109",
    "risk": "The focused side is read once, before the dispatch. If some future dispatch moved DOM focus between sides, the old focus would be used. Nothing does this today: the strips call preventDefault on mousedown, and a Ctrl+click has already focused its pane on mousedown."
  }
]

