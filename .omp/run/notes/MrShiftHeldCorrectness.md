# MrShiftHeldCorrectness

Agent output (`agent://MrShiftHeldCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrShiftHeldCorrectness.md), collected 2026-11-03T08:21:44.477Z.

{
  "verdict": "pass",
  "checked": [
    "Rules 1-3 hold (useShiftHeld.ts:13-23, MergeRequestFilter.vue:104): Shift key name starts/ends hold; blur, hidden page, shiftKey-false pointer end it; pointer never starts it; excluded stays red.",
    "Test 'a release that still reports Shift as set hides' would fail with old useKeyModifier (getModifierState true). Blur, hidden page and all 3 pointer types without Shift are each tested.",
    "Blur listener has no capture (test pins it), so Shift+Tab element blurs inside the menu do not end the hold; capitals typed while holding Shift keep it (tested).",
    "Mutation: 58/58 killed in useShiftHeld.ts, no survivors. MergeRequestFilter.vue (.vue) is outside VF7 globs; its wiring has before/after smoke in fixture and real app.",
    "Accepted deviations: X11 xdotool repro instead of WebDriver (which doesn't repro), 2nd window for fixture blur, Dmitri instead of anna, tree.md row left to docs keeper. Accepted risks: two Shift keys, per-filter listeners.",
    "No risk-register row on modifiers (grepped); no line spaces or CM code touched; ran no tests."
  ],
  "findings": []
}
