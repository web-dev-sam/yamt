# RawCompareEngine (3.C-engine, board Raw compare row 2)

Slice 3.C-engine is built: `merge_core::compare` exists, `yamt-cli compare <case-dir>` prints it, and the three compare cases and their window fixtures are in place. fmt, clippy, the tests and arch-check all pass. Two things are left for you to do: delete two untracked folders I couldn't remove, and apply the `justfile` lines below.

```
summary
  merge_core::compare(left, right) -> Vec<Difference>: one compute_chunks(left, left, right, gap COMPARE_GAP = 0)
  call, plus the existing side_word_changes run once in each direction for the word marks. New line spaces
  LeftLine/RightLine, each with its end(). `yamt-cli compare <case-dir>` reads left.txt/right.txt and prints
  pretty JSON { left, right, differences } + "\n". Three hand-written cases are in tests/compare/ and the
  fixtures generated from them are in frontend/fixtures/compare/.

files_changed
  crates/merge-core/src/line.rs        (LeftLine, RightLine, LineRange<LeftLine|RightLine>::end)
  crates/merge-core/src/compare.rs     (new: COMPARE_GAP, Difference, DifferenceWords, compare)
  crates/merge-core/src/word.rs        (side_word_changes -> pub(crate); nothing else)
  crates/merge-core/src/lib.rs         (mod compare; re-exports; //! line now names both models)
  crates/merge-core/tests/compare.rs   (new)
  crates/merge-core/AGENTS.md          (one paragraph naming compare)
  crates/cli/src/compare.rs            (new)
  crates/cli/src/args.rs               (Command::Compare { case_dir }, "compare" => required_path)
  crates/cli/src/lib.rs                (mod compare, USAGE line, dispatch, //! line)
  crates/cli/tests/commands.rs         (2 tests)
  crates/cli/AGENTS.md                 (command named)
  tests/compare/{json-payload,words,typescript}/{left,right}.txt   (new)
  frontend/fixtures/compare/{json-payload,words,typescript}.json   (new, written by the command)

tests_added  (each test carries a "// Catches …" comment naming the bug)
  merge-core tests/compare.rs (proptest, 512 cases, line texts built as in word_invariants.rs):
  - replacing_each_difference_with_its_right_lines_rebuilds_the_right_text: rebuilding the right from the
    left plus the differences gives the right byte for byte (catches wrong or missing ranges).
  - differences_are_sorted_disjoint_and_never_empty_on_both_sides: strictly increasing on both sides, never
    both empty, within the texts' line counts; uses end() (kills the end() mutants).
  - comparing_a_text_with_itself_finds_nothing.
  - line_ranges_are_the_two_way_chunks_of_compute_chunks: ranges equal compute_chunks(l, l, r, gap 0)'s
    base/remote ranges (catches a gap change or swapped texts).
  - every_word_mark_lies_inside_a_line_of_its_own_column: every range or removal sits on its own side's
    difference lines and inside the line's content (never across the line break); removal texts non-empty.
  - a_one_word_change_marks_exactly_that_word_in_both_columns: exactly that word's InlineRange in both
    columns, no removals (catches marks made in one direction only, or columns swapped).
  - a_word_only_in_the_left_is_a_left_mark_and_a_right_removal (unit): "one two three" vs "one three" gives
    left changed (0,4,4) and a right removal "two " at (RightLine(0), 4) (catches the removal direction).
  cli tests/commands.rs:
  - compare_prints_both_texts_and_their_differences_the_same_way_twice: three keys, ranges 1/4/7 on both
    sides, ends with "}\n", byte-equal on a second run.
  - compare_fails_with_a_read_error_without_right_txt: exit 1, empty stdout,
    "yamt-cli: cannot read <path>: <os error>" (the existing Error::Read).

smoke_evidence
  cargo fmt --check → FMT_OK
  cargo clippy --workspace --all-targets -- -D warnings → "Finished `dev` profile …" (no warnings)
  cargo nextest run -p yamt-merge-core -p yamt-cli → "Summary [1.604s] 140 tests run: 140 passed, 0 skipped"
  just arch-check → "arch-check: ok"
  Mutants (my own runs, a check ahead of `just mutants`):
    cargo mutants -p yamt-merge-core -f compare.rs -f line.rs -- --test compare
      → "30 mutants tested in 43s: 3 missed, 21 caught, 6 unviable"
      The 3 missed are on lines I did not change (is_empty → false; + → - and + → * in
      LineRange<LocalLine>::end). Only the new test target ran, so other merge-core tests may still catch them.
    cargo mutants -p yamt-cli -f crates/cli/src/compare.rs -- --test commands
      → "3 mutants tested in 6s: 1 caught, 2 unviable"
  Fixtures generated with the brief's loop (into frontend/fixtures/compare); rerunning the command and diffing
  gives "same" for all three cases. Differences per case:
    json-payload: status value changed (word marks both sides); "email" key left-only (left 5+1, right 5+0);
      title line with two changed words ("Notes on" → "Sketch of", one range each side); "tracking" key
      right-only (left 23+0, right 22+1)
    words: nine→ten (one mark each side); "printed " removed (left mark, right removal "printed "); line
      inserted (5+0 / 5+1); line deleted (6+1 / 7+0); one line replaced by two (8+1 / 8+2)
    typescript: two separated differences at lines 13 and 32
  Measured (release build, yamt-cli compare on generated pairs in /tmp, not committed):
    ~8 MiB, 200,000 lines, 50 scattered one-line edits → real 0m0.098s, 50 differences
    every line differs, 8.0/8.2 MB, 200,000 lines → real 0m1.029s (user 0.785s),
      1 difference 200000×200000, 200,000 whole-line marks per column (line pairing is over its cap,
      MAX_GAP_COMBINATIONS); the time includes printing the JSON

deviations_from_brief
  - Key order in the CLI JSON is alphabetical ("differences", "left", "right"; also "len" before "start",
    "column" before "line"). crates/cli has no `serde` dependency, so the object is built with
    serde_json::json!/to_value, and serde_json without `preserve_order` sorts keys. Key names are as the
    brief says, only the order differs. If you want struct field order, add to crates/cli/Cargo.toml
    [dependencies]: `serde.workspace = true`, swap the json! for a #[derive(Serialize)] struct in
    crates/cli/src/compare.rs, then regenerate the fixtures.
  - crates/merge-core/tests/compare.rs starts with #![cfg(test)], as crates/cli/tests/commands.rs does, so
    clippy's unwrap-in-tests allowance covers the helper functions.
  - lib.rs //! line changed to "Pure diff model: three-way chunks for a merge, two-way differences for a
    compare."; cli lib.rs //! and USAGE name compare.
  - Cleanup needed outside Owned: my cargo-mutants runs left untracked `mutants.out/` and `mutants.out.old/`
    at the repo root. The hooks refused rm and mv. Delete both before committing.
  - justfile lines for you to apply (not edited, Read-only):
      fixtures-into: add compare to the rm -rf / mkdir -p lists, e.g.
        rm -rf "{{ dir }}/golden" "{{ dir }}/showcase" "{{ dir }}/compare"
        mkdir -p "{{ dir }}/golden" "{{ dir }}/showcase" "{{ dir }}/compare"
      then the loop:
        for case in tests/compare/*/; do target/debug/yamt-cli compare "$case" > "{{ dir }}/compare/$(basename "$case").json"; done
      fixtures-check: add
        diff -ru frontend/fixtures/compare target/fixtures-check/compare

open_risks
  - A difference that only adds or only removes whole lines gets no word marks and no removal bar in either
    column, because side_word_changes returns nothing when one side is empty (word.rs, the early return).
    The band alone shows it. This is the existing merge behaviour, kept as is; row 5's rendering should
    expect it.
  - When every line differs, line pairing is over its cap, so each column is fully marked line by line and
    the JSON is large (~400k ranges); ~1 s total in release. The real-app measurement over IPC is row 4/5's.
  - The checks that differences never touch and never are both empty rely on compute_chunks with gap 0
    giving imara-diff's hunks unmerged (compare.rs:37). The proptest pins this, but only on short generated
    texts.
```