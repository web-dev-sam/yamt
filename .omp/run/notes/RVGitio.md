I added `yamt-gitio`'s commit-range reads: `Repo::changed_files`, `Repo::merge_base`, `Repo::common_dir` and `Repo::blob_sizes`. All four match the brief's Contract exactly. All four commands named in the brief passed, and every test in the brief's list passes.

```
summary
  - `Repo::changed_files(old, new)` runs the brief's single `git diff-tree` command (raw records plus counts, `-z`).
    A pure parser turns its output into `ChangedFile { change, numstat }`.
  - Counts are matched to records by destination path, never by position. A record with no count is `Numstat::Missing`.
    Raw `C`, `U`, `X` or any other status gives `Error::UnexpectedOutput`.
  - `Repo::merge_base`: exit 1 with no message gives `None`; any other failure is an error.
  - `Repo::common_dir`: the absolute common git dir, the same from every worktree.
  - `Repo::blob_sizes`: one `cat-file --batch-check --buffer` run; answers in input order, `<oid> missing` gives `None`.
  - The four new types are re-exported from `lib.rs`.

files_changed
  crates/gitio/src/diff.rs   (new)
  crates/gitio/src/repo.rs
  crates/gitio/src/blob.rs
  crates/gitio/src/lib.rs
  crates/gitio/tests/diff.rs (new)

tests_added
  Unit tests in crates/gitio/src/diff.rs (on byte strings):
  - numstat_records_out_of_raw_order_are_matched_by_destination_path: catches counts matched by position; covers M,
    R087 (with the `\0old\0new\0` count form), D and A.
  - a_binary_pair_is_binary_and_a_pair_without_a_numstat_record_is_missing: `-\t-\t` gives Binary; a `T` record with
    no count gives Missing.
  - a_half_binary_count_is_unexpected_output: `-\t3` is refused.
  - two_numstat_records_for_one_path_are_unexpected_output: one count must not silently overwrite another.
  - a_path_with_a_tab_a_newline_a_space_and_non_utf8_bytes_is_kept_as_bytes (unix): the path's bytes round-trip.
  - no_output_is_no_changed_file: empty output gives an empty list.
  - copied_unmerged_and_unknown_statuses_are_unexpected_output: C075, U, X, a bare R, Rx, MM.
  - output_cut_inside_a_record_is_unexpected_output: a rename with no new path, a rename-form count with no new path,
    output with no final NUL.

  Integration tests in crates/gitio/tests/diff.rs (real temp repositories):
  - added_modified_deleted_files_are_listed_with_git_s_counts: the exact list, with modes, blob ids and counts
    2/0, 2/1, 0/3.
  - a_renamed_file_lists_both_paths_and_counts_only_its_edits: Renamed old/name.txt → new/name.txt, counts 1/1.
  - a_binary_file_is_listed_without_counts: an added and a modified binary file are both Binary.
  - a_mode_only_change_lists_both_modes_and_one_blob_id: 100644 → 100755 with the same blob id, counts 0/0.
  - a_submodule_commit_change_is_listed_as_a_gitlink: 160000 on both sides with the two commit ids, counts 1/1.
  - a_file_replaced_by_a_link_is_one_modified_entry_with_both_modes (unix): one Modified entry, 100644 → 120000,
    counts 1/1.
  - the_users_diff_config_does_not_change_the_list: runs the ignored test `listing_under_the_users_diff_config` in a
    child process with GIT_EXTERNAL_DIFF=false and GIT_DIFF_OPTS=--unified=0. That test sets repository config
    diff.relative, diff.orderFile (order would be z/* first), diff.renames=false, diff.algorithm=minimal,
    diff.external=false, diff.ignoreSubmodules=all and diff.noprefix, then asserts the exact list: the gitlink is
    kept, the rename is found, and the order is not the order file's.
  - paths_with_spaces_newlines_and_non_utf8_bytes_round_trip: a rename "old name.txt" → "renamed\tname.txt", an
    added "new\nline.txt", and on unix an added "bytes \xff\xfe.txt".
  - merge_base_is_the_fork_point_and_none_for_unrelated_histories: also checks that an unknown commit is
    `GitFailed`, not `None`.
  - blob_sizes_answer_in_order_and_missing_as_none: asking [3 bytes, missing, empty] gives
    [Some(3), None, Some(0)]; an empty ask gives an empty list.
  - common_dir_is_the_same_from_a_linked_worktree: the main worktree and a linked one give the same path, which is
    the main `.git` and is absolute.

smoke_evidence
  cargo fmt --check → FMT_OK (no diff)
  cargo clippy --workspace --all-targets -- -D warnings → no errors or warnings
  cargo test -p yamt-gitio →
    unittests src/lib.rs   test result: ok. 33 passed; 0 failed
    tests/diff.rs          test result: ok. 11 passed; 0 failed; 1 ignored
                           (the ignored one runs in a child process and passed there)
    every other gitio test binary passed (5+12+6+26+19+4+10 passed, 0 failed)
  just arch-check → "arch-check: ok"
  Smoke shapes (added, modified, deleted, renamed with an edit, binary, chmod only, gitlink, file → link): each gives
  exactly one entry with the right variant, modes and counts, asserted with `assert_eq!` on the whole list in the
  integration tests above.

deviations_from_brief
  - repo.rs: renamed the private `is_unresolved_name` / `UNRESOLVED_NAME_STATUS` to `is_silent_failure` /
    `SILENT_FAILURE_STATUS`. `merge_base` now shares the rule "exit 1 with an empty stderr" with `commit_named` and
    `submodule_head`, and the comment cites both git sources. No behaviour change.
  - blob_sizes adds `--buffer` (one process, output flushed at the end) and accepts only answers of type `blob`.
    Another type, or an answer whose id differs from the asked id, is `UnexpectedOutput`.
  - git's own entry order is kept: a renamed pair sits at its destination path's place (observed:
    vendor/lib, z/counted.txt, then the rename a/moved.txt → z/moved.txt). Sorting by display path is left to
    yamt-range, as the design's §1 [INFERENCE] says.
  - The parser refuses two count records for one destination path with `UnexpectedOutput`; the brief left this
    case open.
  - Docs not owned by this slice: crates/gitio/AGENTS.md and the project map's gitio line should name `diff.rs` and
    the three new Repo reads (the D0 docs slice).

open_risks
  - crates/gitio/src/diff.rs:72-81: no test fails if `--ignore-submodules=none` or `--diff-algorithm=histogram` is
    dropped. diff-tree reads neither diff.ignoreSubmodules nor diff.algorithm, and the test content (a b c x d e →
    x a b c d e) counts 1/1 under both minimal and histogram. A file whose counts differ between histogram and Myers
    would pin the histogram flag; `just mutants` may report these lines.
  - crates/gitio/src/blob.rs:40-41: the `named == oid` guards are never false in a real run (git echoes the asked
    id), so their mutants may survive.
  - The repository's own `.gitattributes` still decides "binary" (intended, design §1); no test covers a `-diff`
    attribute.
```