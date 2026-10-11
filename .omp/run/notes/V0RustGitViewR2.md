# Implementer report V0RustGitViewR2

## deviations_from_brief
[
  "The temp config files for the core.abbrev runs went in /tmp (made with `git config --file`, deleted afterwards). The ownership hook blocked target/ because it is outside crates/**.",
  "Both test files have their own small `short_id_as_gitio_reads_config` helper, which runs plain `git` with LC_ALL=C and an inherited environment. There is no shared helper in conflict-repo, because that crate's `git` is deliberately isolated (GIT_CONFIG_GLOBAL=/dev/null)."
]

## open_risks
[
  {
    "location": "crates/gitio/tests/merge_heads.rs:25, crates/session/tests/remote_name.rs:33",
    "risk": "The expected id comes from `rev-parse --short` and the actual one from `git log %h`. Both use git's core.abbrev / auto-length rule. I checked they agree under default, 5 and 12, but they could in theory differ if a future git version changes one of them and not the other."
  },
  {
    "location": "crates/session/tests/finish_and_reset.rs:82",
    "risk": "[INFERENCE] I did not revert the fix to watch the new CRLF test fail. I am relying on the reasoning that the old rule would pick base `x` and give Eol::Lf."
  }
]

## smoke_evidence
[
  {
    "command": "cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace",
    "observed": "fmt silent; clippy: `Finished \\`dev\\` profile [unoptimized + debuginfo] target(s) in 35.14s`; tests: every `test result: ok.` line has 0 failed (e.g. `test result: ok. 11 passed; 0 failed` for finish_and_reset, `test result: ok. 8 passed; 0 failed` for remote_name)"
  },
  {
    "command": "just arch-check",
    "observed": "scripts/arch-check.sh\narch-check: ok"
  },
  {
    "command": "just fixtures-check",
    "observed": "diff -ru frontend/fixtures/golden target/fixtures-check/golden\ndiff -ru frontend/fixtures/showcase target/fixtures-check/showcase\n(no diff output); fixtures-check exit 0"
  },
  {
    "command": "GIT_CONFIG_GLOBAL=/tmp/yamt-r2-abbrev5.gitconfig (core.abbrev = 5) cargo test -p yamt-gitio -p yamt-session",
    "observed": "test commit_summary_gives_the_short_id_subject_and_raw_message ... ok\ntest base_with_a_line_break_decides_the_eol_over_the_kept_side ... ok\ntest base_without_a_line_break_takes_the_eol_from_the_crlf_sides ... ok\nall `test result: ok.` with 0 failed (e.g. `test result: ok. 8 passed; 0 failed ... finished in 0.07s`)"
  },
  {
    "command": "GIT_CONFIG_GLOBAL=/tmp/yamt-r2-abbrev12.gitconfig (core.abbrev = 12) cargo test -p yamt-gitio -p yamt-session",
    "observed": "test commit_summary_gives_the_short_id_subject_and_raw_message ... ok\ntest a_cherry_pick_names_the_picked_commit ... ok\ntest a_rebase_names_the_replayed_commit ... ok\ntest merging_a_commit_no_branch_points_at_names_the_commit ... ok\nall `test result: ok.` with 0 failed"
  },
  {
    "command": "GIT_CONFIG_GLOBAL=<abbrev5|abbrev12> git rev-parse --short HEAD",
    "observed": "a00be\na00be207b619 (the temp configs take effect: 5 and 12 characters)"
  }
]
