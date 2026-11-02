# MrDuePickerBoundary

Agent output (`agent://MrDuePickerBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrDuePickerBoundary.md), collected 2026-11-02T22:41:04.334Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all 11 changed files are in Owned; the docs keeper is updating tree.md:203-204,274, state.md:71 and architecture:1191; plan #156's native field is replaced under #2138, as the deviation proposes",
    "Boundaries: calendar.ts imports only ./dueDate (PM3; no vue/~icons); MergeRequestCalendar.vue imports only ../mergeRequests and ./mergeRequestsText (PM10); the UI imports only mergeRequests/index.ts (TS8)",
    "Contract: dueDate/calendar exports, Calendar props {selected,today} emit pick, DueDate props {due,now} emit set all match the brief; extra exports used, deviation accepted",
    "One source per fact: dueDateText is the one shown form (row, field, label), typedDay reads it back; realDay and padded are shared; today = localDay(props.now) feeds both footer and grid",
    "State: `focused` has one writer (keys and chevrons); shown month = monthOf(focused), derived (deviation accepted); open/refused stay local; due dates are still written only through emit set",
    "VU15 reason given for the new component; VU2 order and VU4 refs OK; no title attrs; the only comment (calendar.test.ts zone reload) is an external fact (CP1)"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestRow.vue",
      "line": 59,
      "severity": "block",
      "rule_id": "DR1",
      "problem": "Hovering a row's 'created … ago' still shows Intl 'en' medium style ('Oct 30, 2026, 3:04 PM'), an American month-first date on the page. This breaks brief rule 1 ('Every date the page shows is DD.MM.YYYY') and the owner's 'always ddmmyyyy'. The file was outside Owned, so nobody reported it.",
      "fix": "Widen Owned to MergeRequestRow.vue and build createdTitle from the core's one format: dueDateText(localDay(createdAt)) plus a zero-padded HH:MM, no second Intl formatter."
    },
    {
      "file": "frontend/src/ui/MergeRequestCalendar.vue",
      "line": 93,
      "severity": "should",
      "rule_id": "TS11",
      "problem": "The key-to-day rule (`movedDay`) is in the component, so node tests cannot reach it, and it forces MONTHS_PER_YEAR and weekdayIndex into the public API. House key rules are pure and tested (menuKeys.ts stepMenuItem). If it stays, each new key adds untested component logic.",
      "fix": "Move it into calendar.ts as `movedDay(day, { key, shiftKey }): CalendarDay | null` with node tests per key, and drop MONTHS_PER_YEAR and weekdayIndex from index.ts if nothing else imports them."
    },
    {
      "file": "frontend/src/ui/mergeRequestsText.ts",
      "line": 42,
      "severity": "should",
      "problem": "`DUE_TODAY` holds the footer word 'Today', but its name reads like daysLeftText's 'Due today' on the same page. A later reader editing either text can pick the wrong constant.",
      "fix": "Rename it to `PICK_TODAY` (or `TODAY_BUTTON`) in mergeRequestsText.ts, MergeRequestDueDate.vue and the text test."
    },
    {
      "file": "frontend/src/ui/MergeRequestCalendar.vue",
      "line": 76,
      "severity": "nit",
      "problem": "dayTone builds classes by string concatenation (a leading-space ' text-fg-muted'), and today's tone repeats 'hover:bg-hover' after 'bg-hover'. oxfmt cannot sort these classes. Nothing gets harder as the app grows.",
      "fix": "Return a class array (or object) for :class instead of a concatenated string, and drop the redundant hover:bg-hover on today."
    }
  ]
}
