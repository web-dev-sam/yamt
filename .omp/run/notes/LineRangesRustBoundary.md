# LineRangesRustBoundary

Agent output (`agent://LineRangesRustBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesRustBoundary.md), collected 2026-10-31T12:01:39.287Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all patched paths are in Owned or Cargo.lock. New modules format_1.rs, line_codes.rs and drafts.rs are under crates/review/src. bindings.ts is regenerated: addThread(file, place, text), DiffLine, ThreadPlace, Thread.place.",
    "Contract: types, methods, BackwardPlace words and the refusal order EmptyMessage→UnknownFile→BackwardPlace all match. add_thread takes place. BackwardPlace→IpcError::Git (ipc_error.rs:193) is pinned by a_backward_place_is_its_words.",
    "Format 2 (parsed): >2 gives NewerFormat. 1 reads through the private Format1File and is format 2 in memory. Other numbers give 'not 1 or 2'. problem() refuses backward places. open is unchanged, so a read never writes (RK36).",
    "Body: no line_range on one-line places. line_code follows the brief's table (Removed→d.right.start+1, Added→d.left.end()+1). range_ends matches RangeFile exhaustively (RS9). same_draft ignores line_code as specified.",
    "Deviations accepted: RS6 splits, multi_line(&RangeEntry), alphabetical keys (no preserve_order), FORMAT_1_EVERY_KIND in threads.rs, bindings in target/. sha1 is in workspace Cargo.toml + plan #147 (DR3); arch-check allows it.",
    "Comments: the GitLab source citations meet CP1, and the runs_forward 'unseen' test note is the brief's ask. Stale docs (architecture 'format 1', ipc-contract:85, tree.md:61) belong to the docs keeper, outside Owned."
  ],
  "findings": [
    {
      "file": "crates/review/src/position/line_codes.rs",
      "line": 86,
      "severity": "should",
      "problem": "Which of old/new a line kind carries is coded three times: line_place (position.rs:37-42), range_end_of here, and DiffLine::left/right (thread_types.rs:82-92). The position's lines and line_range.end's lines come from separate paths that must agree for GitLab, so any change to that rule must be made in step in each place.",
      "fix": "Make DiffLine::left/right pub(crate). Build line_place's and range_end_of's old_line/new_line from them through one_based, so range_end_of only decides line_code and type."
    },
    {
      "file": "crates/review/src/gitlab/drafts.rs",
      "line": 4,
      "severity": "should",
      "problem": "GitLab's position shapes are split: LinePlace and DiffRefs are in gitlab.rs, while LineType, RangeEnd and MultiLine are in position/line_codes.rs. gitlab::drafts now imports position while position imports gitlab, a two-way module edge. Readers have two homes to search, and the next split gets harder.",
      "fix": "Move LineType, RangeEnd and MultiLine (with json/from_gitlab_name) next to LinePlace in gitlab.rs or a gitlab/ submodule. Keep only the numbering (multi_line, range_end_of, line_code) in position/line_codes.rs."
    },
    {
      "file": "crates/review/tests/review.rs",
      "line": 749,
      "severity": "should",
      "rule_id": "RS6",
      "problem": "Both test files were already over RS6's 400 lines and grow further: review.rs goes from 708 to 833 lines and threads.rs from 593 to 715. Every later review feature lands in the same two files, so finding the harness or one scenario keeps getting slower.",
      "fix": "Move the Review/Fake harness into tests/review_harness/mod.rs (as stored_threads/ is). Put the range scenarios in tests/line_ranges.rs and the format-1/2 tests in tests/thread_format.rs."
    },
    {
      "file": "crates/review/src/thread_file/format_1.rs",
      "line": 28,
      "severity": "nit",
      "rule_id": "RS16",
      "problem": "The consuming conversion `Format1File::current` is named after an adjective, not after what it returns (a ThreadFile); nothing gets harder as the app grows.",
      "fix": "Rename it to `into_thread_file`, or use `impl From<Format1File> for ThreadFile` and `.map(ThreadFile::from)` in parsed."
    },
    {
      "file": "Cargo.lock",
      "line": 3561,
      "severity": "nit",
      "problem": "The commit also moves tempfile's getrandom from 0.3.4 to 0.4.3, which is unrelated to sha1 and unexplained. It only touches test and conflict-repo builds, so nothing gets harder.",
      "fix": "Restore tempfile's `getrandom 0.3.4` edge so the lock diff holds only sha1, or name the bump in the commit message."
    }
  ]
}
