# RemovalTextR1 (row 1 fix round 1, brief `docs/slices/briefs/3.R-removal-text-rework-1.md`)

summary: four example tests pin two-line removals (before the bar's line, between pairs, at the chunk end, joined with a
pair's leading/trailing tokens); proptest `a_deleted_run_is_removed_whole_and_in_order` (512 cases, runs of 1-4 lines,
neighbours Before/After/Both) expects exactly one removal with every deleted line in order; `Removal::at` doc fixed.
files_changed: `crates/merge-core/src/word.rs` (doc), `tests/word_changes.rs`, `tests/word_stress.rs`,
`tests/word_stress.proptest-regressions` (shrunk seed from the rule-breaking run, kept); bindings.ts regenerated.
smoke_evidence: keep-only-first / keep-only-last in the gap code fails all 4 examples and the proptest; cargo test,
clippy, fmt, golden green. Commit `fd9e45f`. Re-checks: correctness pass, boundary pass. Mutants `0cd6fab`: no Rust
mutants (doc + tests only), no TS changes.
