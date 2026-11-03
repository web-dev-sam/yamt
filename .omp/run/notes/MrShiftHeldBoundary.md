# MrShiftHeldBoundary

Agent output (`agent://MrShiftHeldBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrShiftHeldBoundary.md), collected 2026-11-03T08:22:03.956Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: the patch touches only the 4 Owned files. The click path (`$event.shiftKey`, `mergeRequestFilters.ts`, core `clicked`) is unchanged. `shift.value ?` at MergeRequestFilter.vue:104 is right now that the ref is a plain boolean.",
    "Edges: MergeRequestFilter.vue imports ui/ `./useShiftHeld`, no window root or lsp/ (PM10); useShiftHeld.ts imports only vue/@vueuse (VU12). `shiftHeldAfter` is an exhaustive switch over a sum type, no `as`/`!`.",
    "Comment useShiftHeld.ts:41-42 is a CP1 external fact with a source (Xlib XKeyEvent `state`), placed at the keyup listener it explains; the notes confirm it (xdotool keyup reports Shift set). ui/AGENTS.md:51 matches the code.",
    "Deviations accepted: X11 xdotool repro, since WebDriver keyUp reports Shift false; a second WebDriver window for the fixture blur step; Dmitri instead of anna in the app scenario; the open risk about two Shift keys (rule 1 says 'that key').",
    "Deviation 'shape of altHold.ts, not merged': not accepted (finding 1). The rules differ (Alt ends on other keys/repeat; Shift ignores other keys and keyup's shiftKey); the listener shell is the same."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/useShiftHeld.ts",
      "line": 26,
      "severity": "block",
      "rule_id": "principles §3 / review-protocol growth: decision copied",
      "problem": "useShiftHeld.ts:26-66 repeats altHold.ts:32-70's hold lifecycle from plan §2 #80 (capture key listeners, off on blur and hidden page, pointer listeners only while held, passive), and the copies already differ: Alt has `wheel` and MouseEvent, Shift neither, so a later WebKit fix to one misses the other.",
      "fix": "Fix round adding altHold.ts/altHold.test.ts to Owned: one shell, e.g. `ui/keyHold.ts` `useKeyHold(rule)`, sending key, repeat and modifier state to a pure rule; `heldAfter` and `shiftHeldAfter` stay the two rules and pick one pointer-event list."
    },
    {
      "file": "frontend/src/ui/useShiftHeld.ts",
      "line": 26,
      "severity": "should",
      "rule_id": "vision 2",
      "problem": "Each MergeRequestFilter (v-for over LIST_FILTERS in MergeRequestsView.vue:141) builds its own `held` and listeners, so one window-wide fact has three owners, the per-instance copy plan §2 #80 rejected for Alt; a later reader of 'is Shift held' must check that all three agree.",
      "fix": "Wrap the composable in vueuse `createSharedComposable` inside useShiftHeld.ts so every filter shares one instance, and state that one instance in the owner row."
    },
    {
      "file": "frontend/src/ui/useShiftHeld.ts",
      "line": 1,
      "severity": "should",
      "rule_id": "PM6",
      "problem": "The doc lines for the docs keeper name only a new tree.md row, but tree.md:272 and docs/architecture.md:1728 still say `useKeyModifier`, and neither state.md nor architecture §5.1 has an owner row for 'Shift held'; these stale lines would mislead anyone looking for this state's owner.",
      "fix": "Add to deviations_from_brief: replace `useKeyModifier` with `useShiftHeld` at tree.md:272 and architecture.md:1728, and add a state.md/§5.1 row 'Shift held (filter not-icons)' → `useShiftHeld()` (`ui/useShiftHeld.ts`), never stored."
    }
  ]
}
