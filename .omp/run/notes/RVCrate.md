I've built the new `yamt-range` crate as the brief describes. All the acceptance tests pass, and so do all four required commands: `cargo fmt --check`, `cargo clippy`, `cargo test` on the four packages, and `just arch-check`.

```
summary
  - New crate crates/range (yamt-range). It holds every Contract type with its serde shape, and the messages for
    Error and SpecError. It provides RangeSpec::parse/text, Resolved::resolve/root/list, Range::start/load
    (Range is Send + Sync) and PairLock::take/folder.
  - Listing: one changed_files run and one blob_sizes run (gitlinks are never sent to it). Entries are sorted by
    display path and ids follow that order. load decides the answer from listing data in #105's order, so a blob it
    answers from the listing is never read. Otherwise it reads at most two blobs with one BlobReader and answers
    Texts with merge_core::compare, or NotUtf8.
  - The 8 MiB limit now lives in merge-core only: yamt_merge_core::MAX_TEXT_BYTES. session/decode.rs uses it, and
    a test in compare pins MAX_COLUMN_BYTES to it.
  - arch-check: yamt-range may depend on yamt-gitio and yamt-merge-core only among the yamt crates, never on tauri;
    yamt-app may also depend on yamt-range.

files_changed
  crates/range/Cargo.toml (new)
  crates/range/AGENTS.md (new)
  crates/range/src/lib.rs (new)
  crates/range/src/spec.rs (new)
  crates/range/src/open.rs (new)
  crates/range/src/entries.rs (new)
  crates/range/src/load.rs (new)
  crates/range/src/lock.rs (new)
  crates/range/tests/range.rs (new)
  crates/merge-core/src/lib.rs   (MAX_TEXT_BYTES)
  crates/session/src/decode.rs   (pub(crate) use yamt_merge_core::MAX_TEXT_BYTES)
  crates/compare/src/lib.rs      (the pin test; one doc line, see deviations)
  scripts/arch-check.sh
  src-tauri/Cargo.toml           (only the path dependency line)
  Cargo.lock                     (cargo regenerated it; not in Owned)

tests_added
  spec.rs:
    - two_dots_three_dots_and_empty_sides_read_as_typed_or_head: the brief's valid examples, plus "...dev" and
      "a.b..c-d"; an empty side becomes HEAD.
    - every_malformed_range_is_its_error: "", "main", "a.b", "a....b", "a..b..c", "a...b...c", "-x..b", "a...-x".
    - each_error_is_its_usage_line: the usage lines of design §1's table, word for word.
  entries.rs:
    - rows_are_sorted_by_path_and_a_deleted_row_is_named_by_its_old_path: also covers the rename's old_path and the
      counts (Counted / NotCounted).
    - sizes_go_to_the_sides_in_blob_id_order_and_never_to_a_gitlink: the order of blob_ids matches how files_at
      hands out the sizes; a gitlink gets no size; numstat Binary sets the binary flag.
    - a_mode_names_its_kind: 100644, 100755, 120000 and 160000 map to File, Executable, Link and Submodule.
  lock.rs:
    - fnv1a_64_gives_the_published_vectors: "a" → af63dc4c8601ec8c, plus "" and "foobar".
    - the_key_names_the_work_tree_folder_or_a_bare_repository_and_hashes_the_common_dir
  compare/src/lib.rs:
    - the_column_limit_is_merge_core_s_text_limit: usize::try_from(MAX_COLUMN_BYTES) == Ok(MAX_TEXT_BYTES).
  tests/range.rs (real temp repositories; all 16 design §10 names, plus one more):
    - three_dots_compares_the_merge_base_and_two_dots_the_tips: the file sets differ; the labels are MergeBase and
      Named; short ids and subjects are checked; start().range is the text as typed.
    - a_criss_cross_range_lists_what_git_diff_three_dots_lists: the test first checks that merge-base --all gives
      2 bases, then compares the list with `git diff --name-only x...y`.
    - an_empty_side_is_head: "main.." lists the same files as "main..local", with the right labelled HEAD; ".."
      lists nothing.
    - unknown_name_not_a_repository_and_no_merge_base_are_their_errors: the variant and its Display line for each;
      git's message is cut to its first line.
    - added_has_an_empty_left_and_deleted_an_empty_right
    - renamed_shows_the_old_text_left
    - binary_is_answered_before_size_and_without_reading: a NUL blob of 8 MiB + 1; its loose object is deleted after
      listing.
    - exactly_8_mib_loads_and_one_byte_more_is_too_large: the larger blob's object is deleted too.
    - non_utf8_names_the_sides: Left, Right, Both.
    - mode_only_kind_changed_and_submodule_are_sentences: the objects behind the mode-only and kind-change files
      are deleted; a changed submodule and an added one (old None).
    - a_link_is_shown_as_its_target_text: links staged through --cacheinfo 120000, so it runs on Windows too.
    - texts_carry_merge_core_compare_s_differences: also checks that a mode change together with a content change
      gives mode Changed{File, Executable}.
    - an_unknown_id_is_unknown_file
    - a_range_is_shared_between_threads: a compile-time Send + Sync check; this is the extra test.
    - the_same_pair_twice_is_locked_naming_both_short_ids: the same pair typed differently ("<main id>..HEAD");
      the folder is <range_dir>/<key>/<left oid>-<right oid> with its lock file; taking it again after the drop
      succeeds.
    - another_worktree_of_the_same_repository_shares_the_lock: the Locked error names the linked worktree's root.
    - a_different_pair_is_not_locked: other tips and the reversed pair each get their own folder under the same
      repo key; another repository gets a different key.

smoke_evidence
  cargo fmt --check → FMT_OK
  cargo clippy --workspace --all-targets -- -D warnings → "Finished `dev` profile …", no warnings
  cargo test -p yamt-range -p yamt-merge-core -p yamt-session -p yamt-compare →
    yamt_range unittests   test result: ok. 8 passed; 0 failed
    tests/range.rs         test result: ok. 17 passed; 0 failed (2.91s)
    yamt_compare unittests test result: ok. 12 passed; 0 failed   (includes the pin test)
    every merge-core, session and compare test binary: ok, 0 failed (1 ignored in session operations.rs, as before)
  just arch-check → "arch-check: ok"

deviations_from_brief
  - Root Cargo.toml (shared; orchestrator): add `"crates/range",` to members and
    `yamt-range = { path = "crates/range" }` to [workspace.dependencies]. Afterwards, src-tauri can use
    `yamt-range.workspace = true`.
  - Cargo.lock: cargo regenerated it (+14 lines for yamt-range).
  - The repo key's name part: the brief says "the work tree folder's name", but each worktree has its own folder
    name, so another_worktree_of_the_same_repository_shares_the_lock could not pass. I took the name from the
    common git dir instead: its parent's name when the common dir is `.git`, otherwise its own name (a bare
    repository or `--separate-git-dir`). The key now depends only on the common dir, as #107 intends. I kept the
    name as an OsString, so nothing goes through lossy UTF-8.
  - FileAt does not keep the path bytes (Change step 3). Blobs are read by object id, so nothing reads a path, and
    an unread field would fail clippy's dead_code check. B and C can add them when they need them.
  - RangeSpec keeps each side as a String with HEAD already filled in, instead of the design's Option<String>
    (one concept fewer).
  - ModeOnly compares the two sides' kinds rather than their raw modes. git's trees hold only canonical modes, so
    the two are equivalent.
  - compare/src/lib.rs: besides the pin test, I fixed the doc line on MAX_COLUMN_BYTES, which named "`session`'s
    `MAX_TEXT_BYTES`" and now names `yamt_merge_core::MAX_TEXT_BYTES`.
  - session/decode.rs re-exports the constant (`pub(crate) use yamt_merge_core::MAX_TEXT_BYTES`), because
    merge_data.rs and sides.rs import it from crate::decode and are not in Owned.
  - Docs not in Owned (for the docs slice): the project map's tree, PM1's text and the dependency diagram should
    name yamt-range; docs/architecture.md needs its §7 crate list updated.

open_risks
  - crates/range/src/load.rs:62 `u32::try_from(MAX_TEXT_BYTES).unwrap_or(u32::MAX)`: a mutant of the fallback
    survives, because the conversion cannot fail with 8 MiB.
  - scripts/arch-check.sh:44-49: the new yamt-range rule has no committed test of its failing path. The existing
    per-crate rules have none either; I only saw it pass ("arch-check: ok").
  - crates/range/tests/range.rs a_criss_cross_range_…: this relies on `git diff a...b` and `git merge-base` picking
    the same first base among several, which is git's behaviour today (both call repo_get_merge_bases).
  - crates/range/src/open.rs not_a_repository: every GitFailed from `discover` is treated as "not a repository";
    other errors (an Io error for a cwd that does not exist) come back as Error::Git.
```