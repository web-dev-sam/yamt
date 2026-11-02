# MrRowDetailsHoverR2Correctness

Agent output (`agent://MrRowDetailsHoverR2Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsHoverR2Correctness.md), collected 2026-11-02T20:45:18.309Z.

{
  "verdict": "pass",
  "checked": [
    "#2121 fixed: useDropdownMenu.ts:55-59 calls close only for focus \"moved\" with focus on body; \"kept\" goes to dismiss, the windowFocusChanged rule (:117-121). Pinned menus unchanged (brief :86-87).",
    "Tests :354 and :363 open with \"open\" and keep focus on body. The old `body ? close` code would focus the opener, so both would fail. Test :216 still pins toggled body→opener (kills `&&`→`||`).",
    "No break: useHoverMenu.ts reaches the dropdown only through open/dismiss/toggle; dismiss with focus inside still refocuses the opener (:177). `above` init is equivalent: consumers read it only while drawn, open() sets false.",
    "#2122: each survivor has a file:line and a valid VF7 reason. 108:7 gate (noUncheckedIndexedAccess, tsconfig.app.json:10). 110:10 gate (TS2678/never). 110:5, 64:7, 126:89, 136:16 equivalent.",
    "The :146 capture flag is kept as a pre-slice gap; git log -S confirms it came in at 84ec8fa7, and it is listed in open_risks, which the #2122 fix allowed.",
    "New tests kill real mutants: menuKey arrow wrap + preventDefault (:409), Escape (:432), ignore (:444), undrawn (:456); visibleBottom overflow (:382) fails on first-parent or window fallback. No test run (no block)."
  ],
  "findings": []
}
