# MrRowDetailsHoverR1Correctness

Agent output (`agent://MrRowDetailsHoverR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsHoverR1Correctness.md), collected 2026-11-02T20:38:49.155Z.

{
  "verdict": "fail",
  "checked": [
    "#2115 fixed on hover-leave: dismiss (useDropdownMenu.ts:47-53) returns focus only from inside the menu. useDropdownMenu.test.ts:138 and useHoverMenu.test.ts:186 fail under the old body rule.",
    "#2116 fixed: blur dismisses a kept menu and closes a moved one (useDropdownMenu.ts:117-121). Tests at useDropdownMenu.test.ts:254 and :264 and useHoverMenu.test.ts:196. No existing user calls open.",
    "#2109: one opened {which, focus} state, openFor computed from it, byHover gone. Pinning is toggle kept→moved (useHoverMenu.test.ts:207). TIP_CLASSES equals OperationLabel.vue's old literal.",
    "#2117: the dismiss survivors on lines 44-51 are killed. Accepted: tooltip.ts:35/93/40/12 equivalent; tooltip.ts:123/161/175 covered by the typecheck gate; useDropdownMenu.ts:62/134/124 equivalent.",
    "Tooltip rewrite traced: hide stops the timer, entered hides then shows at once when warm, unbind stops listeners. Accepted deviations: opened field and kept→moved toggle are add-only.",
    "No targeted test run; the block follows from reading closeAfterClick and its click/contextmenu wiring (useDropdownMenu.ts:55-65,124-144)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/useDropdownMenu.ts",
      "line": 56,
      "severity": "block",
      "rule_id": "R-#2115",
      "problem": "closeAfterClick still treats focus on <body> as inside the menu for a hover-opened menu (focus \"kept\"). A click or right click on page text while a hover menu is open calls close, which runs opener.focus() on an opener the user never focused. This is #2115's defect on the click path; the click and contextmenu tests use only toggle.",
      "fix": "In closeAfterClick, call close only when opened.focus === \"moved\" and focus is on body; otherwise call dismiss. Add a test: opened(\"open\"), click and right click elsewhere with focus on body, and focus stays on body."
    },
    {
      "file": ".omp/run/mutants/MrRowDetailsHoverR1.survivors.txt",
      "line": 12,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "Survivors on 30, 61, 94-101 and no-cov 94-110 are kept as \"unchanged lines\", which is not a VF7 reason, and line 30 names no mutation. :144 capture is called wiring with no named smoke. menuKey's preventDefault and stepping, used by five dropdowns, stay untested with no recorded owner.",
      "fix": "Give each one a file:line mutation and either a VF7 reason or a note that it is a gap in pre-slice code (menuKey, visibleBottom, capture), so the orchestrator can file it against the owning code."
    }
  ]
}
