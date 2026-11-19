# RangeReviewedApp

Agent output (`agent://RangeReviewedApp`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedApp.md), collected 2026-11-19T09:35:55.274Z.

{
  "summary": "Range windows now open a `ReviewedStore` after listing, under `<data_dir>/yamt/reviewed/` (a sibling of `range/`). A broken or newer `reviewed.json` refuses the window before it opens. Four new commands: `list_reviewed`, `mark_reviewed`, `unmark_reviewed`, `load_since_review`. `--review-of=<project>!<iid>` parses into `MarksOf`. The merge-request page now passes it: `RangeToOpen` carries `project`/`iid` and `range_arguments` adds the flag. `yamt_reviewed::Error` maps onto existing `IpcError` kinds. The `yamt-reviewed` dependency now uses `.workspace = true` (#2535).",
  "files_changed": [
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/open.rs",
    "crates/merge-requests/tests/open.rs",
    "crates/merge-requests/AGENTS.md",
    "src-tauri/Cargo.toml",
    "src-tauri/AGENTS.md",
    "src-tauri/src/args.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/src/second_window.rs",
    "src-tauri/src/range.rs",
    "src-tauri/src/range/tests.rs (new: range.rs's test module moved out)",
    "src-tauri/src/reviewed.rs (new)",
    "src-tauri/src/reviewed/tests.rs (new)",
    "src-tauri/src/commands.rs",
    "src-tauri/src/ipc_error.rs",
    "src-tauri/src/ipc_error/tests.rs"
  ],
  "tests_added": [
    {
      "name": "args::tests::review_of_with_a_range_names_the_merge_request_s_marks",
      "proves": "--review-of with --diff=<range>, in either order, gives MarksOf::MergeRequest; the text splits at the last `!`"
    },
    {
      "name": "args::tests::review_of_without_a_range_or_malformed_is_refused",
      "proves": "Refused without a range (alone, with --diff, --mr or a repo). Refused when malformed: no `!`, empty project, iid 0, `x` or empty, each with its exact line. --help still wins"
    },
    {
      "name": "args::tests::the_usage_names_review_of",
      "proves": "USAGE documents --review-of"
    },
    {
      "name": "second_window::tests::the_second_yamt_is_asked_for_the_range_in_its_repository_with_the_windows_ai_and_marks",
      "proves": "RK42: range_arguments with project/iid parses back to Range { marks: MergeRequest } for Ai::Off and Ai::On"
    },
    {
      "name": "tests/open.rs an_opened_merge_request_names_the_logged_in_project_and_its_iid",
      "proves": "prepare_open fills project = taskboard/taskboard (the logged-in project's full path) and iid = 12"
    },
    {
      "name": "reviewed::tests::mark_reviewed_then_list_reviewed_answers_it",
      "proves": "A mark comes back from list_reviewed as `reviewed`"
    },
    {
      "name": "reviewed::tests::a_window_on_a_new_commit_of_the_same_branch_keeps_the_mark",
      "proves": "After a commit on the right branch that leaves a.txt alone, the reopened window still lists a.txt reviewed"
    },
    {
      "name": "reviewed::tests::a_changed_right_side_lists_changed_since_review_and_load_since_review_answers_texts",
      "proves": "A changed right side lists changedSinceReview; load_since_review answers texts two→three with one difference"
    },
    {
      "name": "reviewed::tests::two_merge_request_reviews_do_not_share_marks",
      "proves": "Same commits: !2 sees none of !1's marks, and !1 still has its own"
    },
    {
      "name": "reviewed::tests::unmark_reviewed_forgets",
      "proves": "unmark empties the list, also after a reopen"
    },
    {
      "name": "reviewed::tests::an_unknown_file_answers_unknown_range_file",
      "proves": "mark, unmark and since on id 7 answer UnknownRangeFile { file: 7 }"
    },
    {
      "name": "range::tests::a_newer_reviewed_file_refuses_the_range_before_any_window",
      "proves": "manage_range_in errs with the line naming reviewed.json, nothing is managed, and the file is byte-identical"
    },
    {
      "name": "range::tests::the_reviewed_marks_live_in_yamt_reviewed_beside_range_and_no_pair_names_them",
      "proves": "#2541: the store is under <app_folder>/reviewed, and pair_folders(range/) lists only the one pair folder"
    },
    {
      "name": "ipc_error::tests::reviewed_store_problems_serialise_as_read_and_write_failures_naming_the_file",
      "proves": "ReadFailed, Broken and NewerFormat map to ReadFailed {path, message}; WriteFailed maps to WriteFailed"
    },
    {
      "name": "ipc_error::tests::a_reviewed_unknown_file_or_range_error_has_the_range_s_kind",
      "proves": "UnknownFile and Range(UnknownFile) map to UnknownRangeFile"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt --check",
      "observed": "FMT_OK (after the test move too)"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Finished `dev` profile ... no warnings or errors (run before and after the range/tests.rs move)"
    },
    {
      "command": "cargo test -p yamt-app -p yamt-merge-requests",
      "observed": "yamt-app lib: test result: ok. 235 passed; 0 failed; 47 ignored. merge-requests: 222 passed, and every integration binary ok (open.rs included), 0 failed"
    },
    {
      "command": "just bindings && just bindings-check",
      "observed": "diff empty, exit 0. Generated: listReviewed(): FileReview[]; markReviewed(file)/unmarkReviewed(file): null; loadSinceReview(file): SinceReview. Types: FileReview {file: RangeFileId, mark: ReviewMark}; ReviewMark = \"reviewed\" | \"changedSinceReview\"; SinceReview = {kind:\"texts\"; reviewed; current; differences: Difference[]} | {kind:\"noText\"}. All names match the brief"
    },
    {
      "command": "just arch-check",
      "observed": "arch-check: ok"
    },
    {
      "command": "just mutants HEAD",
      "observed": "Found 33 mutants to test ... 33 mutants tested in 5m: 11 caught, 22 unviable; mutants: no TypeScript changes since HEAD"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — 33 mutants: 11 caught, 22 unviable, 0 missed, 0 timeouts",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "bindings.ts was regenerated for the checks (bindings-check passed), then restored with `git checkout -- frontend/src/ipc/bindings.ts`, so it is not in the patch (+17 lines). The orchestrator must run `just bindings`; until then bindings-check fails on this tree.",
    "range.rs's test module moved to src-tauri/src/range/tests.rs, as review.rs does with review/tests.rs. The new tests had taken range.rs to 442 lines, past RS6's 400.",
    "Test helper RangeWindow::with_marks_copied reopens on a fresh data folder holding a copy of yamt/reviewed/. A dropped mock App keeps its state, so the pair lock stays held. Seen: reopens panicked at manage_range_in(...).unwrap() until this change, even after webview.destroy().",
    "RangeToOpen.iid got its own doc line, because merge-requests' missing_docs warned. The contract's doc on `project` is unchanged.",
    "Line 1 of each AGENTS.md is a single ~31K/19K-character paragraph, so I added a 'Reviewed marks' paragraph instead of rewriting it. src-tauri's line 1 is now stale on: Range's fields, RangeState's fields, start_range's argv, and the dependency list (no `reviewed`). The docs keeper may fold these in.",
    "args.rs is 540 lines; it was already 439 before this slice. Its tests were not moved out.",
    "Decided: a second `--review-of` replaces the first unless the first was malformed (the error is kept, as with `--diff=`). The reviewed store is opened before the threads store; both come after listing."
  ],
  "open_risks": [
    {
      "location": "src-tauri/src/range/tests.rs:25-36",
      "risk": "with_marks_copied leaves the first mock app's state alive for the rest of the test process (the existing tests already leak this way). The reopen tests depend on copying yamt/reviewed/ rather than on a real close."
    },
    {
      "location": "src-tauri/src/reviewed/tests.rs:72-86",
      "risk": "The since-review test checks only how many differences there are (1), not their shape. The shape is Difference's, which the core crate owns."
    }
  ]
}
