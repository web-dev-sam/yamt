# CiJobLogPageCorrectness

Agent output (`agent://CiJobLogPageCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogPageCorrectness.md), collected 2026-11-03T11:20:54.943Z.

{
  "verdict": "fail",
  "checked": [
    "shiftAfter checked by hand against every brief rule (lone tap, Shift+E, Shift+click, repeat, pointer without Shift, left, taps never go down). Tests start from taps:2, so an extra or a missing tap fails: useShiftHeld.test.ts:107-142",
    "Escape order: the dialog calls preventDefault; keyPressed (useHoverBox.ts:71, test an_escape_handled_inside_leaves_the_box_open) and escapePressed (MergeRequestsView:87) skip it. Smoke: Esc closed the log, Esc the box.",
    "Match offsets: matcher gives UTF-16 columns over view.text (lines joined by \\n, runs never empty); hitPlaces maps them to run+offset; each Range uses the span's only text node. No v-html or title in either .vue (RK57).",
    "Tap watcher checks open, page!==null and isTypingTarget, so a capital or Shift+Enter typed in the field cannot switch logs (RK59). With :key remount, the old log deletes its highlights in beforeUnmount before the new onMounted sets them.",
    "Kept survivor mergeRequestLogText.ts:27 (never arm) accepted as VF7(a). acceptance_not_run (fixture refuses --x11) accepted: the verifier must run press Shift --x11 on a start-app session (VF11). Shift→last line 897 ms ≤1.5 s accepted.",
    "Viewed /tmp/joblog-dark.png and /tmp/joblog-light.png. Contrast is WCAG math from light.css:55,61 and style.css:62-63. No tests run; no file edited."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/CiStatusJobLog.vue",
      "line": 143,
      "severity": "block",
      "rule_id": "design §1.5",
      "problem": "search() adds one Range per match. A one-letter query on the 9,000-line log (~27k matches) freezes the window 2.8–10 s, and every repaint costs ~1 s while those ranges exist. The text is remembered per job name, so reopening that log freezes again. Users will notice; the brief only allowed reporting it.",
      "fix": "Keep `places` whole for the count and Enter, but give Highlights only places on lines in view ± one screen: a pure core `placesOnLines(places, first, end)` with tests, lines found by binary search on offsetTop, rebuilt per rAF on scroll. Amend design §1.5."
    },
    {
      "file": "frontend/src/ui/mergeRequestLogLook.ts",
      "line": 55,
      "severity": "block",
      "rule_id": "RK58",
      "problem": "A run with an ANSI background keeps its ANSI text colour, and the contrast fence only checks text against --color-panel. Light BLOCKER (#757575 on #e51313) and Dark ELIFECYCLE (#878787 on #f0524f) are both 1.03:1. The dark shot shows ELIFECYCLE blank, so Dark is broken too, not only Light as noted.",
      "fix": "When style.background is set, use `text-panel` as the run's text colour. Every --color-ansi-* is already ≥4.5:1 against --color-panel (themes.ts ansi-contrast), so the pair passes by construction. Add test a_coloured_background_takes_the_panel_colour_as_text; amend plan #161."
    },
    {
      "file": "frontend/src/ui/useShiftHeld.test.ts",
      "line": 220,
      "severity": "block",
      "problem": "held_and_taps_share_one_listener_set is the only evidence for its Acceptance line, yet it passes if useShiftTaps builds its own useKeyHold. The fake's `listening` is a Map keyed by event type: a second listener set adds no key, and one scope's removeEventListener deletes the key for both.",
      "fix": "Hold Shift with only useShiftHeld subscribed, then subscribe useShiftTaps, release, and expect taps 1: a separate state starts up and counts nothing. Or count listeners per type in the fake and expect one keydown listener."
    },
    {
      "file": ".omp/run/mutants/CiJobLogPage.survivors.txt",
      "line": 3,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "\"Lines I did not change\" is not a VF7 (a)/(b)/(c) reason, and the list is incomplete: 6 of 7 survived and 2 of 21 NoCoverage have a file:line. useHoverBox.ts:117, the scroll-outside capture option the log relies on, may be a real gap: scroll does not bubble. Unlisted survivors cannot be checked, and later slices inherit the gaps.",
      "fix": "List every survivor as file:line mutation. Kill useHoverBox.ts:117 with a test that a non-bubbling scroll on an element outside the area closes the box. Keep the others only with a valid (a)/(b)/(c) reason, or send them to the owning slice."
    }
  ]
}
