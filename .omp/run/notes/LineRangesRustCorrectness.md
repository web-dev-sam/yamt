# LineRangesRustCorrectness

Agent output (`agent://LineRangesRustCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesRustCorrectness.md), collected 2026-10-31T12:02:03.274Z.

{
  "verdict": "fail",
  "checked": [
    "board.ts line codes checked by hand against GitLab parser.rb v19.3.2-ee (fetched): _197_201, _201_204, _200_204, _309_315, _416_404 are right; the hash is of the new path",
    "Formats: >2 NewerFormat; 1 becomes one-line places, format 2 in memory; 2 parsed; else Broken. problem() checks runs_forward. A read writes nothing (bytes and whole JSON pinned)",
    "add_thread refuses in the order EmptyMessage, UnknownFile, BackwardPlace with nothing written (threads.rs, src-tauri tests). BackwardPlace maps to Git with its words: a_backward_place_is_its_words",
    "same_draft ignores line_code; None matches only None. line-range-drafted fails if the range check goes: draft 402 (both-sides text, same place, no range) would stand in",
    "One-line body unchanged: the_post_body_names_the_three_commits_and_the_position compares the whole body. Bodies are compared as Value, so the key-order deviation does not matter; accepted",
    "Survivors file: 57 caught, 22 unviable, none kept, so no VF7 reason to check. File splits and the bindings export into target/ accepted. I ran no tests."
  ],
  "findings": [
    {
      "file": "crates/review/src/position/line_codes.rs",
      "line": 115,
      "severity": "block",
      "rule_id": "RK48",
      "problem": "A range on an added file (or a modified one whose old text was empty) gets the wrong line_code. GitLab reads the hunk `@@ -0,0 +1,n @@` and numbers every added line `_0_{r+1}` (parser.rb: line_old = pos_old = 0). This code writes `left.end()+1` = `_1_{r+1}`, so GitLab finds no such row. The repo's own drafted/ fixture shows `_0_4`.",
      "fix": "Number an added line's old side 0 when the left text has no lines. Pass the emptiness from range_ends (RangeFile::Texts left/right) into multi_line, and add an added-file (reminders.ts) case to the line-code unit test."
    },
    {
      "file": "crates/review/src/position/line_codes.rs",
      "line": 103,
      "severity": "block",
      "rule_id": "RK48",
      "problem": "The mirror case: a range on a deleted file, such as src/api/mockBoards.ts in range-repo, posts removed ends as `_{l+1}_1`. GitLab's hunk `@@ -1,n +0,0 @@` gives line_new 0, i.e. `_{l+1}_0`. No test covers an added or deleted file, so the RK48 tests miss this. The doc comment's 'its change's first added line' is also wrong for a pure removal.",
      "fix": "Number a removed line's new side 0 when the right text has no lines. Pin a mockBoards.ts case in the unit test. Reword the doc as 'the new number of the line after the change's removed lines'. Note the rule in the design table."
    },
    {
      "file": "crates/review/src/thread_types.rs",
      "line": 309,
      "severity": "nit",
      "problem": "The comment names only an added start with a removed end as unseen. A removed start in a later difference with an added end in an earlier one also passes runs_forward, and that is the common both-sides shape. A later reader may think BackwardPlace covers it.",
      "fix": "Widen the comment (and the test name) to say any start and end with no side in common are ordered only by the editor."
    }
  ]
}
