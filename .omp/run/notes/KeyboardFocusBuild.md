# KeyboardFocusBuild — implementer report (commit cc87209, base 19bf6ef)

## summary

Side panes now take keyboard focus. Which side holds the keyboard is the DOM focus. What each side points at is a `SideMark` field per side, kept up to date by the existing `showStatuses` push. The navigation rules are pure functions. A side-only keymap handles Enter/Space (apply), Backspace/Delete/x (ignore) and the arrows. `SideFocus` handles clicks, Ctrl/Cmd+wheel and scrolling a change into view. The outline is solid primary on the pane and inset on the focused change (3px bar for a zero-line change). `MergeController.historyKey` runs undo/redo for the shown file through a window keydown listener that only acts when the file is shown and no question is open. Two parts of the WebKit run could not be shown here (step 10 Ctrl+wheel, step 9 undo inside the find field); details below.

## files_changed

[
  "frontend/src/editor/index.ts",
  "frontend/src/editor/theme.css",
  "frontend/src/editor/internal/decorations.ts",
  "frontend/src/editor/internal/decorations.test.ts",
  "frontend/src/editor/internal/find.ts",
  "frontend/src/editor/internal/geometry.ts",
  "frontend/src/editor/internal/modClick.ts",
  "frontend/src/editor/internal/modClick.test.ts",
  "frontend/src/editor/internal/pane.ts",
  "frontend/src/editor/internal/side.ts",
  "frontend/src/editor/internal/status.ts",
  "frontend/src/editor/internal/navigation.ts",
  "frontend/src/editor/internal/navigation.test.ts",
  "frontend/src/editor/internal/sideMark.ts",
  "frontend/src/editor/internal/sideMark.test.ts",
  "frontend/src/editor/internal/sideFocus.ts",
  "frontend/src/editor/internal/sideFocus.test.ts",
  "frontend/src/editor/internal/viewport.ts",
  "frontend/src/editor/internal/viewport.test.ts",
  "frontend/src/editor/internal/wheel.ts",
  "frontend/src/editor/internal/wheel.test.ts",
  "frontend/src/editor/internal/historyKey.ts",
  "frontend/src/editor/internal/historyKey.test.ts",
  "frontend/src/ui/useMergeController.ts",
  "frontend/src/ui/MergeView.vue"
]

## tests_added

[
  {
    "name": "navigation.test.ts (13 tests)",
    "proves": "Down/Up pass over a side already decided (checked by hand: replacing isSideOpen with isResolved fails 10 of 13 tests). Down on the lowest and Up on the top-most return null. After deciding the lowest, the pick is the top-most still waiting, not the one above (checked by hand: an 'above' pick fails it). None left on that side gives null. Left/Right from a conflict half and from a change made the same way on both sides; Right from a local-only change uses the remembered change. fromScreen straddle, exact-edge and zero-line cases, both directions. stepAlone: no fallback when changes wait only above; falls back when the side has none waiting. changeAt: band by px span, zero-line within POINT_HIT_PX, never a decided side. handoverTo (the A2 rule): hands over only when nothing is left on the focused side, never to the hidden side."
  },
  {
    "name": "sideMark.test.ts (5 tests)",
    "proves": "Deciding the marked change moves the mark to the next waiting change below. A push that reopens changes (undo) leaves the mark. A remembered id decided while alone moves by rule 5 and the side stays alone. Deciding the last change gives alone with nothing remembered. setMark wins over showStatuses in the same transaction."
  },
  {
    "name": "viewport.test.ts (5 tests)",
    "proves": "No scroll for a fully visible change or zero-line point. A change below lands a third of the way down. A change that only fits lower ends two lines above the bottom. A tall change starts two lines below the top. A change near line 1 clamps at scrollTop 0, with and without find space."
  },
  {
    "name": "wheel.test.ts (5 tests)",
    "proves": "LINE/PAGE give one step per event. PIXEL: the first event of a burst steps, the next only after WHEEL_STEP_PX more. A direction flip or an idle gap starts a new burst that steps at once. One 500 px event gives one step. Mostly-sideways events never step."
  },
  {
    "name": "historyKey.test.ts (3 tests)",
    "proves": "Linux: Ctrl+Z undo, Ctrl+Shift+Z and Ctrl+Y redo, Meta+Z null. macOS: Cmd+Z undo, Cmd+Shift+Z and Cmd+Y redo, Ctrl+Z null. Alt, defaultPrevented and an INPUT/TEXTAREA target give null."
  },
  {
    "name": "sideFocus.test.ts: SIDE_KEYS table",
    "proves": "The exact key table; dropping Backspace (macOS Delete) or Delete fails it."
  },
  {
    "name": "decorations.test.ts: 3 focus tests",
    "proves": "A focused 8-line change (local 129–136) gets chunk-focus on every line plus -first/-last on its ends; a 1-line change gets both. A zero-line change gets chunk-focus-point on its marker line, above or below by the edge rule. A side alone draws nothing."
  }
]

## smoke_evidence

[
  {
    "command": "pnpm -C frontend lint; pnpm -C frontend typecheck; pnpm -C frontend test; just sfc-order; just web-unused",
    "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" (no findings) / $ vue-tsc -b (no errors) / Test Files 41 passed (41), Tests 436 passed (436) / $ tsx scripts/check-sfc-order.ts (exit 0) / $ knip --include exports,types (no findings). wc -l frontend/src/editor/index.ts → 295"
  },
  {
    "command": "pnpm -C frontend test:browser",
    "observed": "Did not launch: 'browserType.launch: Host system is missing dependencies to run browsers ... sudo apt-get install libicu74 libxml2 libflite1'"
  },
  {
    "command": "WebKit run, fixture mode (pnpm -C frontend dev --port 5287 + just webdriver 4487, MiniBrowser on the Samsung screen), vueuse-use-magic-keys.ts; real WebDriver pointer/key/wheel actions; DOM state only read via execute/sync",
    "observed": "1 click text of local 129: active=left, left outline 'solid rgb(53,116,240)', left chunk-focus on 129-136. 2 ArrowRight: active=right, right focus 141-154, solid outline. 3 Backspace: right bands no longer include 141-154, outline moved to 87 (top-most waiting remote, view revealed), middle 129-138 text unchanged: true. 4 Ctrl+Z: right bands '87,98-106,120-123,141-154' again, outline still 87, active right. 5 Down→98-106→120-123→141-154, Enter: middle 129-142 now holds the remote text (useEventListener(target,'keydown'…)…'focus', reset…), active right, outline moved to 87. 6 ArrowLeft→left 129-136; Down twice: focus 129-136 and scrollTop 2036 unchanged both times; Space: outline to 3 (top-most), scrollTop 0. 7 after the last left decision: active=right, right focus '' (alone); Down: right focus 98-106 (first at or below top, scrollTop 1764). 8 click local 125 (no change): Space and ArrowLeft leave scrollTops 1563/1563/1764; PageDown → 2196/2450/2523. 9 Ctrl+F, type 'use': field 'use', '19 of 21'; Ctrl+Z inside the field: not prevented by yamt, middle 120-150 unchanged: true, field still 'use' (see deviations); Enter: '20 of 21'. 10 plain wheel over right: right scrollTop 2249→2349, active stays left. Ctrl+wheel not reproducible (see deviations). 11 click middle: right focus lines' computed box-shadow 'none', left/right outline none; typing Q, Left, Left, W, Right, E edits line 153 ('    refs,' → '  W EQ refs,'); Ctrl+Z undoes one step in the middle only. 12 keyboard on left (focus 103-107): click its apply icon → bands drop 103-107, active stays left, outline moved to 115. Click middle, then click apply icon of 115 → applied, active=center. Ctrl+click local 131 → conflict local applied, active=center. Drag apply icon 22 → icon 54 → both applied (left bands '3'), active=center; one Ctrl+Z → '3,22,54' back. 13 open von, then nuxt; nuxt: click local 2, Enter (middle 1-6 changed), Ctrl+Z (back: true), Ctrl+Z again (unchanged: true); back on magic-keys: middle 1-60 unchanged: true. 15 vue-core-compiler-von.ts: click 1px under the top of remote line 19 (zero-line conflict side): point '19:chunk-focus-point chunk-focus-point-above', box-shadow 'rgb(53,116,240) 0px 3px 0px 0px inset'; Enter: middle lines 19-21 (fnExpRE …) removed (line 19 is now 'export interface VOnDirectiveNode…'), outline moved on to 84-85."
  },
  {
    "command": "Step 14 (read-only file): cargo tauri build --debug --no-bundle; scripts/conflict-repo.sh /tmp/yamt-test-kf; tauri-driver --port 4488 (WebKitGTK app); open docs/removed.md (deleted on one side, read-only)",
    "observed": "Click kept-side line 3: active=left, solid outline, line 3 'chunk-modified chunk-band chunk-focus chunk-focus-first chunk-focus-last'. Enter, then Backspace: left and middle lines identical before/after (band and 'base text' in the middle stay). Click line 1: outline gone (alone); Down: line 3 outlined again."
  },
  {
    "command": "Timing check on the non-passive wheel listener: 20 plain wheel ticks over the left pane (listener) and 20 over the middle (none); wheel → next scroll event latency",
    "observed": "left n=11 median 14.0 ms, max 26.0; center n=10 median 17.0 ms, max 25.0. No measurable cost."
  }
]

## deviations_from_brief

[
  "New files (for the project map): editor/internal/navigation.ts, sideMark.ts, sideFocus.ts, viewport.ts, wheel.ts, historyKey.ts, each with a .test.ts.",
  "Public addition: MergeController.historyKey(event: KeyboardEvent): boolean. It calls preventDefault when the shortcut is recognised and returns undo()/redo()'s result. MergeHandle (ui/useMergeController.ts) gains historyKey. MergeView.vue adds useEventListener(window, 'keydown', …), gated on props.shown and store.question === null.",
  "Renames: isModClick → isModHeld (modClick.ts and its test). revealTop → revealScrollTop, which takes paddingTop and returns a scrollTop clamped at 0. With the brief's document-space clamp, line 1 ended up under the find bar / 4px padding; this was seen in WebKit as scrollTop 4.",
  "The `SideMark` type lives in navigation.ts, not sideMark.ts: sideMark.ts uses afterDecision, and navigation's crossTo needs the type, which would be an import cycle (import/no-cycle). `settled` is module-private (knip).",
  "Added beyond the brief's list: navigation.alone(mark), stepAlone(rows, {side, fallback, areas, direction}) (rule 4 fallback to the other side, never the hidden one) and handoverTo(states, {focused, hidden}) (the A2 rule, pure and unit-tested). geometry.SIDE_PANE. side.ts gains SIDES and otherSide, and status.ts now uses them instead of its private copies.",
  "focusDecorations(statuses, side) takes the statuses field (to find the marked chunk's range) and bundles its mark field, like coveredDecorations. The point style uses extra classes chunk-focus-point-above/below for the edge. The change outline is a 2px inset.",
  "SideFocus takes states: () => ChunkState[] (read from the center chunkField) in place of a statuses field. SideFocus.decided() is public: the controller's #decide calls it after every user decision (key, icon, drag, mod-click) for A2.",
  "index.ts stays at 295 lines: #visibleLines moved to viewport.visibleLines and #showFindSpace to find.syncFindSpace; centerPane is built inside #createViews (ViewSources lost `center`; CenterPane is no longer exported); findSpace is no longer exported.",
  "Decisions the brief left open: a view is revealed only after keyboard and wheel steps, crosses and key decisions, never after clicks or icons (A5). Ctrl/Cmd+wheel over a side that lacks focus starts from the screen (alone, keeping remembered), not from the hidden remembered change. Wheel px resets to 0 after each step (leftover dropped; at most one step per event). POINT_HIT_PX = 4.",
  "A1/A2 could not use real views in the unit environment: the node project has no DOM, and test:browser does not launch. The A2 rule is covered by the handoverTo unit test; A1/A2 end to end by WebKit steps 5, 7 and 12.",
  "Step 9: undo inside the find field could not be shown. Ctrl+Z also fails to undo a plain <input> on a data: page in this MiniBrowser/WebDriver setup ('typed \"hello\" after Ctrl+Z \"hello\"'). In the find field the Ctrl+Z keydown reaches the INPUT with defaultPrevented=false and the middle is not undone, so yamt leaves the box's own undo alone.",
  "Step 10 Ctrl+wheel could not be reproduced: WebKitWebDriver's wheel events carry ctrlKey=false even with a Control keyDown in the same or a held earlier action ('wheel ctrl=false dy=100 ; wheel ctrl=false dy=-100'). Same in the Tauri app via tauri-driver. Only the plain-wheel part of step 10 was seen. The Ctrl+wheel logic is covered by the wheel.ts unit tests only.",
  "Step 14 was run in the real app (tauri-driver, debug build, docs/removed.md), not in fixture mode. Fixture mode has no read-only file, and isEditable keeps reopened resolved files editable — the brief's 'a resolved one reopened' premise does not hold in the tree."
]

## open_risks

[
  {
    "location": "frontend/src/editor/internal/sideFocus.ts (#wheel)",
    "risk": "Ctrl/Cmd+wheel stepping has never been seen in a browser: WebDriver cannot send a modified wheel here. It needs a manual try, including that Ctrl+wheel over the middle scrolls (not zooms) in WebKitGTK."
  },
  {
    "location": "frontend/src/editor/internal/sideFocus.ts (#pressed)",
    "risk": "The capture-phase mousedown on scrollDOM also marks 'alone' for clicks on the gutter or scrollbar of a side; a drag-select starting on a change marks that change."
  },
  {
    "location": "WebKit step 12 drag",
    "risk": "One run of the scratch harness dragged right after scrolling and applied nothing; a second run applied both icons as one undo step. Probably harness timing (strip repaint during the scroll), but the drag code itself was not changed."
  },
  {
    "location": "frontend/src/editor/theme.css (.chunk-focus-point-*)",
    "risk": "A line that carries markers above and below shows only one focus bar; which one depends on CSS order."
  }
]

## Orchestrator notes

- The brief's step 14 premise was wrong (#592): a reopened resolved file stays editable (`ui/views.ts` `isEditable`); the only read-only merge view is the deleted-side view (#47). Keys there behave as the implementer ran it.
- Ctrl/Cmd+wheel has not been seen in a browser (WebKitWebDriver sends wheel events with ctrlKey=false); the verifier will try real X11 wheel events with xdotool.
