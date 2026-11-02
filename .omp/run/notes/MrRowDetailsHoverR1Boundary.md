# MrRowDetailsHoverR1Boundary

Agent output (`agent://MrRowDetailsHoverR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsHoverR1Boundary.md), collected 2026-11-02T20:37:46.571Z.

{
  "verdict": "pass",
  "checked": [
    "#2108 fixed: dismiss (useDropdownMenu.ts:47-54) refocuses the opener only if focus is in the menu; body stays (test.ts:138, useHoverMenu.test.ts:186). closeAfterClick keeps body→close per design §1.6 'as today'.",
    "#2109 fixed: byHover gone; one `opened {which, focus}` written only in useDropdownMenu, openFor computed from it (:148); useHoverMenu.ts:33 reads opened.focus (test :207). 5 existing users unchanged.",
    "#2110 fixed: tooltip.ts:75-86,146-153 use useEventListener stop handles, :32-41 one useTimeoutFn; no add/removeEventListener pairs or raw setTimeout left; capture/passive flags unchanged.",
    "#2112 fixed: TIP_CLASSES exported once (tooltip.ts:9); OperationLabel.vue:71 only swaps the literal for :class (same tokens incl. fixed); test asserts the constant; DOT_CLASSES is precedent.",
    "#2114 fixed: tip element held only in `tooltip.element`; Phase is {kind, bound, unlisten}; state object renamed `tooltip`.",
    "Deviations accepted (add-only `opened`, toggle pins a kept menu, blur dismisses kept, FakeElement names); open risks accepted (idle timer ref in merge window, per-element watchers); no edge against PM2-PM10."
  ],
  "findings": []
}
