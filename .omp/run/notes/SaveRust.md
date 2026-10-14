# SaveRust (3.Z-rust, board row 3) — committed cf9bbe1


## summary
- `crates/session/src/waiting.rs` (new) holds `Waiting` (`SideLines | Markers { open, between, close } | AsShown`) and `MarkerStyle` (`found_in`, `fallback`). Every `MergeChunk` now carries a `waiting` field:
  - stages view: one-sided and same-on-both chunks get `SideLines`; a conflict gets `Markers` in the file's style (diff3 base section only when the file had one);
  - disk view: an exactly located block gets `Markers` copied from its own lines; an inexact block or raw region gets `AsShown`.
- New `MergeSession::save` (Tauri command `save_file`) is `finish` without `git add`:
  - it skips the write when the bytes are already on disk, and puts the old bytes back if the write fails;
  - it updates `seen` through `Seen::after_own_write`, keeps `settled` and `DiskVersion`, and its write never comes back as a `DiskChange`.
- `FileState.at_open: AtOpen = Untouched(OnDisk) | Changed(OnDisk) | Unread` is set once in `open.rs` and never written again.
- `reset` now follows #66, in this order:
  1. Look at the disk first. If the at-open entry is a regular file or no file, a folder or submodule now at the path is `NotAFile`, before the index is touched.
  2. Record the index as it was, then `restore_stages`.
  3. Put the file back:

| at open | reset does | view afterwards |
|---|---|---|
| a regular file | writes its bytes (removes a link at the path first) | `Untouched` → stages view; `Changed` → disk view |
| no file | removes the file | same as above |
| a link, submodule, other entry, or unreadable | `checkout -m` when `can_rebuild_markers`, then reads the file back | as before this slice |

  4. If step 3 fails, the index is restored and the old bytes are put back.
  5. Status becomes `Unresolved`.
- **Docs the later architecture update needs:**
  - the new module `waiting.rs`, and `MergeChunk.waiting`;
  - `FileState.at_open`, which sits next to `stages` in the project-map state table;
  - the `save_file` command and `MergeSession::save`;
  - the reset table above;
  - `DEFAULT_MARKER_SIZE` is now exported from `yamt-session`;
  - risk register: RK17's fix is now "reset writes the at-open bytes; `checkout -m` only for non-regular or unread entries", and reset's rollback should be added to RK23;
  - the change to `locate.rs` (see deviations);
  - `crates/session/AGENTS.md` is already updated.

## files_changed
- crates/session/src/waiting.rs (new)
- crates/session/src/lib.rs, disk.rs, open.rs, session.rs, writes.rs, merge_data.rs, seed.rs, markers.rs, locate.rs
- crates/session/tests/save.rs (new), crates/session/tests/save_round_trip.rs (new), crates/session/tests/deleted_side.rs
- crates/session/AGENTS.md
- crates/cli/src/fixture.rs
- src-tauri/src/commands.rs

## tests_added
- S8, unit tests in `waiting.rs`:
  - `the_style_is_copied_from_the_first_block_in_every_style_size_and_line_ending`: merge, diff3, zdiff3, `marker-size-12.txt` and `crlf.txt`.
  - `a_file_without_a_block_or_not_utf8_gets_the_fallback_of_its_marker_size`
  - `a_conflict_holds_its_base_lines_only_in_a_style_with_a_base_section`
  - `a_one_sided_or_same_change_is_written_as_its_side_lines`
  - `an_exact_block_s_markers_and_its_section_lines_rebuild_the_block_exactly`: rebuilds `Block.whole` byte for byte.
  - `an_edited_block_and_a_raw_region_are_written_as_shown`
- `locate::tests::a_section_holding_a_side_s_last_line_without_a_line_break_is_located_exactly`: pins the `locate.rs` fix.
- S1, `save_round_trip::every_golden_saved_with_everything_waiting_opens_again_untouched_or_with_the_same_conflicts`:
  - runs every golden in merge and diff3 style;
  - the test splice mirrors the window's builder;
  - a new session's `open` + `refresh` + `load` either gives the same chunks (untouched) or the same conflict local/remote ranges, all as `Markers`.
- S2:
  - `a_conflict_with_its_local_section_applied_but_not_edited_comes_back_exactly_placed`: comes back as `Markers` at (2,4)/(2,4), with middle = `WORKED_MIDDLE`.
  - `a_conflict_with_an_ignored_or_edited_section_comes_back_raw_with_both_sections`: one `AsShown` chunk showing the whole raw block.
- S3:
  - `a_save_writes_without_staging_and_never_comes_back_as_a_disk_change`
  - `a_foreign_write_before_a_save_stops_it_and_a_stale_version_writes_nothing`
  - `a_save_of_the_bytes_already_on_disk_leaves_the_file_untouched`: the modification time is unchanged.
  - `save_and_reset_refuse_a_directory_without_touching_the_index`
  - `a_save_refuses_a_link_and_reset_replaces_it_with_the_file_at_open` (unix)
- S4 `reset_after_a_save_brings_back_the_bytes_and_the_stages_of_this_run_s_start`
- S5 `reset_in_a_later_run_brings_back_what_that_run_found_saved`
- S6 `reset_of_a_file_changed_by_hand_before_start_brings_back_the_hand_edit`
- S7:
  - `reset_with_a_held_index_lock_leaves_the_file_and_the_index_as_they_were`
  - `reset_whose_file_write_fails_puts_the_index_back` (unix)
- `commands::tests::save_file_writes_the_text_and_leaves_the_file_listed_conflicted`: mock runtime; CRLF bytes written, `ls-files -u` unchanged, `list_files` shows no disk change.
- `deleted_side::keep_or_delete_then_reset_brings_the_stages_and_the_file_at_open_back`: replaces the old test, whose meaning #66 changes (see deviations).

## smoke_evidence
- `cargo nextest run -p yamt-session -p yamt-cli -p yamt-app --no-fail-fast` → `Summary [   3.621s] 209 tests run: 209 passed, 0 skipped`, including every S1–S8 test and the command test listed above.
- `cargo fmt --check` → no output (`FMT_OK`). `cargo clippy --workspace --all-targets -- -D warnings` → no diagnostics.
- `just arch-check` → `arch-check: ok`.
- `just bindings-check` writes the export to `target/`, so `frontend/src/ipc/bindings.ts` is not in the patch. Its diff:
  ```
  +	saveFile: (path: string, text: string, diskVersion: DiskVersion) => typedError<WriteReply, IpcError>(__TAURI_INVOKE("save_file", { path, text, diskVersion })),
  +	waiting: Waiting,
  +export type Waiting = 
  +{ kind: "SideLines" } | 
  +{ kind: "Markers"; open: string; between: string[]; close: string } | 
  +{ kind: "AsShown" };
  ```
  You need to run `just bindings` and `just fixtures`; the golden and showcase JSON gain `waiting`.

## deviations_from_brief
- **The design's guess about exact placement was wrong in one case.** S1 failed on `nuxt-island-test.ts` (merge style): the last block holds remote's last line, which has no final line break. git ends that line before the `>>>>>>>` marker (checked with `git merge-file`, git 2.56). The locator compared that line without its line break against remote's last line, so the block came back inexact (`AsShown`). Its ranges matched only because the covering range happened to equal the right one. The same happens to git's own output in the disk view, so it is not specific to Save.
  - **Fix, in `locate.rs` (owned, but not named in Change):** the ours/theirs views and the side texts now always end their last line before they are compared. Line numbers are unchanged.
  - I did not weaken S1. It passes after the fix, and a unit test pins it.
- **`merge_data` gained a `style: &MarkerStyle` parameter** (before `disk_version`). The CLI passes `MarkerStyle::fallback(DEFAULT_MARKER_SIZE)`. To keep one source for that number, `DEFAULT_MARKER_SIZE` is now `pub` and exported from `yamt-session`.
- **Where the marker style comes from:** it is derived at `load` from the `at_open` bytes, for both `Untouched` and `Changed`; it is not stored. `Unread` and non-file entries get `fallback`.
- **`finish` now shares `write_text` with `save`:**
  - it skips the write when the bytes are identical;
  - a failed `fs::write` now puts the old bytes back (before, it only returned the error).
  - The rollback after a failed `git add` is unchanged.
- **The deleted-side reset test now asserts #66 behaviour.** The old test said reset "leaves the worktree" after a take; reset now restores the at-open bytes (the kept side), and a later refresh reports no change. The same applies to every deleted-side and binary file: today's `checkout -m`/leave-as-is is replaced by writing the at-open bytes.
- **Reset with a regular-file or missing at-open entry** treats a folder or submodule at the path as `NotAFile` before touching the index. Brief and design name only the folder.

## open_risks
- `crates/session/src/writes.rs` `put_entry`: if reset removes a link at the path and the following write fails, the link is not recreated. This is logged as `reset_link_not_put_back` and needs a disk-full-class failure right after a successful unlink.
- `crates/session/src/waiting.rs` `found_in`: a file at open that is not valid UTF-8 falls back to `ours`/`theirs` even if git's marker lines were ASCII. Such files have no text view, so the window never uses the result.
- S1 covers only LF goldens. CRLF marker lines are covered by the `MarkerStyle` unit tests and the CRLF `save_file` command test, not by a CRLF round trip.
- `reset_whose_file_write_fails_puts_the_index_back` relies on a read-only file refusing writes; it would not hold when tests run as root, the same assumption as `all_or_nothing.rs`.
- Before merging, run `just bindings`, `just fixtures`, `just fixtures-check`, `just map-check` (the new `waiting.rs` must be named in the map), `just test`, and `just mutants`. I did not run mutants.