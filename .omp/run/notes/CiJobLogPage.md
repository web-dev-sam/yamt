# CiJobLogPage

Agent output (`agent://CiJobLogPage`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogPage.md), collected 2026-11-03T11:11:48.612Z.

{
  "summary": "Shift over a failed job in the open CI box opens its log left of the box: coloured, at its end, focus in the search field (remembered text, selected, searched). CSS Highlight search; Enter/Shift+Enter step. Escape closes the log, a second the CI box. Generic keyHold, shiftAfter/useShiftTaps, runClasses, log words, jobLog step. A ~27k-match one-letter query is over its 250 ms budget.",
  "files_changed": [
    "frontend/src/ui/keyHold.ts",
    "frontend/src/ui/keyHold.test.ts",
    "frontend/src/ui/altHold.ts",
    "frontend/src/ui/useShiftHeld.ts",
    "frontend/src/ui/useShiftHeld.test.ts",
    "frontend/src/ui/useHoverBox.ts",
    "frontend/src/ui/useHoverBox.test.ts",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/mergeRequestLogText.ts",
    "frontend/src/ui/mergeRequestLogText.test.ts",
    "frontend/src/ui/mergeRequestLogLook.ts",
    "frontend/src/ui/mergeRequestLogLook.test.ts",
    "frontend/src/ui/CiStatusJobLog.vue",
    "frontend/src/ui/CiStatusBox.vue",
    "frontend/scripts/app-session/keys.ts",
    "frontend/scripts/app-session/keys.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "useShiftHeld.test.ts: a_lone_shift_press_and_release_is_a_tap",
      "proves": "Shift down then up adds exactly one tap, and again for a second tap."
    },
    {
      "name": "useShiftHeld.test.ts: shift_with_another_key_is_no_tap / shift_with_a_pointer_press_is_no_tap",
      "proves": "Shift+E and Shift+click set alone:false; the release counts no tap."
    },
    {
      "name": "useShiftHeld.test.ts: a_held_repeat_keeps_the_tap, a_pointer_move_while_shift_is_held_keeps_the_tap",
      "proves": "Shift's repeats and a pointer move with shiftKey keep the hold alone, so the release still taps."
    },
    {
      "name": "useShiftHeld.test.ts: leaving_the_window_ends_the_hold_without_a_tap / a_pointer_without_shift_ends_the_hold_without_a_tap",
      "proves": "Blur, and a pointer event without shiftKey, end the hold with taps unchanged. The held/not-held cases moved to shiftAfter."
    },
    {
      "name": "useShiftHeld.test.ts: held_and_taps_share_one_listener_set",
      "proves": "useShiftHeld and useShiftTaps add one listener set, read the same state, and remove it after the last scope stops."
    },
    {
      "name": "keyHold.test.ts: the_state_is_the_rules_own_type, pointer_events_are_heard_only_while_holding, a_pointerdown_is_pressed",
      "proves": "A string or number state works; pointer listeners follow holding(state); only pointerdown gets pressed:true."
    },
    {
      "name": "useHoverBox.test.ts: an_escape_handled_inside_leaves_the_box_open",
      "proves": "An Escape that is already defaultPrevented neither closes the box nor moves focus."
    },
    {
      "name": "mergeRequestLogLook.test.ts: every_colour_has_its_class_both_ways (16), underline_and_strike_together_keep_both_lines, the_plain_style_has_no_class",
      "proves": "Each AnsiColour maps to its text-ansi-*/bg-ansi-* class; both lines give one arbitrary class; the plain style gives \"\"; the parts come in a fixed order."
    },
    {
      "name": "mergeRequestLogText.test.ts: the log box's words; a refused log says why (5, from a Record over every refusal kind)",
      "proves": "The exact §2.4 words and each non-log reply's sentence."
    },
    {
      "name": "problemText.test.ts: jobLog row; mergeRequestsText.test.ts jobTitle; keys.test.ts a_lone_shift_is_a_key_both_ways",
      "proves": "The jobLog problem words, the new job hover text, and a lone Shift parsing to \\uE008 / Shift_L while Shift+a stays a chord."
    }
  ],
  "smoke_evidence": [
    {
      "command": "just app-session read --name cl \"typeof Highlight === 'function' && 'highlights' in CSS\" (step 0, before any .vue work)",
      "observed": "{\"value\":true}"
    },
    {
      "command": "pnpm -C frontend lint; typecheck; fmt:check; unused; test",
      "observed": "oxlint + eslint: no findings. vue-tsc -b: clean. oxfmt: all files correct. knip: nothing. Tests: 267 files passed, 3987 tests passed (includes mergeRequestTitles, palette, themes)."
    },
    {
      "command": "just arch-check; just map-check",
      "observed": "arch-check: ok. map-check fails, all on non-owned docs: contrast.ts, fixtureMergeRequestLogs.ts, four mergeRequests/internal files, mergeRequestJobLogs.ts, read_job_log ×2, readJobLog. None of my files is listed; my new files are untracked."
    },
    {
      "command": "fixture cl: hover 'Pipeline failed' nth 0, hover li:nth-child(3) (lint:docs), press Shift, read the dialog",
      "observed": "label \"Log of lint:docs\"; log right 1394.36 = CI box left 1394.36; tops 167.23 = 167.23; 896×576; active element \"Search the log\"; fromEnd 0; 37 lines; 27 ansi-coloured spans. Shot /tmp/joblog-dark.png (yamt Dark)."
    },
    {
      "command": "hover li:nth-child(1) (test:unit), type Error, then press Shift with focus in the field",
      "observed": "Still \"Log of lint:docs\"; count \"6 of 6\"; 6 match ranges, 1 current; stored {\"lint:docs\":\"Error\"}. After Shift: still lint:docs, focus still in the field."
    },
    {
      "command": "press Escape; read; press Escape; read",
      "observed": "1st: dialog null, focus on the \"lint:docs\" job button, CI box still open. 2nd: dialog null, CI box null, focus on \"Pipeline failed\"."
    },
    {
      "command": "Settings → yamt row Light; reopen lint:docs log via Shift; shot /tmp/joblog-light.png",
      "observed": "data-theme light. The field reopened with the remembered \"Error\", selected; 6 of 6, current is the last line; colours visible."
    },
    {
      "command": "Timing: keyup listener + 2 rAF after the lines exist; Shift over test:unit",
      "observed": "{\"ms\":897,\"lines\":9000,\"fromEnd\":0}. Includes the fixture's 400 ms reply delay. Within 1.5 s."
    },
    {
      "command": "Timing: keydown → setTimeout → 2 rAF; one letter on test:unit",
      "observed": "\"e\" (5 hits): 33 ms. \"s\" (26,811 hits): 3081 ms, 10099 ms (handler 978), 2756 ms (handler 440). Over the 250 ms budget; design finding."
    },
    {
      "command": "Paint probe in page: one StaticRange per line, 0 other highlights",
      "observed": "30 ranges: paint 25 ms; 3000: 45; 9000: 92; 27000: build 473 + paint 234. With 26,811 job-log-match ranges live, even a 30-range highlight took 1175 ms to paint."
    },
    {
      "command": "just mutants HEAD",
      "observed": "827 killed, 7 survived, 21 no coverage (96.73%). keyHold, altHold, useShiftHeld, mergeRequestLogLook, problem: 100%."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 827 killed, 7 survived, 21 no cov, 96.73% (editor/ and .vue not mutated)",
    "survivors": [
      "src/ui/mergeRequestLogText.ts:27 default arm (NoCoverage ×2) — equivalent: the `never` arm cannot be reached once the switch is exhaustive (same as the 7 existing such arms in mergeRequestsText.ts/problemText.ts)",
      "All other survivors are on lines I did not change: keys.ts:195,208 (parse error strings), problemText.ts:166,167,207, useHoverBox.ts:117."
    ]
  },
  "acceptance_not_run": [
    "`press Shift --x11` and `type --x11`: app-session refuses --x11 for fixture sessions (\"needs the private display of a start-app session\"). I ran the same steps through WebDriver press/type instead (Shift as \\uE008 keyDown/keyUp)."
  ],
  "deviations_from_brief": [
    "Main agreed option (a): the job-log words are in the new frontend/src/ui/mergeRequestLogText.ts and its test, because mergeRequestsText.ts is at 291 of oxlint's 300 lines. jobTitle stays in mergeRequestsText.ts. tree.md needs rows for ui/mergeRequestLogText.ts (the log box's words), ui/mergeRequestLogLook.ts (runClasses) and ui/CiStatusJobLog.vue (the log box).",
    "useShiftHeld and useShiftTaps are `export const … = createSharedComposable(...)` (as useShiftHeld was), not function declarations. Both read one shared state, so there is one listener set. Signatures match the Contract.",
    "useFollowEnd's content is `() => props.shown.load`, not `() => lines`: a composable is in the SFC order's state section, before the `loaded` computed. The load changes exactly when the lines do.",
    "keyHold.ts: blur and a hidden page moved into a private `useLeaving(apply)` to stay within max-lines-per-function 40.",
    "docs (docs keeper): architecture.md:1193, 1581-1584 and 1745-1746 still name `shiftHeldAfter` and the boolean `useKeyHold(rule, …)`; they need `shiftAfter`/ShiftState, `useShiftTaps` and `useKeyHold(KeyHold<S>, …)`. state.md needs a row for the Shift taps: owner useShiftHeld.ts; written only by keyHold's listeners through shiftAfter.",
    "The WebKit smoke used WebDriver press/type in place of --x11 (see acceptance_not_run). Screenshots: /tmp/joblog-dark.png, /tmp/joblog-light.png.",
    "I added the state slice's ui/AGENTS.md lines, amended the \"Held\" lines, and added the log box paragraph after the Row details paragraph."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/CiStatusJobLog.vue search()/showCurrent()",
      "risk": "Design finding (§1.5): with ~27k live highlight ranges WebKitGTK takes 2.8–10 s for one query, and any repaint with them live costs ~1 s, so scrolling likely stutters. A selective query is fast (5 hits: 33 ms)."
    },
    {
      "location": "frontend/src/ui/CiStatusBox.vue logClosed",
      "risk": "Focus goes back to the job by index into `li > button` in DOM order, which follows view.jobs. A reordered list during the close would focus a neighbour."
    },
    {
      "location": "style.css/themes ansi tokens (palette slice)",
      "risk": "In yamt Light, the fixture's BLOCKER/ELIFECYCLE runs (coloured text on a red background) are hard to read. The contrast fence checks text against the panel, not text against an ANSI background."
    }
  ]
}
