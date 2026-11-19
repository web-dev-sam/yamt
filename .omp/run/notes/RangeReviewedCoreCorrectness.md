# RangeReviewedCoreCorrectness

Agent output (`agent://RangeReviewedCoreCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedCoreCorrectness.md), collected 2026-11-19T09:24:13.894Z.

{
  "verdict": "fail",
  "checked": [
    "All design §4 core test names exist. two_stores_on_one_review fails if write_change wrote from memory. a_moved_left_side fails if left took part in classification. marking_again fails without the reopen sweep.",
    "side_names uses the typed names, not the merge base. right_text shares the decide/read_sides/decoded rule, and its test checks it against load per kind (deleted → Some(\"\")). sides and repo_key are tested against PairLock.",
    "Refusals (RK36/RK49): format is read first; newer → NewerFormat, else Broken with line/col. open writes only after a good read. write_change re-reads under the lock and never overwrites a broken file; text is written before the JSON.",
    "Survivors file: 82 mutants, 0 missed, none kept; nothing to grade against VF7. I ran no tests: both findings come from reading the code.",
    "Accepted: unmarked since_review = NoText; RangeEntryKind Deserialize; sides/right_text; no write without folder; Broken on unsorted/foreign ids (blocks texts/ traversal); write_atomically copy (no shared crate).",
    "Open risk of two git calls per side is accepted (called once per window open; both calls use git's own ambiguity rule). The arch-check block and the app allow-list match the brief; the failing path was reported."
  ],
  "findings": [
    {
      "file": "crates/reviewed/src/store.rs",
      "line": 281,
      "severity": "block",
      "problem": "The open sweep deletes texts that another live window's in-memory mark still names. That window's since_review (line 218) then answers ReadFailed. Two windows are enough, not three: keep A open, re-mark P in B, then reopen B (or open B on a pair that drops P). This is the normal reopen-after-a-push flow.",
      "fix": "Make since_review read a NotFound kept text as NoText. Test it with two stores where the second store's reopen sweeps the first store's text. Otherwise the orchestrator must re-accept the risk with the corrected trigger."
    },
    {
      "file": "crates/reviewed/src/stored.rs",
      "line": 62,
      "severity": "should",
      "problem": "A mark missing its `right` (or `left`) field is read as null, not refused as Broken (#117 rule). A hand-damaged file then reads as a reviewed deletion, and since-review diffs from \"\". Nothing gets harder as the app grows, though a format-2 migration would inherit the leniency.",
      "fix": "Add `#[serde(deserialize_with = \"Option::deserialize\")]` to StoredMark.left/right, and add a missing-`right` case to a_broken_file_names_line_and_column_and_is_left_unchanged."
    },
    {
      "file": "src-tauri/Cargo.toml",
      "line": 33,
      "severity": "should",
      "problem": "This line repeats the path that root `[workspace.dependencies]` now declares, unlike every other yamt-* line. The crate's location now lives in two places (vision 2), and the next crate added may copy the pattern.",
      "fix": "Replace it with `yamt-reviewed.workspace = true`."
    },
    {
      "file": "crates/reviewed/tests/stored_file/mod.rs",
      "line": 276,
      "severity": "should",
      "problem": "the_reviewed_folder_is_not_a_pair_folder cannot fail through anything core does, because the caller chooses reviewed_dir. A src-tauri bug that passed `<app>/range` would still leave it green, so the pair-folder guarantee stays unenforced as the app grows.",
      "fix": "In the app slice, add a test asserting that manage_range_in opens the store under `<app_folder>/reviewed`, a sibling of `range/`, and that pair_folders does not list it."
    }
  ]
}
