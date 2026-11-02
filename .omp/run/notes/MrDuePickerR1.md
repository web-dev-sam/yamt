# MrDuePickerR1

Agent output (`agent://MrDuePickerR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrDuePickerR1.md), collected 2026-11-02T22:50:29.961Z.

{
  "summary": "All five findings are fixed. The row's created-at hover now uses the new core `dateTimeText`, e.g. \"05.10.2026, 11:00\" (day first, 24-hour clock; no second Intl formatter). No other date on the merge-request page was month-first. The due-date field keeps its own `draft` (`v-model`, set when the box opens), so a refused Enter keeps what was typed. The key rule is now core `movedDay`, with a node test per key. `MONTHS_PER_YEAR` and `weekdayIndex` are private. `DUE_TODAY` is renamed `PICK_TODAY`. The static survivors are relabelled as #732.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/calendar.ts",
    "frontend/src/mergeRequests/internal/calendar.test.ts",
    "frontend/src/mergeRequests/internal/dueDate.ts",
    "frontend/src/mergeRequests/internal/dueDate.test.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ui/MergeRequestCalendar.vue",
    "frontend/src/ui/MergeRequestDueDate.vue",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "dueDate.test.ts: dateTimeText writes the local day first and a padded 24-hour time, never 3:04 PM",
      "proves": "30.10.2026, 15:04; 05.01.2026, 09:07; 00:00; 23:59.999 stays on its minute; UTC 23:30 is 09.11.2026, 00:30 in Berlin (local day and local time)"
    },
    {
      "name": "calendar.test.ts: the arrows move one day sideways and one week up or down, across month ends",
      "proves": "ArrowLeft/Right ±1 day, ArrowUp/Down ±7, crossing month and year ends"
    },
    {
      "name": "calendar.test.ts: Home goes to the week's Monday and End to its Sunday, weeks starting on Monday",
      "proves": "Home/End from a Wednesday, from a Monday and from a Sunday (replaces the weekdayIndex test)"
    },
    {
      "name": "calendar.test.ts: PageUp and PageDown move one month, clamped to the shorter month's last day",
      "proves": "31.03→28.02, 31.01→28.02, 15.12→15.01 of the next year"
    },
    {
      "name": "calendar.test.ts: Shift+PageUp and Shift+PageDown move one year, a leap day clamped to 28 February",
      "proves": "Shift selects 12 months; 29.02.2028 ±1 year gives the 28th"
    },
    {
      "name": "calendar.test.ts: Shift changes only the page keys, and other keys move nowhere",
      "proves": "Shift+ArrowRight is still one day; Enter, Space and Shift+Tab return null (no preventDefault)"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test; lint; typecheck; fmt:check; sfc-order; unused; just map-check",
      "observed": "Test Files 257 passed (257), Tests 3776 passed. Lint first warned vue/attributes-order (v-model before type); after the fix lint exits 0. typecheck, fmt:check ('All matched files use the correct format'), sfc-order and knip each exit 0. map-check: ok"
    },
    {
      "command": "just app-session start-fixture --name dueR1 --diff --mr list --size 1600x1000 (dark); open Merge requests; open !630 (--nth 10), click the textbox, type 31.02.2026, Enter",
      "observed": "[\"31.02.2026\",\"true\",\"rgb(246, 107, 113)\",true,null]: the field still reads 31.02.2026, aria-invalid, error border, focus kept, nothing stored. Then Backspace + '6' → [\"31.02.2026\",\"false\"]: no keystroke dropped. Shot: /var/tmp/mr-due-picker-r1/invalid-empty-dark.png"
    },
    {
      "command": "click 'Tuesday, 17 November 2026'",
      "observed": "[null,\"Due 17.11.2026, 15 days left. Change the due date\",\"17.11.2026\\n15 days left\",\"!630\",{\"630\":\"2026-11-17\"}]: dialog closed, !630 moved first, date stored"
    },
    {
      "command": "reopen !630 (field reads 17.11.2026), Ctrl+A, type 31.02.2026, Enter (the round-1 bug scenario, with a date saved)",
      "observed": "[\"31.02.2026\",\"true\",\"rgb(246, 107, 113)\",storage still 2026-11-17]. Shot: /var/tmp/mr-due-picker-r1/invalid-dark.png shows 31.02.2026 with the red border and 17 still selected"
    },
    {
      "command": "Ctrl+A, type 05.12.2026, Enter; reopen with Enter",
      "observed": "[null,\"Due 05.12.2026, 33 days left. Change the due date\",{\"630\":\"2026-12-05\"}]; on reopen the field reads \"05.12.2026\" (draft reset on open) and focus is on \"Saturday, 5 December 2026\""
    },
    {
      "command": "keyboard in WebKit through movedDay: ArrowRight ArrowDown PageDown; Shift+PageUp Home; End; Escape",
      "observed": "Wednesday, 13 January 2027 → Monday, 12 January 2026 → Sunday, 18 January 2026 (tabIndex 0)"
    },
    {
      "command": "hover the created-at span on !630 (css li p.truncate span[aria-description]); shot",
      "observed": "Tooltip \"05.10.2026, 11:00\" (shot /var/tmp/mr-due-picker-r1/created-hover-dark.png). The other rows' created hovers read \"30.10.2026, 10:00\", \"30.10.2026, 04:00\", \"29.10.2026, 10:00\". Zone Europe/Berlin. Session stopped"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (Stryker; whole files calendar.ts, dueDate.ts, mergeRequestsText.ts): 337 killed, 31 survived, 14 no coverage, 88.22%; every movedDay/dateTimeText mutant killed",
    "survivors": [
      "calendar.ts:7 WEEKDAYS (8) — #732 static false survivor, not equivalent: killed by 'the weekdays start on Monday' (\"Tu\"→\"\" applied by hand fails it); [] also fails the monthGrid tests",
      "dueDate.ts:6 TYPED_DAY ^ removed — #732 static: killed by typedDay refuses \"031120266\" / \"003.11.2026\" / \"a03.11.2026\"",
      "dueDate.ts:6 TYPED_DAY $ removed — #732 static: killed by typedDay refuses \"031120266\" / \"03.11.2026a\"",
      "dueDate.ts:6 TYPED_DAY day/month/year \\d{n}→\\d or \\D and separator [^./-] (7) — #732 static: killed by typedDay reads \"03.11.2026\" (and the other separated forms)",
      "dueDate.ts:6 TYPED_DAY dayDigits/monthDigits/yearDigits →\\d or \\D (6) — #732 static: killed by typedDay reads \"03112026\" day first (yearDigits \\D applied by hand fails it)",
      "dueDate.ts:4 DAY_TEXT (8, unchanged line) — #732 static: ^ → calendarDayFrom refuses \" 2026-01-01\"; $ → refuses \"2026-01-01T00:00\"; \\d{n}→\\d/\\D → 'calendarDayFrom reads a real day, a leap day included'",
      "mergeRequestsText.ts 14 NoCoverage — gate-covered: unchanged exhaustive `default: never` arms (the type checker)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The ownership hook blocked .omp/run/mutants/MrDuePickerR1.survivors.txt, so the relabelled lines (#2144) are in mutation.survivors for the orchestrator to write. I found each killing test by running the mutated regex on the tests' inputs. One mutant per constant was also applied by hand and the source restored.",
    "New core export `dateTimeText(at)` in dueDate.ts, re-exported from index.ts. `movedDay` takes a private `DayKey` type, and the component passes its KeyboardEvent to it as is.",
    "`addDays` stays exported from index.ts: its only users now are calendar.ts and calendar.test.ts. knip passes.",
    "Updated mergeRequests/AGENTS.md (dateTimeText, movedDay; weekdayIndex and MONTHS_PER_YEAR dropped) and ui/AGENTS.md (created-at hover, the field's draft, PICK_TODAY, movedDay). docs/** is untouched; tree.md and state.md may want a note on the draft state in MergeRequestDueDate.vue (docs keeper)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestDueDate.vue:137",
      "risk": "`v-model` and `@input=\"refused = false\"` are both on the input. WebKit checks show both run: the text is kept and the invalid mark clears on the next keystroke. IME composition was not tested."
    },
    {
      "location": "frontend/src/mergeRequests/internal/dueDate.ts:69",
      "risk": "The fixture has no afternoon created-at time, so in WebKit only morning hours were seen. The 24-hour case (15:04) is proved only by the node test."
    }
  ]
}
