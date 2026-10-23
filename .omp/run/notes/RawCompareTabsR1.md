# RawCompareTabsR1 (3.C-tabs rework 1, board Raw compare row 4)

All six blocks are fixed. `cargo fmt --check` and `cargo clippy --workspace --all-targets -- -D warnings` are clean, and `cargo test -p yamt-compare` passes. I applied the hand mutations for blocks 1, 2 and 6 by hand: each new test failed, and I reverted every mutation. No public signatures changed.

```
summary
  1. A `tabs.json` or column file that exists but can't be read now has a test pinning `ReadFailed`.
  2. The 8 MiB column limit is written as a literal in three tests.
  3. The order in `close_tab` (write the index first, then delete the files) is now tested.
  4. An index with `nextId` or a tab `number` at `u32::MAX` is refused at open as `Broken`.
  5. A column file name only counts as a tab's when `column_path` would write exactly that name (new `column_file_name` in `files.rs`).

files_changed
  crates/compare/src/index.rs
  crates/compare/src/files.rs
  crates/compare/tests/opening.rs
  crates/compare/tests/columns.rs
  crates/compare/tests/tabs.rs

tests_added
  opening.rs a_tabs_json_that_cannot_be_read_is_read_failed_and_nothing_in_the_folder_changes:
    a directory named tabs.json → Err(ReadFailed{path: dir/tabs.json}); no lock file
    is created; 7-left.txt is kept with its bytes (#1480).
  columns.rs a_column_file_that_cannot_be_read_fails_at_load_and_no_set_column_overwrites_it:
    a directory at <id>-left.txt → load_tab gives ReadFailed with that path; set_column
    on Left and on Right gives ReadFailed; the directory is still there; no right file
    is written (#1481).
  tabs.rs a_failed_index_write_at_close_keeps_the_tab_and_both_its_column_files:
    a non-empty directory tabs.json.tmp → close_tab gives WriteFailed{path: tabs.json};
    both column files keep "text"; start().list still lists the tab (#1483).
  index.rs a_next_id_at_u32_max_is_broken_so_a_new_tab_never_overflows (#1484)
  index.rs a_tab_number_at_u32_max_is_broken_so_a_new_tab_never_overflows (#1484)
  changed tests:
    opening.rs the_first_open_…: column_limit == 8 * 1024 * 1024 (#1482)
    columns.rs a_column_exactly_at_the_limit_is_stored and
      a_column_over_the_limit_…: the literal 8 * 1024 * 1024 instead of the constant (#1482)
    files.rs other_names_are_no_column_files: added "03-left.txt", "+3-left.txt",
      "+7-right.txt.tmp" (#1487)

smoke_evidence
  cargo fmt --check → no output, exit 0
  cargo clippy --workspace --all-targets -- -D warnings → "Finished `dev` profile", no warnings
  cargo test -p yamt-compare → test result: ok. 11 / 18 / 10 / 17 / 0 passed; 0 failed
  Block 1, index.rs:138 guard → `Err(_error) if true => Ok(None)`:
    panicked at crates/compare/tests/opening.rs:123:5:
    Err(WriteFailed { path: "/tmp/.tmpR5Cqnw/tabs.json", message: "Is a directory (os error 21)" })
    test result: FAILED. 0 passed; 1 failed   → reverted
  Block 2, files.rs:63 guard → `Err(_error) if true => return Ok(Arc::from(""))`:
    panicked at crates/compare/tests/columns.rs:272:5:
    Ok(LoadedTab { left: "", right: "", versions: ColumnVersions { left: ColumnVersion(0), right: ColumnVersion(0) } })
    test result: FAILED. 0 passed; 1 failed   → reverted
  Block 6, exact-name check removed (`Some(tab)`):
    panicked at crates/compare/src/files.rs:149:9: assertion `left == right` failed
      left: Some(TabId(3))  right: None        (the "03-left.txt" line) → reverted
  Extra, not required by the brief, all in one run:
    lib.rs:110 `8 * 1024 + 1024` → panics at columns.rs:229:10 (at-the-limit test)
      and opening.rs:38:5 (column_limit)
    store.rs close_tab with remove_columns before commit → panics at tabs.rs:170:47
    both reverted; after reverting, the store.rs and lib.rs snapshot tags matched the originals.

deviations_from_brief
  - #1487: rather than the brief's example `(TabId(id).0.to_string() == digits)`, the
    write side's name is now its own fn, `column_file_name(tab, column)` (used by
    `column_path`), and `column_file_tab` keeps an id only when
    `column_file_name(tab, column) == name` for one of the two columns. This way the
    name rule exists once.
  - Added "+7-right.txt.tmp" (the brief's own example) to other_names_are_no_column_files,
    next to the two names the brief asked for.
  - Problem messages chosen: "`nextId` 4294967295 leaves no id for a new tab" and
    "the tab number 4294967295 leaves no number for a new tab". The `nextId` check runs
    right after the empty-`tabs` check; the number check runs in the existing per-tab loop.

open_risks
  - crates/compare/src/index.rs:51-53: refusing u32::MAX at open leaves a gap. A
    hand-edited file with nextId = u32::MAX - 1 (or a number = u32::MAX - 1) passes;
    the first add_tab brings it to MAX, and the second `+ 1` panics in debug (under row
    6's Mutex) or wraps in release. Closing this needs checked_add in Index::add_tab and
    a way to report it from TabStore::add_tab. I didn't do it because it is outside
    #1484's wording.
  - The failing paths in blocks 1, 2 and 4 rely on reading or writing over a directory
    failing. On Linux the messages are EISDIR (observed). On Windows I expect
    PermissionDenied, also not NotFound [INFERENCE, not run].
```

Checks for Main to run on the merged tree: `just check` (the integrated run) and `just mutants` on `crates/compare`.