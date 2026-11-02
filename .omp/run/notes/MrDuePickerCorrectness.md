# MrDuePickerCorrectness

Agent output (`agent://MrDuePickerCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrDuePickerCorrectness.md), collected 2026-11-02T22:41:20.868Z.

{
  "verdict": "fail",
  "checked": [
    "Day first, never American: '11/3/2026' reads 11 March, '03.11.2026' reads 3 Nov. 31.02, 29.02.2026, 00/13, 3.11.26, ISO, mixed separators and 7/9 digits are refused (dueDate.test.ts typedDay)",
    "Month clamp: addMonths takes the last day from day 0 of the next month. Jan31→Feb28/29, Mar31→Apr30, Dec+1, ±12 from a leap day tested; PageUp/Down, Shift and chevrons all use addMonths",
    "Roving focus: shown month is monthOf(focused), so the tabindex=0 day is always in the grid. moveTo focuses after nextTick; smoke ArrowUp×4 into November kept tabIndex 0",
    "No save on blur: the field has no blur/change handler. Escape, outside click and scroll close without emitting (smoke: storage unchanged); a refused Enter returns before save (storage still 2026-12-05)",
    "RK56: daysLeft uses localDay with the same getters. localDay test has a Berlin UTC 23:30 case; monthGrid covers Monday start, Sunday start, Feb 2028, year turn both ways; Home/End via weekdayIndex",
    "Survivors: by reading, the typedDay tests kill every listed TYPED_DAY mutant. DAY_TEXT line is unchanged; never-arms are gate-covered by typecheck. Deviations accepted. No test run."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestDueDate.vue",
      "line": 135,
      "severity": "block",
      "rule_id": "VU",
      "problem": "The one-way `:value` is rewritten on every re-render (Vue always patches `value`). A refused Enter therefore replaces the typed text with the saved date, so invalid-dark.png shows a valid 05.12.2026 marked invalid. The first keystroke after that is dropped, and the minute `now` tick clears any text being typed.",
      "fix": "Keep the typed text in a local `shallowRef` draft, set from `shown?.date ?? ''` in `openerClicked`. Bind it with `v-model` and have `typedEntered` read the draft."
    },
    {
      "file": ".omp/run/mutants/MrDuePicker.survivors.txt",
      "line": 3,
      "severity": "should",
      "rule_id": "promote",
      "problem": "The WEEKDAYS and TYPED_DAY survivors are kept as '(a) equivalent', but a mutated regex or array changes behaviour. They are #732 static false survivors; MrConflictsGitlab had the same mislabel, fixed in R1. If it stays, 'equivalent' no longer means 'no observable difference', and real gaps can hide behind it.",
      "fix": "Relabel them as #732 static false survivors (not equivalent) and name the test that kills each, as MrConflictsGitlabR1 did."
    }
  ]
}
