# MrReviewFixesR3

Agent output (`agent://MrReviewFixesR3`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrReviewFixesR3.md), collected 2026-11-05T00:38:06.090Z.

{
  "summary": "Both findings fixed. #2477: `shownOf` now holds the panel's row through `panelRow`, a computed of only `thread.value?.shown.iid`. Reply typing, loads and sending no longer re-run filter, search and order. #2478: `MergeRequestDiscussions.vue` now watches `boxed`. When `boxed` turns false while the box is open, the box closes, so `discussionsBoxClosed` runs and the row's hold ends. A test covers #2477; a WebKit run, with a control run without the fix, covers #2478. ui/AGENTS.md is updated.",
  "files_changed": [
    "frontend/src/ui/mergeRequestsShown.ts",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/MergeRequestDiscussionsBox.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "MergeRequestDiscussionsBox.test: typing_a_reply_rewrites_the_panel_but_leaves_the_shown_rows_as_they_were",
      "proves": "Review mode Me with !637's thread shown and every read settled: setReplyText writes a new thread.value and leaves discussions unchanged, and shownRows is the same array (toBe). Fails when the old thread.value read is restored (checked)."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; test; unused; sfc-order (after the last edit)",
      "observed": "vue-tsc -b clean; oxlint + eslint clean; 'All matched files use the correct format.'; 'Test Files 302 passed (302) / Tests 4515 passed (4515)'; knip clean; check-sfc-order clean."
    },
    {
      "command": "just app-session start-fixture --name r3 --diff --mr list --open-mr --size 1600x1000; Review mode → Me8; hover '1 open discussion' (!633); hover its line; Shift; click 'Resolve thread'; click 'Reload discussions'",
      "observed": "{\"order\":\"!633 !618 !623 !638 !622 !603 !608\",\"expanded\":[\"0 open discussions\"]} (count is 0, the box is still open, and the row is held first)."
    },
    {
      "command": "same session: click 'Close' (role button) on the panel, then read the order; shot target/r3-released.png",
      "observed": "{\"order\":\"!618 !623 !638 !633 !622 !603 !608\",\"zero\":[\"SPAN\",\"SPAN\"],\"active\":\"BODY\"}: the box closed and !633 was released and moved."
    },
    {
      "command": "Control: the same steps with the boxed watch removed (session r3c)",
      "observed": "After Close: {\"order\":\"!633 !618 !623 !638 !622 !603 !608\",...}: !633 stays held at index 0, which reproduces #2478. With Escape instead of Close, the control also released the row, so only the Close path reproduces the bug."
    },
    {
      "command": "just app-session stop --name r3",
      "observed": "{\"stopped\":\"r3\",\"session\":\"ended\", webdriver and vite stopped, folder removed}"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → mergeRequestsShown.ts 96.55%: 84 killed, 0 timeout, 3 survived, 0 no-cov (.vue not mutated)",
    "survivors": [
      "mergeRequestsShown.ts:92 `if (panelRow !== null)` → `if (true)`: equivalent. It adds null to `held`, and `held` is only read by `held.has(row.iid)` with a real iid, so null never matches.",
      "mergeRequestsShown.ts:62 {kind:\"none\"} → {} / {kind:\"\"}: equivalent and unchanged since R1. reviewOrdered reads any other kind as NO_TURNS."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2478 is covered by a WebKit check, not a unit test. There is no DOM test environment, and SSR renders do not run non-immediate watchers. The brief allows either."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/useHoverBox.ts:50 (not owned)",
      "risk": "When the box closes because its span was removed, `pointerInside` may stay true because no pointerleave fires. If the row later boxes again, a focusout before a pointerleave might not hide it. Not seen in WebKit."
    }
  ]
}
