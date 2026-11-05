# TableAlignmentCorrectness

Agent output (`agent://TableAlignmentCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-01-09-442Z_01a1aab9-db42-7214-86d7-c22d4308e026/TableAlignmentCorrectness.md), collected 2026-11-05T08:21:36.300Z.

{
  "verdict": "pass",
  "checked": [
    "element.rs:74-85: exact align center/right come first, then the exact text-align style, else Start; no case folding. tests.rs:510-536 pins both forms, incl. align=left + style right → End.",
    "Deleting the feature fails table_cells_read_gitlabs_align_attribute and the corpus test. TS a_table_keeps_each_columns_alignment covers all 4 Align keys, and a column-0 collapse fails it too.",
    "Column mapping: tableOf pads body rows to the header width and drops extras. align has one entry per header column, so align[column] is always defined; `?? \"none\"` is a guard, not a live path.",
    "Fixture: table_align is the only entry with align= (jq). Only 4 align values changed; text/html/local are unchanged. The hand edit (accepted deviation) is proven equal by every_recorded_answer_reduces_to_its_blocks.",
    "Fake glab !52: word-diff shows exactly 6 style→align swaps. RK66: align only maps to an enum, no markup is emitted. RK74: markdownDom.ts is untouched.",
    "Mutants: 2 caught (deleted center/right arms), 1 unviable (Default: CellAlign has none); no kept survivors. editor/ failing paths are recorded in the note. I ran no test."
  ],
  "findings": []
}
