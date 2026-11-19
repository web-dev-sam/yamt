# RangeReviewedCore

Agent output (`agent://RangeReviewedCore`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedCore.md), collected 2026-11-19T09:19:47.122Z.

{
  "summary": "New crate `yamt-reviewed`: `ReviewOf` (key text, FNV-named folder) and `ReviewedStore` (open, marks, mark, unmark, since_review) over `reviewed.json` format 1 and `texts/<blob id>`. Each write locks, re-reads, writes text first, applies one change, temp+rename. Newer file → NewerFormat; broken or another review → Broken. `yamt-range` adds pub `Dots`, `fnv1a_64`, `SideName(s)`, `SideObject`, `FileSides`, and `Range::{side_names, repo_key, sides, right_text}`.",
  "files_changed": [
    "crates/range/src/lib.rs",
    "crates/range/src/spec.rs",
    "crates/range/src/lock.rs",
    "crates/range/src/open.rs",
    "crates/range/src/entries.rs",
    "crates/range/src/load.rs",
    "crates/range/src/side_names.rs",
    "crates/range/AGENTS.md",
    "crates/reviewed/Cargo.toml",
    "crates/reviewed/AGENTS.md",
    "crates/reviewed/src/lib.rs",
    "crates/reviewed/src/review_of.rs",
    "crates/reviewed/src/stored.rs",
    "crates/reviewed/src/store.rs",
    "crates/reviewed/tests/reviewed.rs",
    "crates/reviewed/tests/fixture/mod.rs",
    "crates/reviewed/tests/stored_file/mod.rs",
    "src-tauri/Cargo.toml",
    "scripts/arch-check.sh"
  ],
  "tests_added": [
    {
      "name": "range side_names::side_names_follow_the_branch_head_names_and_keep_a_commit_id",
      "proves": "dev...HEAD on feature-x gives Ref refs/heads/dev, Three, Ref refs/heads/feature-x; main..<abbrev id> gives Commit with the full id"
    },
    {
      "name": "range side_names::a_detached_head_and_an_expression_are_the_commit_they_name_now (+ a_side_name_git_no_longer_knows_is_unknown_name)",
      "proves": "Detached HEAD and HEAD~1 become Commit ids; a deleted branch gives UnknownName"
    },
    {
      "name": "range load::right_text_is_the_right_column_load_shows_and_none_when_load_shows_no_texts",
      "proves": "Text gives its right side; binary, too large, not UTF-8 on either side and submodule give None; deleted gives Some(\"\"); every value equals load's Texts.right; a file past the list is UnknownFile"
    },
    {
      "name": "range open::sides_name_each_side_s_object_and_kind_and_none_for_a_missing_side",
      "proves": "Added, deleted, made-executable and submodule files report git's ids and kinds, with None for a missing side; a file past the list is UnknownFile"
    },
    {
      "name": "range lock::repo_key_is_the_pair_lock_s_repository_folder",
      "proves": "Range::repo_key equals the repository folder name PairLock::take uses"
    },
    {
      "name": "reviewed: 13 tests in tests/reviewed.rs",
      "proves": "Design §4 core: missing file; new commit; moved left; changed right; rename drops the mark and sweeps its text; mark again; unmark; past-list UnknownFile; since-review kept/binary/deleted/not-UTF-8; two stores keep both"
    },
    {
      "name": "reviewed: 10 tests in tests/stored_file/",
      "proves": "Key text; pinned folder name d4da12ac15071dca and exact JSON; newer/broken/other-review/unsorted/foreign-id refused with the file untouched; read failures; failed write; leftover .tmp; not a pair folder"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt --check",
      "observed": "fmt exit=0"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Finished `dev` profile … clippy exit=0. It was re-run with -p yamt-reviewed after the last test was added: no warnings."
    },
    {
      "command": "cargo test -p yamt-range -p yamt-reviewed",
      "observed": "yamt_range unit: 18 passed; listing_answers 6; lock 3; range 11; reviewed: 23 passed; 0 failed"
    },
    {
      "command": "just arch-check",
      "observed": "arch-check: ok"
    },
    {
      "command": "just arch-check with a temporary `tauri.workspace = true` in crates/reviewed/Cargo.toml (since reverted)",
      "observed": "arch-check: yamt-reviewed depends on yamt-range, yamt-gitio and yamt-merge-core only among yamt crates, and never on tauri, not: tauri tauri-codegen … error: recipe `arch-check` failed … exit code 1"
    },
    {
      "command": "scripts/range-repo.sh target/measure/repo, then a throwaway ignored test (since deleted) that marks all 13 files of main...feature (release build), then du -sb on the review folder",
      "observed": "files 13 slowest mark 2.257699ms; 18548 bytes in the review folder (reviewed.json 3678 B, 6 texts, the largest 13356 B)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 82 mutants, 57 caught, 25 unviable, 0 missed. The first run missed 2 (NotFound guards in read_reviewed and sweep_texts); the read-failure test was added and the re-run killed both.",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Root Cargo.toml (orchestrator): add \"crates/reviewed\" to `members`, and `yamt-reviewed = { path = \"crates/reviewed\" }` to `[workspace.dependencies]`. Meanwhile src-tauri/Cargo.toml holds `yamt-reviewed = { path = \"../crates/reviewed\" }`.",
    "`since_review` on a file that has no mark answers `NoText` instead of an error, so the contract's Error enum needed no new variant.",
    "`RangeEntryKind` now also derives `Deserialize`, so `reviewed.json` stores its kinds directly. The generated bindings are unchanged.",
    "Added `Range::sides`, `Range::right_text` and the private `file_at`; `Range::load` now uses `file_at`. `open.rs`'s `commit_named` is now pub(crate), for `side_names`.",
    "Tests: `tests/reviewed.rs` plus modules `tests/fixture/mod.rs` and `tests/stored_file/mod.rs`, one binary (the yamt-review pattern). Extra tests: past-list UnknownFile, not text today, out of order or foreign id, read failures, a side name git no longer knows.",
    "Open writes nothing, not even the lock file, when the review folder does not exist. `reviewed.json` is also Broken when its marks are out of path order or an id is not git's; this keeps a stored id from naming a path outside `texts/`.",
    "`write_atomically` is a third copy of the temp-plus-rename helper (also in compare/files.rs and review/thread_file.rs). No crate shares it, and adding a shared dependency would be an abstraction serving three separate stores.",
    "Missing `left`/`right` fields read as null (serde treats Option fields as optional); only a missing `path` or `keptText` is Broken."
  ],
  "open_risks": [
    {
      "location": "crates/reviewed/src/store.rs since_review / stored.rs sweep_texts",
      "risk": "An older window can still hold a mark whose text another window's open has swept: window A on the old pair, B re-marks the file, C opens and sweeps. A's since_review for that file then answers ReadFailed until A reopens. This needs three windows on one review."
    },
    {
      "location": "crates/reviewed/src/store.rs mark",
      "risk": "Design §2 A measurement: on the range-repo.sh repository (main...feature, 13 files), the review folder holds 18548 bytes with every file marked. The slowest mark is 2.26 ms in a release build: lock, re-read, text write and JSON write (temp + rename)."
    },
    {
      "location": "crates/range/src/side_names.rs side_name",
      "risk": "Each side costs two git calls (commit_named, then symbolic_full_name), four per side_names call. A name git finds ambiguous between a branch and a tag gets git's own answer, not tested."
    }
  ]
}
