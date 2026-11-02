# MrDuePickerDocs

Agent output (`agent://MrDuePickerDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrDuePickerDocs.md), collected 2026-11-02T22:40:45.855Z.

{
  "summary": "The docs now match the due-date picker as committed at 81484732. tree.md: the dueDate row covers typedDay, localDay, DD.MM.YYYY dueDateText and utcMidnight; new rows for calendar and MergeRequestCalendar; the MergeRequestDueDate row now has no native field and never saves on blur. state.md and architecture §5.1 gain the due-date box row (open, refused, the calendar's focused day, month as monthOf(focused)). Architecture also has new box and core text, and the Verified line is updated. No IPC change, so ipc-contract is unchanged.",
  "files_changed": [
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/project-map/SKILL.md",
    "docs/architecture.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    "docs/plan.md:188 (#156): replace 'the native `<input type=\"date\">` (WebKitGTK's GTK picker)' with yamt's own calendar box (DD.MM.YYYY, typedDay day first, Monday-first grid, owner #2138); maybe add a new §2 row for the picker (vision 5)",
    "frontend/src/ui/MergeRequestRow.vue:59,64 (product code): the created-at tooltip still uses Intl 'en' dateStyle medium ('Nov 2, 2026, 3:00 PM'), which may break brief rule 1 ('every date the page shows is DD.MM.YYYY'); told Main"
  ]
}
