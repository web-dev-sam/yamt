# MrRowDetailsHoverCorrectness

Agent output (`agent://MrRowDetailsHoverCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsHoverCorrectness.md), collected 2026-11-02T20:18:37.215Z.

{
  "verdict": "fail",
  "checked": [
    "tooltipPlacement edges traced by hand: anchor 34→top 0, 33→below at 57 (kills >= vs >); clamp to viewport−tip, never <0; maxWidth min(480, vw) (operationTooltip.test.ts:51-80). tooltipBox tests unchanged.",
    "vTooltip: 399/400 and 300/301 ms boundaries tested via delayBefore and the directive; leave/Escape(not prevented)/scroll/press, listeners only while waiting/shown, unmount, value updates, aria-description all asserted.",
    "useHoverBox matches CiStatusBox.vue:40-110 line for line (show/hideUnlessHeld/isInside/focus/Escape/scroll re-check of focusInside); its 16 tests fail if any hold rule is dropped. No risk-register row or §3.1/CM rule owns these files.",
    "useHoverMenu: the six named tests fail with the feature deleted (299/300 ms close, re-enter cancels, click pins, second click, Escape via menuKey); toggle refactored onto open still focuses the first item.",
    "Survivors: tooltip.ts:157,170 gate-covered by typecheck (bound used after the guard) — VF7(b) ok; tooltip.ts:11 UNMEASURED and useHoverBox.ts:104 `at` — equivalent through the contract (and `{}` fails tsc too) — ok.",
    "Deviations accepted: TagAnchor rename, readonly arrow members, vi.hoisted window stub, resetModules per test. No targeted test run: the blocks follow from reading closeAfterClick (useDropdownMenu.ts:44-51) and the blur watcher (:128-131)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/useDropdownMenu.ts",
      "line": 139,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "Implementer's open risk confirmed: `dismiss` is closeAfterClick, which treats focus on <body> as inside the menu. A hover-only open-and-leave with nothing focused (after load, or after clicking row text) then calls opener.focus() 300 ms later, scrolling the opener into view and moving the Tab position. This breaks design §1.6 \"focus back to the opener only if it was inside\".",
      "fix": "Make `dismiss` return focus only when `menu()?.contains(document.activeElement)`. Add a useHoverMenu test with focus on body: hover, leave, wait 300 ms + settle, and focus stays on body."
    },
    {
      "file": "frontend/src/ui/useDropdownMenu.ts",
      "line": 128,
      "severity": "block",
      "problem": "When the window loses focus with a hover-opened menu, `close` runs and focuses the opener, though focus was never in the menu. Example: pointer resting on a filter opener while the user types in a field, then alt-tabs away. On return, focus is on the opener and the field has lost it. Hover now moves focus.",
      "fix": "Close a menu opened by `open` (not `toggle`) on blur without moving focus, e.g. through the inside-only `dismiss` rule, and add a test that a hover-opened menu closes on blur with focus left where it was."
    },
    {
      "file": ".omp/run/mutants/MrRowDetailsHover.survivors.txt",
      "line": 5,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The useDropdownMenu survivors are kept as \"on unchanged lines\", which is not a VF7 (a)/(b)/(c) reason. Lines 44-51 (closeAfterClick) now implement the new `dismiss` contract, so a surviving mutant of its `focused !== document.body` guard is an untested rule of this slice. If it stays, later slices build on a focus rule no test pins.",
      "fix": "List the 19 survivors by file:line. Kill those on lines 44-51 with the body-focus dismiss test from the first finding, or give each one a VF7 reason."
    }
  ]
}
