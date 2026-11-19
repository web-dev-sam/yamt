# RangeReviewedCoreR1

Agent output (`agent://RangeReviewedCoreR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedCoreR1.md), collected 2026-11-19T09:29:11.269Z.

{
  "summary": "#2538: a missing `texts/<id>` now reads as `None`, so `since_review` answers `NoText` (was `ReadFailed`) when another window's open swept it. Any other read error is still `ReadFailed`. #2539: a mark missing `left` or `right` is `Broken` (`deserialize_with = \"Option::deserialize\"`). #2536: `listed_marks` is now `prune_unlisted_marks`. No pub signature or stored-format shape changed.",
  "files_changed": [
    "crates/reviewed/src/store.rs",
    "crates/reviewed/src/stored.rs",
    "crates/reviewed/AGENTS.md",
    "crates/reviewed/tests/reviewed.rs",
    "crates/reviewed/tests/stored_file/mod.rs"
  ],
  "tests_added": [
    {
      "name": "reviewed::a_kept_text_swept_by_another_window_s_open_is_no_text",
      "proves": "#2538 with two stores: A marks a.txt; after a new commit, B re-marks it and a reopen sweeps A's text. Only the new text remains, and A's since_review is NoText, not ReadFailed."
    },
    {
      "name": "stored_file::a_kept_text_that_cannot_be_read_is_read_failed",
      "proves": "A kept text that exists but cannot be read (a directory) is still ReadFailed naming its path; only NotFound means NoText (kills the NotFound-guard mutant)."
    },
    {
      "name": "stored_file::a_mark_that_kept_no_text_is_no_text_whatever_texts_holds",
      "proves": "A mark with keptText:false answers NoText even when a texts/<right id> file exists: the stored flag decides, not the disk (kills the kept_text-guard mutant)."
    },
    {
      "name": "stored_file::a_broken_file_names_line_and_column_and_is_left_unchanged (extended)",
      "proves": "#2539: a mark missing `left` is Broken \"missing field `left` at line 1 column 174\"; one missing `right` is Broken \"missing field `right` at line 1 column 202\"; the file is unchanged."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo clippy -p yamt-reviewed -p yamt-range --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.20s (no warnings)"
    },
    {
      "command": "hermetic env cargo nextest run -p yamt-reviewed -p yamt-range",
      "observed": "Summary [   4.216s] 64 tests run: 64 passed, 0 skipped"
    },
    {
      "command": "cargo test -p yamt-reviewed (first run, before the column was pinned)",
      "observed": "left: \"missing field `right` at line 1 column 202\" — a mark missing `right` is now refused as Broken (it was null before)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 10 mutants; 10 mutants tested in 28s: 8 caught, 2 unviable",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The existing `{\"path\":\"a.txt\"}` case in the broken-file test now expects \"missing field `left` … column 174\" instead of `keptText`: serde reports the first missing field, and `left` now comes first.",
    "Two extra tests kill the mutants on the changed `since_review`/`kept_text` lines (VF7).",
    "crates/reviewed/AGENTS.md got two phrases, written with a python string replace (should have been the edit tool): Broken now names a mark missing `left` or `right`; since_review answers `NoText` when another window's open swept the kept text.",
    "`SinceReview::NoText`'s `///` doc in lib.rs is unchanged: specta exports it into ipc/bindings.ts, which another slice owns. The swept case is documented on `since_review` in store.rs only."
  ],
  "open_risks": [
    {
      "location": "crates/reviewed/src/lib.rs:40",
      "risk": "`NoText`'s doc (exported to bindings) does not list the swept-text case. Main or the docs keeper may want to add it with a `just bindings` run."
    },
    {
      "location": "docs/slices/briefs/range-reviewed-core.md:127",
      "risk": "The brief/design docs still describe since_review without the swept-text → NoText case, and the stored format without the required `left`/`right` keys; not owned here."
    }
  ]
}
