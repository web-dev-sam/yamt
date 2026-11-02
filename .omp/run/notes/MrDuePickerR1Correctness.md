# MrDuePickerR1Correctness

Agent output (`agent://MrDuePickerR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrDuePickerR1Correctness.md), collected 2026-11-02T22:51:44.487Z.

{
  "verdict": "pass",
  "checked": [
    "#2143 fixed: DueDate.vue:35 `draft` shallowRef, v-model :136, reset in openerClicked :70, read by typedEntered :88. No one-way :value is left, so a re-render cannot overwrite typed text (R1 smoke: 31.02.2026 kept)",
    "#2143 fix breaks nothing: @input still clears `refused` beside v-model; Escape/close/save unchanged; DUE_TODAY→PICK_TODAY renamed in the component and in mergeRequestsText.ts/.test.ts",
    "No growth harm: movedDay moved verbatim into core calendar.ts (KeyboardEvent fits private DayKey); weekdayIndex and MONTHS_PER_YEAR are now private; the Row hover uses core dateTimeText, no second Intl formatter",
    "#2144 fixed: R1 survivors relabelled #732 static (b), not equivalent. Checked by hand against dueDate.test.ts:85-156: 'a03.11.2026' kills ^, '03.11.2026a' kills $, \\d{n}→\\d/\\D and [^./-] fail '03.11.2026'/'03112026'",
    "DAY_TEXT ^/$ fail ' 2026-01-01'/'2026-01-01T00:00'; WEEKDAYS pinned by calendar.test.ts:36-38; the counts add to 31 (8+1+1+7+6+8)",
    "mergeRequestsText.ts 14 NoCoverage = 7 unchanged `never` default arms × 2. That is a valid (b) keep (typecheck). No tests run; the re-check was done by reading only"
  ],
  "findings": []
}
