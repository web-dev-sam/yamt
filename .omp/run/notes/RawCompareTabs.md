# RawCompareTabs (3.C-tabs, board Raw compare row 4)

The `yamt-compare` crate is in place. Every Acceptance line has a passing test: `cargo test -p yamt-compare` gives 51 tests (9 unit + 42 integration), all passing. `cargo fmt --check`, `cargo clippy --workspace --all-targets -D warnings` and `just arch-check` are clean.

**summary**
- New crate `crates/compare` (package `yamt-compare`) with the brief's Contract unchanged: the IPC types, `MAX_COLUMN_BYTES`, `Error`, `LoadedTab` (each column an `Arc<str>`, plus both versions), `TabStore` with its 9 methods, and `comparison` / `tab_texts`.
- On disk: `tabs.json` (format 1), `<id>-left.txt` / `<id>-right.txt`, and a `lock` file held with `File::try_lock`. Every write goes to `<name>.tmp` and is then renamed. `tabs.json` is only rewritten when the index actually changed.
- `src-tauri` gets a path dependency on the crate, so it becomes a workspace member. `scripts/arch-check.sh` now limits `yamt-compare` to `yamt-merge-core` among `yamt-*` crates and bans `tauri`; it also lets `yamt-app` depend on `yamt-compare`.

**files_changed**
- `crates/compare/Cargo.toml`
- `crates/compare/AGENTS.md`
- `crates/compare/src/lib.rs`, `src/store.rs`, `src/index.rs`, `src/files.rs`
- `crates/compare/tests/opening.rs`, `tests/tabs.rs`, `tests/columns.rs`
- `src-tauri/Cargo.toml` (one line: `yamt-compare = { path = "../crates/compare" }`)
- `scripts/arch-check.sh`
- `Cargo.lock` (cargo added the new package, 13 lines)

**tests_added**

Opening (`tests/opening.rs`):
- `the_first_open_creates_the_folder_compare_1_and_its_tabs_json`: the exact JSON (`{format 1, shown 1, nextId 2, tabs:[{id 1, number 1, "Compare 1", auto}]}`); the folder then holds only `lock` and `tabs.json`.
- `an_existing_tabs_json_is_read_not_replaced`
- `broken_json_is_broken_with_its_line_and_nothing_in_the_folder_changes`: the message contains "line 3"; folder contents and bytes are the same after, and no lock file appears.
- `a_shape_that_is_not_format_1_is_broken`
- `format_2_is_newer_format_and_nothing_in_the_folder_changes`
- `a_second_open_while_the_first_lives_is_locked_and_opens_after_it_is_dropped`
- `a_locked_open_writes_nothing`: an orphan stays while the store is locked.
- `orphan_column_and_temp_files_are_removed_and_foreign_files_kept`
- `no_temp_file_is_left_after_a_write`

Tab rules (`tests/tabs.rs`):
- `a_new_tab_is_appended_last_and_shown`
- `closing_compare_2_of_three_numbers_the_next_tab_4_not_a_reused_2`
- `closing_all_but_compare_1_numbers_the_next_tab_2`
- `ids_never_repeat_even_when_numbers_do`
- `closing_the_last_tab_leaves_a_fresh_compare_1_with_a_new_id`
- `closing_the_shown_tab_shows_the_next_one`
- `closing_the_shown_last_tab_shows_the_previous_one`
- `closing_a_hidden_tab_keeps_the_shown_one`
- `closing_a_tab_deletes_both_its_column_files`
- `rename_trims_the_name`
- `rename_with_spaces_only_keeps_the_name_and_writes_nothing`: checks the modified time.
- `showing_the_shown_tab_again_does_not_rewrite_the_index`
- `show_tab_changes_the_shown_tab`
- `set_language_picks_and_returns_to_auto`
- `every_operation_on_an_unknown_id_is_unknown_tab`
- `a_restart_reads_back_order_names_languages_and_the_shown_tab`

Columns (`tests/columns.rs`):
- `set_column_writes_that_column_and_returns_both_texts_and_versions`
- `set_column_rewrites_only_that_columns_file_not_the_other_nor_the_index`: the other column file and `tabs.json` keep their modified time and bytes.
- `a_stale_or_equal_version_stores_nothing_and_replies_with_the_stored_versions`
- `versions_start_at_0_for_every_tab_at_open`
- `a_restart_reads_back_both_texts_of_every_tab`
- `a_missing_column_file_reads_as_an_empty_column`
- `load_tab_reads_the_files_once`
- `a_column_over_the_limit_is_too_large_and_nothing_is_written_or_stored`
- `a_column_exactly_at_the_limit_is_stored`: catches a `>=` slip in the limit check.
- `a_column_file_over_the_limit_is_too_large_at_load`
- `a_non_utf8_column_file_fails_at_load_and_no_other_call_rewrites_it`: tries `set_column` on both columns, rename, add, show and a reopen; the bytes stay the same.
- `holds_text_comes_from_the_file_sizes_before_a_load_and_from_the_texts_after`
- `holds_text_of_an_unloaded_tab_reads_no_text`
- `set_column_on_a_tab_never_loaded_keeps_the_other_columns_file_text`
- `comparison_is_merge_core_compare_on_the_two_texts`
- `a_failed_write_changes_nothing_in_memory` (unix: read-only folder)
- `a_failed_rename_removes_its_temporary_file`

Unit tests:
- `files::tests`: 2 tests on which file names count as column or temp files.
- `index::tests`: 7 tests, one per refusal rule (no tabs, repeated id, id not below `nextId`, shown tab not listed, format 0), plus the first index and a picked language read back.

**smoke_evidence**
- `cargo fmt --all --check && echo FMT-OK` → `FMT-OK`
- `cargo clippy --workspace --all-targets -- -D warnings` → `Finished \`dev\` profile … in 23.72s`, no warnings. Re-run with `-p yamt-compare` after the last test was added → `Finished`.
- `cargo test -p yamt-compare`:
  - unit tests: `test result: ok. 9 passed`
  - `tests/columns.rs`: `ok. 17 passed`
  - `tests/opening.rs`: `ok. 9 passed`
  - `tests/tabs.rs`: `ok. 16 passed`
- `just arch-check` → `arch-check: ok`
- Failing path of the new arch-check rule: no committed test exists for `arch-check.sh`, so I fed its grep pipeline made-up inputs.
  - Compare-crate rule, given `serde, tauri, yamt-compare, yamt-merge-core, yamt-settings` → prints `tauri`, `yamt-settings`.
  - App rule, given `yamt-app, yamt-compare, yamt-gitio` → prints `yamt-gitio`.
  - The real `cargo tree -p yamt-compare` lists only `yamt-compare` and `yamt-merge-core` among `yamt-*` / `tauri`.

**deviations_from_brief**
1. Root `Cargo.toml` is not mine to edit. The crate is a member only through the path dependency. The orchestrator should add:
   - `"crates/compare",` to `members`
   - `yamt-compare = { path = "crates/compare" }` under `[workspace.dependencies]`

   After that, `src-tauri/Cargo.toml` can switch to `yamt-compare.workspace = true`.
2. `Cargo.lock` was updated by cargo (new package entry).
3. I added one refusal the brief doesn't list: a tab id at or above `nextId` is `Broken`. Without it, a hand-edited file could make "ids never repeat" false.
4. `format` below 1 (e.g. 0) is `Broken` ("format 0 is not 1"), not `NewerFormat`.
5. `open` reads `tabs.json` twice:
   - once before creating the folder and the lock file, so a broken or newer store creates nothing (Acceptance says "no new file");
   - once more under the lock, because the window that held the lock may have written the index until it ended.
6. `Locked.path` is the data folder, matching the design's message "another yamt --raw window is open (<folder>)".
7. Temp files have fixed names (`<file>.tmp`, no process id), since the lock makes this process the only writer.
   - At open, a leftover temp of a listed tab or of `tabs.json` is left alone (the next write replaces it); only temps of unlisted tabs are removed.
   - At close, a column file that fails to delete is ignored; it becomes an orphan and the next open removes it.
8. Additions beyond the Contract:
   - `pub type Result<T, E = Error>` (house rule: the error type is a defaulted parameter).
   - `#[derive(Clone, Debug)]` on `LoadedTab` and `#[derive(Debug)]` on `TabStore`.
   - Private helpers only; I avoided adding derives to the fixed types (for example, I compare `TabId`s by `.0` rather than adding `PartialOrd`).
9. `Arc<str>` is used in a library crate, which RS5 otherwise forbids. The brief's Contract and Behaviour 5 require it, and plan #97 amends RS5; `skill://rust-conventions` still needs updating (docs are read-only for me).
10. The 42 integration tests live in three files (`opening`, `tabs`, `columns`) instead of the design's single `store.rs`, to stay under the 400-line file limit. Each file starts with `#![cfg(test)]`, as the settings crate's tests do.

**open_risks**
- `crates/compare/src/index.rs:52` and `:54`: `+ 1` on `number` and `nextId` overflows (a panic in debug builds) if a hand-edited `tabs.json` has values near `u32::MAX`.
- `crates/compare/tests/columns.rs:334` (`a_failed_write_changes_nothing_in_memory`) relies on a read-only folder, so it fails if tests run as root.
- `crates/compare/src/files.rs:26`: on Linux the lock is per open file, so a second `open` in the same process gets `Locked` (the test relies on this). Windows' lock behaviour was not exercised here.
- `crates/compare/src/files.rs:57`: `load_tab` reads a whole column file before checking the 8 MiB limit, so a huge foreign file is read into memory once before `TooLarge` comes back.
- Not done here: `docs/architecture.md` §7 crate list, the project map and `skill://risk-register` (RK28/RK29 from the design) still need the new crate; they are read-only for this slice.
- Checks for Main to run: `just mutants` on this patch, and `just check` (including `map-check` once the docs name the crate).