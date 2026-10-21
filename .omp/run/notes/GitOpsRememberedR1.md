# GitOpsRememberedR1 — notes (rust-impl, 3.J row 7 fix round 1)

Output fields verbatim.

All five blocks and the promoted shoulds are fixed. Each new test for blocks 1–5 failed on round 1's code and passes now. For #1403 that's shown by putting each surviving mutant back. No IPC change: the exported bindings are byte-equal.

**summary**
- **Detection (#1402, #1404):** `Repo::rerere_tracked` reads `MERGE_RR` only while rerere is on, using git's own rule from `rerere.c`: `rerere.enabled` true, or unset while the `rr-cache` folder exists. So an empty `MERGE_RR` left behind with rerere off no longer turns a hand fix into Remembered. If `MERGE_RR` can't be read, every file that looks resolved counts as Remembered and the `rerere_unread` warning stays.
- **Placement (#1400, #1401):** lines are matched with `\r` removed on both sides, so a CRLF file over LF blobs places correctly. Blocks whose Result lines overlap join into one conflict covering both blocks.
- **One walk (#1392):** `locate::place_pieces` is now the only walk over the pieces; it also keeps base lines from overlapping the previous chunk. `seed` and the remembered view both use it.
- **Types and layout (#1393/#1405, #1394, #1399):** `Seen::ViewRemembered { shown, git_output }` now carries git's output. `AtOpen::git_output`, the `unwrap_or_default` and the unreachable `marker_style` arm are gone. Detection (`RerereTracked` with `NotRead`, `looks_resolved`) lives in `start.rs`, and `remembered.rs` is only the view.
- **Fixture path (#1395, #1396/#1406, #1397):** `remembered_data` takes the same `&MarkerStyle` and `DiskVersion` as `merge_data`, and the cli passes the same values to both. It returns `None` when a block isn't found unchanged in the sides, so a stale `git-output.<ext>` makes `just fixtures` fail. The README command now has `--diff3`, and `crates/cli/AGENTS.md` names the two case files.

**files_changed**
- gitio: `crates/gitio/src/rerere.rs`, `crates/gitio/tests/rerere.rs`, `crates/gitio/AGENTS.md`
- conflict-repo: `crates/conflict-repo/src/rerere.rs`, `crates/conflict-repo/AGENTS.md`
- session: `crates/session/src/{start.rs, scratch.rs (new), locate.rs, seed.rs, remembered.rs, disk.rs, session.rs, writes.rs, waiting.rs, lib.rs}`, `crates/session/tests/remembered.rs`, `crates/session/AGENTS.md`
- cli: `crates/cli/src/fixture.rs`, `crates/cli/tests/commands.rs`, `crates/cli/AGENTS.md`
- showcase: `tests/showcase/remembered/README.md`

**tests_added** (each failure below was seen on round 1's code)
- **Block 1**, three tests:
  - gitio `rerere_tracked_is_none_when_rerere_was_switched_off_after_a_committed_rerere_merge`: round 1 gave `Some([])` where `None` was expected.
  - gitio `rerere_enabled_unset_without_user_config`, which runs the ignored test `with_rerere_enabled_unset_rerere_tracked_reads_merge_rr_only_while_rr_cache_exists` in a child without user or system config: round 1 gave `Some([])` after `rr-cache` was removed.
  - session `with_rerere_switched_off_after_a_committed_rerere_merge_a_hand_fix_before_open_is_staged_at_the_first_list`: round 1 gave `disk_changes` `[]` where `[Staged card.ts]` was expected.
- **Block 2**, `with_a_merge_rr_record_without_a_tab_a_replayed_resolution_stays_remembered`: round 1 staged `src/board.ts` unseen.
- **Block 3**, four tests that catch the two surviving mutants:
  - `a_replayed_path_checked_out_again_with_markers_and_edited_opens_unresolved_in_the_disk_view`
  - `start::tests::a_file_with_markers_left_does_not_look_resolved`
  - `start::tests::without_a_block_in_git_output_nothing_looks_resolved`
  - `start::tests::a_file_without_markers_over_git_output_with_a_block_looks_resolved`
  - Putting back `&& → ||`, and then `-> true`, made 2 unit tests and the integration test fail each time. Reverted afterwards.
- **Block 4**, `remembered::tests::a_crlf_resolution_over_lf_stages_places_the_conflict_on_the_resolution_s_line`: round 1 gave `[(0, 3)]` where `[(1, 1)]` was expected.
- **Block 5**, `remembered::tests::blocks_whose_lines_in_the_resolution_overlap_join_into_one_conflict`: round 1 gave `[(1, 3), (4, 0)]` where `[(1, 3)]` was expected.
- **#1396**:
  - `remembered::tests::remembered_data_refuses_git_output_not_made_from_these_sides`
  - cli `fixture_refuses_a_git_output_not_made_from_the_case_s_sides`: exit 1, stderr `yamt-cli: cart is not a golden case: git-output.ts was not made from these sides`.

**smoke_evidence**
- `cargo test -p yamt-gitio -p yamt-session -p yamt-cli -p yamt-conflict-repo` → `passed 328 failed 0`.
- `cargo clippy --workspace --all-targets -- -D warnings` → `Finished`, no warnings. `cargo fmt --all --check` → ok.
- `just fixtures-check` → both `diff -ru` lines printed no differences.
- `just bindings-check` → `diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts` printed no differences.
- The showcase `git-output.ts` is byte-equal (`cmp`) to `git merge-file -p --diff3 -L HEAD -L base -L feature` over the three sides.
- `scripts/operations-repo.sh rerere /tmp/yamt-rerere-smoke`:
  - `yamt-cli scan` → `src/board.ts Remembered total 1: LocalOnly 0, RemoteOnly 0, BothSame 0, Conflict 1` / `remaining: 1`
  - `git ls-files -u` → stages 1, 2 and 3 of `src/board.ts`
  - file on disk: `export const columns = ["backlog", "todo", "doing", "done"];`
- Stale-`MERGE_RR` scenario, in a throwaway script (since deleted): rerere on, merge, commit, rerere off, second merge, hand fix.
  - `MERGE_RR` is 0 bytes and `rerere.enabled` reads `false`.
  - `yamt-cli scan` → `f Unresolved … Conflict 1`, so the hand fix gets staged at the first list instead of being held as Remembered.
  - The session test above shows the staging itself: `disk_changes == [Staged]`.

**deviations_from_brief**
- **No `Rc`, per your answer (RS5 stands).** `AtOpen::Remembered` and `Seen::ViewRemembered` each own a `Vec<u8>`.
  - Each remembered file's bytes are copied once at open (`first_seen`) and again at each Reset (`reset_to`).
  - `Seen::after_own_write(&self)` became `note_own_write(&mut self)`, which updates the bytes in place without copying.
- **`remembered_data` takes `(path, base, local, remote, &Replayed, &MarkerStyle, DiskVersion)` and returns `Option<FileMergeData>`.**
  - `Replayed { git_output, resolution }` is a new public session type replacing the cli's private struct; it keeps the function at clippy's 7-argument limit.
  - `MarkerStyle` gained a crate-internal `marker_size` field, and `orientation` is now crate-visible.
  - The `deleted` argument is left out because a replayed file has both sides.
  - A refusal reuses the cli's `MalformedCase` error, so the message says "is not a golden case" even for a showcase case.
- **`Replay::Off` added to `rerere_repo`.** It keeps the first merge commit, switches rerere off and merges a new branch `later`. No checkout happens after that commit, because a checkout deletes `MERGE_RR`; I saw `reset --hard` delete it.
- **The unset-`rerere.enabled` gitio test runs in a child process** without user or system config. Your `~/.gitconfig` sets `rerere.enabled=true`, which yamt's git reads.
- **`ScratchDir` moved from `start.rs` to a new `scratch.rs`**, so `start.rs` stays at 395 lines (RS6) after taking the detection code. `scratch.rs` is a new file the project map in `docs/architecture.md` doesn't name yet; that docs pass is yours.
- **The block 3 test lists the files before `load`.** At open the file is still git's output (the stages view); the disk view comes after the first list settles it.

**open_risks**
- `crates/session/src/start.rs` (`has_replayed`): if reading `rerere.enabled` or `rev-parse` fails, the session can't tell whether rerere is on, so every file that looks resolved counts as Remembered. That's the safe direction, but a hand fix in a repo without rerere would then wait for Mark resolved.
- `crates/session/src/remembered.rs` (the join in `remembered_chunks`): two coverings that are both empty at the same point don't join, so two empty chunks can share one point (a resolution that deletes everything around both blocks). Not tested.
- A stash pop or similar while rerere is on and a stale `MERGE_RR` exists still reads as "replayed". That scenario is the `[INFERENCE]` in #1402 and is not handled.

Please run `just check`, `just mutants` on the changed lines, and the src-tauri tests on the merged tree.

## Mutants (`just mutants 5976577`)

90 — 54 caught, 24 unviable, 12 missed: conflict-repo rerere.rs (7, fixture); gitio rerere.rs:51 `is_found_or_unset -> true`; session remembered.rs:138 overlap guard `-> true` and `< -> <=`; session scratch.rs:22 AlreadyExists guard `-> true`, scratch.rs:40 `create_private_dir -> Ok(())` (moved code from start.rs).

## Boundary re-check: fail — #1392–#1399 fixed; new block #1417 (a third line-ending rule). Correctness re-check: pass (#1418/#1419 dropped).
