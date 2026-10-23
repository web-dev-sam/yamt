Owner skill: `skill://rust-conventions`. Pure diff3 chunk model: no I/O, no git, no serde_json, no tauri (clippy `disallowed_*`, `just arch-check`). Public API documented with `///` one-liners (`missing_docs`); tests: unit in-file, invariants via proptest, goldens via insta in `crates/cli`.

`compare(left, right)` is the 2-way diff behind `yamt --raw` (plan §2 #95): `compute_chunks(left, left, right)` with `COMPARE_GAP` 0 for the lines, `side_word_changes` in both directions for the word marks, line spaces `LeftLine`/`RightLine`; no second diff rule.
