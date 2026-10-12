# KeyboardFocusBuildR1 — rework 1 report (commit 5cb0d4e, base 2a6277c)

## summary

All nine rework findings are fixed in frontend/src/editor/internal/** and editor/index.ts. A press on a side's scrollbar no longer moves its mark (#599). Undo/redo keys fall back to the physical key on non-Latin layouts (#600). After a mouse decision, the focused side reveals the change it now outlines (#601). The keyboard moves to the other side only when the decision emptied the focused side (#603). A Ctrl/Cmd+click on no waiting change focuses the side alone (#604). Also: one shared pointEdge helper and no unstyled class (#593), SIDE_PANE used in drag/gap/strips (#594), markedId (#595), and #show renamed to #focusOn (#596). index.ts is 296 lines.

## files_changed

[
  "frontend/src/editor/index.ts",
  "frontend/src/editor/internal/sideFocus.ts",
  "frontend/src/editor/internal/navigation.ts",
  "frontend/src/editor/internal/navigation.test.ts",
  "frontend/src/editor/internal/sideMark.ts",
  "frontend/src/editor/internal/historyKey.ts",
  "frontend/src/editor/internal/historyKey.test.ts",
  "frontend/src/editor/internal/decorations.ts",
  "frontend/src/editor/internal/decorations.test.ts",
  "frontend/src/editor/internal/drag.ts",
  "frontend/src/editor/internal/gap.ts",
  "frontend/src/editor/internal/strips.ts"
]

## tests_added

[
  {
    "name": "historyKey.test.ts: a non-Latin layout undoes and redoes by the physical key",
    "proves": "'я'+KeyZ undoes, 'Я'+Shift+KeyZ redoes, 'н'+KeyY redoes, also with Cmd on macOS; 'ф'+KeyA does nothing. With the code fallback temporarily removed (return null), this test failed: '× a non-Latin layout undoes and redoes by the physical key'."
  },
  {
    "name": "historyKey.test.ts: a Latin key wins over the physical key: QWERTZ Ctrl+Z undoes, Ctrl+Y redoes",
    "proves": "key 'z' with code 'KeyY' gives undo, and key 'y' with code 'KeyZ' gives redo. With a code-first mutant of letterOf, this test failed, along with the three earlier Latin-only tests that pass no code."
  },
  {
    "name": "navigation.test.ts: a decision on the other side never moves the keyboard off a side that was already empty",
    "proves": "handoverTo({before: local already empty, after: remote change 3 decided}, focused local) is null (#603). With the `!hasWaiting(before, focused)` clause temporarily removed, this test failed."
  },
  {
    "name": "navigation.test.ts: the keyboard moves to the other side only when the decision emptied the focused side, never to the hidden side (changed)",
    "proves": "Handover happens when the decision emptied the side. No handover while changes still wait, when no side has focus, or toward the hidden side. The test now takes before/after states."
  },
  {
    "name": "decorations.test.ts: a focused zero-line change outlines the line carrying its bar, on the band's own edge (changed)",
    "proves": "For both edges (line 1 above, line 2 below), the band's `chunk-point-<edge>` and the focus's `chunk-focus-point-<edge>` sit on the same line with the same edge. The bare `chunk-focus-point` class is gone. With the focus edge temporarily hard-coded to 'above' (a drifted copy), this test failed."
  }
]

## smoke_evidence

[
  {
    "command": "pnpm -C frontend lint",
    "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" — no findings, exit 0. The first run flagged `historyKey.ts:39 switch-exhaustiveness-check: Cases not matched: null`, so letterOf now returns '' for no letter."
  },
  {
    "command": "pnpm -C frontend typecheck",
    "observed": "$ vue-tsc -b — no output, exit 0"
  },
  {
    "command": "pnpm -C frontend test",
    "observed": "Test Files  41 passed (41) / Tests  439 passed (439)"
  },
  {
    "command": "pnpm -C frontend fmt:check",
    "observed": "All matched files use the correct format. Finished in 447ms on 125 files"
  },
  {
    "command": "just sfc-order; just web-unused",
    "observed": "$ tsx scripts/check-sfc-order.ts (exit 0) / $ knip --include exports,types (no findings, exit 0)"
  },
  {
    "command": "wc -l frontend/src/editor/index.ts",
    "observed": "296 frontend/src/editor/index.ts"
  },
  {
    "command": "Fail-on-bug check: temporary mutations to historyKey.ts (no code fallback), navigation.ts (no `before` clause) and decorations.ts (focus edge fixed to 'above'), then vitest run on the 3 test files; all reverted afterwards",
    "observed": "× a non-Latin layout undoes and redoes by the physical key / × a decision on the other side never moves the keyboard off a side that was already empty / × a focused zero-line change outlines the line carrying its bar, on the band's own edge — Tests 3 failed | 27 passed. A code-first mutant: × a Latin key wins over the physical key: QWERTZ … (4 failed)"
  },
  {
    "command": "WebKit step 1 (#599): pnpm -C frontend dev --port 5291 + just webdriver 4491 (MiniBrowser on the Samsung screen), vueuse-use-magic-keys.ts. Real WebDriver pointer press-and-drag on the right scroller's thumb at (1496,470): rect right edge − 4px, thumb y computed from scrollTop/scrollHeight",
    "observed": "Before: active=right, mark {kind:change,id:3}, focus '87', scrollTop 1306. After the thumb drag: scrollTop 1825, mark still {\"kind\":\"change\",\"id\":3}. The capture-phase mousedown target was 'cm-scroller'. activeElement became DIV.cm-scroller: WebKit focuses the scroller, so no outline is drawn until the side gets focus again."
  },
  {
    "command": "WebKit step 2 (#601): click left line 3 text, then the apply icons of c0 and c1 at their strip rects",
    "observed": "Click line 3: active=left, focus '3', scrollTop 0. c0 apply icon: focus '22' (already visible), scrollTop 0 (unchanged). c1 apply icon: before the click line 54 was off screen (visible:false); after it, active=left, focus '54', scrollTop 705, and line 54 sits 263 px down a 786 px pane (0.33). Center and right followed to 705/705."
  },
  {
    "command": "WebKit step 3 (#603): click left line 3, Enter ×6, ArrowLeft, click the remote apply icon of c8 (remote 141)",
    "observed": "After 6× Enter: active=right, both sides alone. ArrowLeft: active=left, left alone, solid outline. Remote apply icon click: active=left (kept), left outline solid. Right bands [104,105,106,120,121,122,123] no longer include 141 (applied)."
  },
  {
    "command": "WebKit step 4 (#604): outline remote c8 (141-154) by keys, click the middle, then Ctrl+click remote line 160 (no change)",
    "observed": "Before: right mark {change,8}, focus '141-154'. After clicking the middle: active=center. After the Ctrl+click on line 160: active=right, focused, solid outline, focus '' (nothing outlined), mark {\"kind\":\"alone\",\"remembered\":8}, middle unchanged: true. A Ctrl+click on remote 141 (waiting c8) still applies: 141 left the right bands, and the mark moved to remembered 3."
  },
  {
    "command": "WebKit step 5: round 1 steps 1–7 and 12, same setup",
    "observed": "1 click local 129: active=left, outline solid, focus '129-136'. 2 ArrowRight: active=right, focus '141-154'. 3 Backspace: focus '87' (top-most waiting remote), right bands lack 141-154, middle 129-138 unchanged: true. 4 Ctrl+Z: active=right, focus '87' (stayed), 141.. back in right bands. 5 Down → 98-106 → 120-123 → 141-154, Enter: middle 129+ holds the remote text ('  if (target) {\\n    useEventListener(target, 'keydown', …'), active=right, focus '87'. 6 ArrowLeft → '129-136'; Down, Down: '129-136' scrollTop 2070 both times; Space: focus '3', scrollTop 0 (top-most). 7 after the last local Enter: active=right, right alone (no outline); Down → '98-106' (first waiting at or below the top). 12 keyboard on left, click c0 apply icon: active=left, focus moved to '22', bands [22,54]. Click middle then the c1 icon: active=center (middle keeps focus), bands [54]. Ctrl+Z, then Ctrl+click local 22: active=center, middle changed, bands [54]. Drag from the c0 apply icon to the c1 apply icon: bands [54]; one Ctrl+Z → [3,22,54] (one undo step)."
  }
]

## deviations_from_brief

[
  "Added helpers: `pointEdge(line, from)` (module-private, decorations.ts) and `markedId(mark)` (exported from navigation.ts, used by settled and alone).",
  "Changed internal signatures: `handoverTo({ before, after }, { focused, hidden })` (was `handoverTo(states, …)`) and `SideFocus.decided(before: readonly ChunkState[])`. `MergeController.#decide` reads the center chunkField before `#dispatch` and passes it in.",
  "Rename: `SideFocus.#show` → `#focusOn`.",
  "#601: the reveal lives in `SideFocus.decided()` (when no handover happens and a side has DOM focus), not in `#act` alone. It covers mouse and key decisions alike. The separate reveal in `#decideKey` is removed because it is now redundant. A rule-1 click still never scrolls, since it does not decide.",
  "#593: the bare `chunk-focus-point` class was dropped, not styled; only `chunk-focus-point-above/below` remain (theme.css unchanged).",
  "#594: strips.ts keeps its own `local` boolean for applyX/ignoreX: those place the button inside the strip and are not a pane mapping. gap.ts:33-34 (left/center vs center/right, the strip's outer and inner pane) and drag.ts:74 (strip index) are not side→pane mappings and are left alone.",
  "#600: `letterOf` returns '' when there is no letter, not null: tsgolint switch-exhaustiveness-check rejects a `string | null` switch even with a default. Its comment cites CodeMirror's runHandlers keyCode fallback (CP1).",
  "The WebKit run used a throwaway Node WebDriver client in /tmp (deleted afterwards). DOM state was read only through execute/sync (EditorView via contentDOM.cmTile.root.view, the sideMarks value from state.values). Every action was a real pointer/key action at element rects."
]

## open_risks

[
  {
    "location": "frontend/src/editor/internal/sideFocus.ts:192-203 (#pressed)",
    "risk": "WebKit moves DOM focus to DIV.cm-scroller when its scrollbar is pressed (seen in step 1). The mark stays, but the side loses cm-focused, so no outline shows and keys do not reach the side until the next click. This is browser behaviour and outside #599."
  },
  {
    "location": "frontend/src/editor/internal/sideFocus.ts:197-199",
    "risk": "#604 uses changeAt as the brief says, but modClick's openBlockAt hits only lines inside a change (len > 0). A Ctrl+click within POINT_HIT_PX of a zero-line change's bar is skipped by #pressed but not consumed by modClick, so the side gets focus with its old mark, as before the fix. This happens only for zero-line changes."
  },
  {
    "location": "frontend/src/editor/internal/sideFocus.ts:106-117 (decided)",
    "risk": "#601 for drag and Ctrl/Cmd+click with the keyboard on a side was not run separately in WebKit. It shares the decided() path with the icon click shown in step 2."
  }
]

