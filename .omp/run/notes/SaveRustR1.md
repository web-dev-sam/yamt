# SaveRustR1 (3.Z-rust fix round 1) — committed c92dea0

All seven review blocks (#877, #878, #879, #880, #883, #884, #885, #886) are fixed. Tests, clippy, fmt, `just arch-check` and `just bindings-check` all pass, and no mutant survives on my lines. One reviewer example was wrong: the #884 test as written in the brief does not catch its mutant, so I added a second case that does.

```
summary
  Reset now asks `at_open` one question, `AtOpen::reset_to() -> Option<ResetTo { bytes, seen }>`, which gives both the bytes to write and the view afterwards (#877, #886).
  `open` builds each `FileState` once, after the start check, with its final `AtOpen`; `seen` comes only from `AtOpen::first_seen()` (#878).
  `seed` decides "exact or not" in one match per chunk, and keeps each chunk's range and waiting together in `placed: Vec<(LineRange<MiddleLine>, Waiting)>` (#879).
  gitio now exports the marker labels `OURS_LABEL`/`THEIRS_LABEL`, uses them in its own `-L` arguments, and `MarkerStyle::fallback` uses them too (#880).
  New tests (#883, #884, #885) cover `checkout -m` on a link, a file that is one raw region, and the view after Reset.

files_changed
  crates/gitio/src/merge_file.rs
  crates/gitio/src/lib.rs
  crates/session/src/disk.rs
  crates/session/src/open.rs
  crates/session/src/seed.rs
  crates/session/src/waiting.rs
  crates/session/src/writes.rs
  crates/session/src/locate.rs        (test only)
  crates/session/tests/take.rs
  crates/session/tests/save.rs

tests_added
  take::reset_after_take_brings_back_the_stages_of_every_kind (extended, unix): after Reset, the symlink no longer points at `remote-target`, so git really rebuilt the link. Its doc line names it as RK17's proving test for the `checkout -m` half (#883).
  locate::tests::a_file_that_is_one_raw_region_links_it_to_every_side_line_with_or_without_a_last_line_break: base "", disk `<<<<<<< ours\nL\nR\n>>>>>>> theirs\n`, gives one `Waiting::AsShown` chunk with local and remote both (0, 1). It runs for sides "L\n"/"R\n" and "L"/"R" (#884).
  save::reset_after_a_save_brings_back_the_bytes_and_the_stages_of_this_run_s_start (S4, extended): after Reset, `load(..).middle` is `Middle::Stages { .. }` (#885).
  save::reset_of_a_file_changed_by_hand_before_start_brings_back_the_hand_edit (S6, extended): after Reset, `load(..).middle == Middle::Disk { text: FOREIGN }` (#885).

smoke_evidence
  #885, with `Changed` mapped to `ViewFromStages` in `reset_to` (then restored):
    cargo nextest run -p yamt-session --test save reset_of_a_file_changed_by_hand
      FAIL ... reset_of_a_file_changed_by_hand_before_start_brings_back_the_hand_edit
      assertion `left == right` failed
        left: Stages { text: "one\ntwo\nthree\n" }
       right: Disk { text: "written by another tool\n" }
  S4, with `Untouched` mapped to `ViewFromDisk` (then restored):
      FAIL ... reset_after_a_save_brings_back_the_bytes_and_the_stages_of_this_run_s_start
      panicked at crates/session/tests/save.rs:177:5: Disk { text: "one\ntwo\nthree\n" }
  #883, with `rebuild_markers` replaced by `Ok(())` (then restored):
      FAIL ... take reset_after_take_brings_back_the_stages_of_every_kind
      assertion `left != right` failed  left: "remote-target"  right: "remote-target"
  #884, with `&&` → `||` in `end_last_line` (then restored):
      FAIL ... locate::tests::a_file_that_is_one_raw_region_links_it_to_every_side_line_with_or_without_a_last_line_break
      left: [(0, 0), (0, 0)]  right: [(0, 1), (0, 1)]
  Named mutants:
    TMPDIR=/var/tmp/yamt-mutants cargo mutants -p yamt-session --test-workspace=false -f crates/session/src/writes.rs -f crates/session/src/locate.rs -F 'rebuild_markers|end_last_line' --output target/mutants
      5 mutants tested in 21s: 5 caught
      caught.txt includes: locate.rs:125:25: replace && with || in end_last_line
                           writes.rs:250:5: replace rebuild_markers -> Result<()> with Ok(())
  Acceptance 2:
    cargo nextest run -p yamt-session -p yamt-gitio -p yamt-cli -p yamt-app
      Summary [   3.845s] 267 tests run: 267 passed, 0 skipped
    cargo clippy --workspace --all-targets -- -D warnings
      Finished `dev` profile [unoptimized + debuginfo] target(s) in 30.01s
    cargo fmt --all --check → FMT-OK
    just arch-check → arch-check: ok
    just bindings-check → empty diff, BINDINGS-OK
  Acceptance 3:
    just mutants HEAD (diff = this round's changes only)
      21 mutants tested in 35s: 13 caught, 8 unviable

deviations_from_brief
  - #884: the brief's case (local "L\n", remote "R\n") does not catch the `&&`→`||` mutant. With the mutant every text gets one extra "\n", so ours "\n" against local "L\n\n" is still an insertion and still covers (0, 1). The mutant only changes the outcome when a side has no last line break: ours "" against local "L" becomes a replaced line, and the range collapses to (0, 0). The test keeps the brief's case and adds the "L"/"R" case, which catches the mutant.
  - #877: the brief suggested `{ entry: OnDisk, seen }`; I used `ResetTo { bytes: Option<Vec<u8>>, seen }` instead (`None` = no file). This shape cannot hold a link, submodule or other entry, and it matches what `put_entry` already takes, so `reset` needs no second match on the entry kind.
  - #879: the single branch is `match block { Some(block) if located.exact => base lines + block_markers, Some(_) | None => disk lines + AsShown }`. `Maps::raw` always sets `exact: false`; the match is written so a raw region needs no exactness answer.
  - #880: besides the two exported labels, gitio has a private `BASE_LABEL`, so all three `-L` arguments are constants and gitio's own `merge_file` can't drift from them. `merge_file`'s doc now names the constants.
  - #883: renaming RK17's proving test in `.omp/skills/risk-register/SKILL.md` is outside Owned. Needed change: the RK17 row should name `crates/session/tests/take.rs::reset_after_take_brings_back_the_stages_of_every_kind` as the proving test for the `checkout -m` half (links, submodules, unread files) and the S4 save test for the at-open-bytes half. For now the name is on the test as a `///` line only.
  - Acceptance 3: I ran `just mutants HEAD` rather than `just mutants cf9bbe1`. The diff since cf9bbe1 now also contains later lsp-host commits; HEAD is exactly this round's diff. The two mutants the reviews named are on lines this round did not change, so I ran them separately (above).

open_risks
  - crates/session/src/seed.rs:107: `Some(_) | None` relies on `Maps::raw` always setting `exact: false`; the types still allow an exact raw region. The fallback branch for it is safe (it is shown as it is), but nothing forbids it.
  - crates/session/src/open.rs:44: `Opened` keeps `disk: Option<OnDisk>` beside a separate `StartLook::Changed` for an unread file. The rule "unread is never untouched" depends on `open_file` pairing `None` with `StartLook::Changed`, and `file_state` maps `None` to `Unread` whatever `untouched` says.
```