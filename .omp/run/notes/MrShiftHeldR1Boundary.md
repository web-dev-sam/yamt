# MrShiftHeldR1Boundary

Agent output (`agent://MrShiftHeldR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrShiftHeldR1Boundary.md), collected 2026-11-03T08:30:44.929Z.

{
  "verdict": "pass",
  "checked": [
    "#2147 fixed: keyHold.ts useKeyHold is the only copy of the hold lifecycle (capture keys, blur/hidden as left, pointers only while held, passive). Alt and Shift call it with their own pure rule and pointer list.",
    "RV8 Alt unchanged: heldAfter and POINTER_EVENTS (with wheel) are identical, Alt gets the same event fields via MouseEvent, altHold.test.ts is untouched, App.vue:49 has one useAltHold, and the merge-window smoke shows the minimap.",
    "#2148 fixed: useShiftHeld = createSharedComposable. vueuse 15.0.0 shared index.js:583-605 counts subscribers and stops the scope after the last one. Test: same ref, listeners removed. Smoke: state moves across filters.",
    "Accepted deviations: narrow rule inputs assignable to KeyHoldEvent; CP1 X11 comment on the keyup case with an Xlib source; lifecycle tests moved to keyHold.test.ts; the isClient risk cannot happen in the app.",
    "Boundaries: keyHold.ts imports only vue/@vueuse (PM2/PM3 ok), has one job, and one writer per held ref. The ui/AGENTS.md hunk only edits the Shift sentence, and it is accurate.",
    "Docs keeper: give architecture.md:1192 and :1730 ('one per filter') the same one-instance text as the deviation's state.md row. This is the per-feature docs pass, not a block."
  ],
  "findings": []
}
