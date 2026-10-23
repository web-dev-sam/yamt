# RawCompareEngineR1 (3.C-engine rework 1, board Raw compare row 2)

All four blocks are fixed. `cargo fmt --check` and clippy are clean, and the 140 tests pass, the same count as round 1. The ownership hook blocked the column-swap mutation in `crates/cli/src/compare.rs`, so I ran a stand-in instead: the new test with its files swapped, which fails (details under deviations).

**summary**
- `Removal` / `SideWordChanges` docs in `word.rs` now read true for both users (word changes against base, and the 2-way compare). Only doc lines changed.
- The line-text generators shared by two merge-core test files now live once in `crates/merge-core/tests/texts/mod.rs`. `doc(max_lines)` and `edits(max_edits)` take each file's own limits.
- The cli compare tests moved to `crates/cli/tests/compare.rs`. The shared runner (`Output`, `yamt_cli`, `path`) is in `crates/cli/tests/yamt_cli/mod.rs`, and `commands.rs` is down to 335 lines.
- The cli compare case now has an inserted line and a removed line, so the left and right ranges differ. The test checks the exact (start, len) pairs.

**files_changed**
- `crates/merge-core/src/word.rs` (doc lines 15–16, 19, 21, 25, 28–29, 31–32)
- `crates/merge-core/tests/texts/mod.rs` (new)
- `crates/merge-core/tests/compare.rs`
- `crates/merge-core/tests/word_invariants.rs`
- `crates/cli/tests/yamt_cli/mod.rs` (new)
- `crates/cli/tests/compare.rs` (new)
- `crates/cli/tests/commands.rs`

**tests_added**
- No new test names. The two compare tests moved from `commands.rs` to `crates/cli/tests/compare.rs`:
  - `compare_prints_both_texts_and_their_differences_the_same_way_twice`: LEFT `a b c d e f g h i` against RIGHT `a B c X d e g H i`. It asserts the pairs `({1,1},{1,1}), ({3,0},{3,1}), ({5,1},{6,0}), ({7,1},{7,1})`, so swapped columns now fail it. Its comment now also names that bug.
  - `compare_fails_with_a_read_error_without_right_txt`: unchanged in what it asserts.
- Every merge-core proptest and unit test is kept and asserts the same things; only where the generators come from changed.

**smoke_evidence**
- `cargo fmt --check` → no output, then `fmt-ok`
- `cargo clippy --workspace --all-targets -- -D warnings` → `Finished \`dev\` profile [unoptimized + debuginfo] target(s)`, no warnings
- `cargo nextest run -p yamt-merge-core -p yamt-cli` → `Summary [1.512s] 140 tests run: 140 passed, 0 skipped`. Round 1 had 140 (`.omp/run/notes/RawCompareEngine.md:52`).
- `wc -l crates/cli/tests/commands.rs` → `335`
- Column-swap stand-in: in the test, `write_compare_case` wrote RIGHT as `left.txt` and LEFT as `right.txt`, which puts `compare(RIGHT, LEFT)` in the output just as the mutated binary would. The text assertions were swapped to match, and the expected pairs were left as they are.
  - `cargo nextest run -p yamt-cli --test compare compare_prints` → `panicked at crates/cli/tests/compare.rs:45:5: assertion \`left == right\` failed`
  - Actual: `…({start 3,len 1},{start 3,len 0}), ({start 6,len 0},{start 5,len 1})…`
  - Expected: `…({start 3,len 0},{start 3,len 1}), ({start 5,len 1},{start 6,len 0})…`
  - Reverted afterwards; the file's snapshot tag went back to its original `#A61E`.

**deviations_from_brief**
- I could not apply the hand mutation in `crates/cli/src/compare.rs`. The hook rejects edits to it (`[ownership/SP1] crates/cli/src/compare.rs is outside your slice`) and also blocked writing scratch files under `/tmp`. I ran the stand-in above instead. The orchestrator should still apply `compare(&right, &left)` at `crates/cli/src/compare.rs:13`, run `cargo nextest run -p yamt-cli --test compare`, and expect the same failure at `compare.rs:45`.
- The brief gave me the choice between per-file helpers and a shared module for the cli runner; I chose the shared module (`tests/yamt_cli/mod.rs`), since both files use `Output`, `yamt_cli` and `path`.
- In `texts/mod.rs`, `LINE` stays private because only the generators use it. Unused imports left behind in `word_invariants.rs` (`proptest::collection::vec`, `proptest::sample::Index`) were removed.

**open_risks**
- The bindings need regenerating, because `word.rs` doc lines become JSDoc in `ipc/bindings.ts` (that is the orchestrator's step). `just bindings-check` stays red until then.
- `crates/cli/tests/compare.rs:45`: the expected pairs depend on how imara-diff lines up the case. For this case only one alignment exists, and the test passes.