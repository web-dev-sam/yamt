# MrDuePicker

Agent output (`agent://MrDuePicker`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrDuePicker.md), collected 2026-11-02T22:37:57.036Z.

{
  "summary": "The native date field in the due-date box is gone. The box is now shadcn-style: a DD.MM.YYYY text field read by `typedDay` on Enter, the new `MergeRequestCalendar.vue` (caption, chevrons, Monday-first grid with roving tabindex and the WAI-ARIA date-picker keys), and Today/Clear buttons. The new core file `calendar.ts` holds monthGrid, addDays/addMonths (clamped), sameDay, monthOf, monthCaption, dayName, WEEKDAYS and weekdayIndex. `dueDateText` now writes 03.11.2026; `typedDay` and `localDay` are new. Saving happens only on Enter, a click or a footer button, never on blur.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/dueDate.ts",
    "frontend/src/mergeRequests/internal/dueDate.test.ts",
    "frontend/src/mergeRequests/internal/calendar.ts",
    "frontend/src/mergeRequests/internal/calendar.test.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ui/MergeRequestDueDate.vue",
    "frontend/src/ui/MergeRequestCalendar.vue",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "calendar.test.ts: a month starting on a Monday has no leading days (June 2026)",
      "proves": "Grid starts on the 1st when it is a Monday; 42 days; trailing July days marked out of month"
    },
    {
      "name": "calendar.test.ts: a month starting on a Sunday has six leading days (Nov 2026)",
      "proves": "Monday-first offset (getUTCDay remap) gives 6 leading October days"
    },
    {
      "name": "calendar.test.ts: February of a leap year shows its 29th day; December's grid turns into January; January's grid starts in December",
      "proves": "Leap day present, year turns both ways in the grid"
    },
    {
      "name": "calendar.test.ts: addMonths clamps / turns the year both ways",
      "proves": "31 Jan→28 Feb (29 in 2028), 31 Mar→30 Apr, Dec+1→Jan next year, ±12 from a leap day, +14"
    },
    {
      "name": "calendar.test.ts: addDays crosses month and year ends",
      "proves": "Month/year/leap boundaries and the DST weekend counted once"
    },
    {
      "name": "calendar.test.ts: weekdayIndex, sameDay, monthOf",
      "proves": "Monday is 0, Sunday 6; each of year/month/day compared"
    },
    {
      "name": "calendar.test.ts: the caption and the day names are English words read in UTC",
      "proves": "\"November 2026\", \"Tuesday, 3 November 2026\", including after a reload west of UTC"
    },
    {
      "name": "dueDate.test.ts: dueDateText writes day, month, year with leading zeros",
      "proves": "03.11.2026, 01.01.0050, 25.12.2026"
    },
    {
      "name": "dueDate.test.ts: typedDay reads %j day first (8 cases)",
      "proves": "Every rule-1 form; 11/3/2026 read as 11 March; leap day; trimmed spaces"
    },
    {
      "name": "dueDate.test.ts: typedDay refuses %j (16 cases)",
      "proves": "31.02/29.02.2026, ISO, 2-digit year, day/month 00 or 13, mixed separators, 7/9 digits, extra leading or trailing text"
    },
    {
      "name": "dueDate.test.ts: localDay is the calendar day of the local clock",
      "proves": "Turns at Berlin midnight and at year end; UTC 23:30 is the next Berlin day"
    },
    {
      "name": "mergeRequestsText.test.ts: the date picker's words; the due-date button names the date day first",
      "proves": "Dialog, placeholder, Today and chevron words; the full label \"Due 03.11.2026, 1 day left. Change the due date\""
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test; lint; typecheck; fmt:check; sfc-order; unused; just map-check",
      "observed": "Test Files 257 passed (257), Tests 3771 passed; lint, typecheck, fmt:check, sfc-order and unused each exit 0; map-check: ok"
    },
    {
      "command": "just app-session start-fixture --name duep --diff --mr list --size 1600x1000; open Merge requests; click 'Set a due date' --nth 10 (!630)",
      "observed": "[\"Choose a due date\",\"v-0\",\"November 2026\",\"Monday, 2 November 2026\",\"date\",0,42,1,\"dark\"]: dialog name, grid labelled by the caption, focus on today, 42 day buttons, one tabindex=0. Screenshot: /var/tmp/mr-due-picker/open-dark.png"
    },
    {
      "command": "click 'Tuesday, 17 November 2026'; read the openers",
      "observed": "Dialog gone; 'Due 17.11.2026, 15 days left. Change the due date | 17.11.2026 / 15 days left'; first opener is !630; storage {\"630\":\"2026-11-17\"}; focus back on the opener"
    },
    {
      "command": "press Enter (reopen), ArrowRight ArrowDown PageDown, Enter",
      "observed": "Reopened with focus on 'Tuesday, 17 November 2026' (selected cell); after the keys 'Friday, 25 December 2026 | caption December 2026'; Enter saved: 'Due 25.12.2026, 53 days left', storage 2026-12-25"
    },
    {
      "command": "reopen; Home End Shift+PageUp Shift+PageDown ArrowUp×4; Escape",
      "observed": "Mon 21 Dec, Sun 27 Dec, Sat 27 Dec 2025, Sun 27 Dec 2026, then 20, 13, 6 Dec and 29 Nov (month turned), tabIndex 0 each time; Escape: dialog null, focus on the opener, storage unchanged"
    },
    {
      "command": "Shift+Tab×3, then Tab×5",
      "observed": "INPUT value=25.12.2026 → Previous month → Next month → Friday, 25 December 2026 → Today → Clear"
    },
    {
      "command": "click textbox, Ctrl+A, type 05.12.2026, Enter",
      "observed": "[null,\"Due 05.12.2026, 33 days left. Change the due date\",\"{\\\"630\\\":\\\"2026-12-05\\\"}\"]"
    },
    {
      "command": "reopen, type 31.02.2026, Enter",
      "observed": "[true,\"true\",\"… border-problem-error\",\"rgb(246, 107, 113)\",storage still 2026-12-05]: box open, aria-invalid true, error border, nothing saved"
    },
    {
      "command": "Next month ×2, Previous month ×3; then Today; location.reload(); reopen the page",
      "observed": "December 2026 → January 2027 → February 2027 → November 2026, nothing saved; Today → 'Due 02.11.2026, Due today'; after reload !630 still first with 'Due 02.11.2026, Due today'"
    },
    {
      "command": "open !630, scroll 'Open merge requests' --to 300; click the '40 of 40' line with the box open",
      "observed": "'open true' → 'open after scroll false', storage unchanged; click outside → 'open false', storage unchanged"
    },
    {
      "command": "open, click Clear; count input[type=date] and [title]",
      "observed": "storage {}; !630 shows 'Set a due date(icon)' in its newest-first place (11th, after !631); input[type=date] 0; 7 [title] on the page, all compare-window chrome (New tab, Close tab, Format, …), none in the merge-request page"
    },
    {
      "command": "Settings → Light; reopen the picker with 17.11 set, hover the 12th; shot",
      "observed": "Light: /var/tmp/mr-due-picker/open-light.png; dark with a chosen day: /var/tmp/mr-due-picker/open-dark-selected.png. Chosen day in primary, today in the hover background, neighbouring days muted, readable in both. Session stopped"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (Stryker, mutates whole files: calendar.ts, dueDate.ts, mergeRequestsText.ts): 310 killed, 31 survived, 14 no coverage, 87.32%",
    "survivors": [
      "calendar.ts:6 WEEKDAYS array/string mutants (8) — equivalent: a static module-level const that the vitest runner never re-evaluates (justfile #732). Applied by hand, 'the weekdays start on Monday' fails",
      "dueDate.ts:6 TYPED_DAY regex mutants (15: ^/$ removal, \\d→\\D, {1,2}/{2}/{4}→single, [^./-]) — equivalent, same static-const cause. ^ removal applied by hand failed 3 typedDay refuses tests",
      "dueDate.ts:4 DAY_TEXT regex mutants (8) — on an unchanged line (Stryker mutates the whole file); same static-const cause",
      "mergeRequestsText.ts 14 NoCoverage — unchanged lines (the exhaustive `default: never` arms)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "VU15: new component MergeRequestCalendar.vue — the brief's Contract needs the grid, caption and chevrons to own the shown month and the focused day apart from the box's field and footer.",
    "Added exports beyond the Contract: `weekdayIndex` (Monday 0, used for Home/End and monthGrid) and `MONTHS_PER_YEAR` (Shift+PageUp/PageDown, shared with addMonths). `dueDate.ts` now exports `utcMidnight` to calendar.ts (internal only, not in index).",
    "The shown month is derived as `monthOf(focused)`, not a second state: the chevrons move the focused day by a month (clamped), so the roving tab stop is always in the shown month.",
    "`aria-selected` sits on the day's `role=gridcell`, not on the button: ARIA does not allow aria-selected on role button. `aria-current=\"date\"` and the name are on the button.",
    "`typedDay` trims surrounding spaces and needs one separator throughout (`03.11-2026` is refused). An empty field + Enter counts as refused (marked invalid).",
    "The field keeps the label 'Set a due date' (SET_DUE_DATE). The opener gets `aria-haspopup=\"dialog\"`. The calendar focuses its day when it mounts (preventScroll), so the parent no longer focuses the field.",
    "Docs outside Owned (docs/**): an architecture or plan row for the picker may be needed (for example a plan §2 row: own calendar, DD.MM.YYYY, Monday-first, vision 5). The docs keeper decides."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestCalendar.vue (aria-live on the caption)",
      "risk": "The caption has aria-live=polite so a month change is announced. It may double-announce together with the focus move. Not checked with a screen reader."
    },
    {
      "location": "frontend/src/mergeRequests/internal/calendar.ts:10-11",
      "risk": "Month and weekday names come from Intl 'en' with only one field each, read in UTC. This is stable across ICU builds, but WebKit's ICU was checked only by eye in the fixture (\"November 2026\", the day names)."
    }
  ]
}
