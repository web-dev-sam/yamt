# Slice MrDetectListR1 — fix round 1 of the merge-request detection and list (gitio part)

Board "Merge requests" row 2. Round 1: `MrDetectList` (commit `7478f81`, brief `docs/slices/briefs/mr-detect-list.md`,
notes `.omp/run/notes/MrDetectList.md`). Fix the blocks `#1932`/`#1936` and `#1933`/`#1937`
(`just findings 1932 1933 1936 1937`), nothing else. (`#1934` in `crates/merge-requests/` went to `MrOpenCommands`,
which owns that crate now.)

1. **#1932/#1936** One reader of `git config -z --get-regexp` in gitio: the exit-1-means-none rule
   (`NO_MATCH_STATUS`, `is_found_or_no_match`) and the `<key> NL <value> NUL` split live once (e.g. a `pub(crate)`
   `Repo::config_entries(regexp)`), used by `merge_config.rs` and `Repo::remote_urls`; the copy in `names.rs` deleted.
   Behaviour of both callers unchanged.
2. **#1933/#1937** `crates/gitio/tests/glab.rs` back under 400 lines: the names tests (branch names, `remote_names`,
   `remote_urls`) move to a new `crates/gitio/tests/names.rs`, without `cfg(unix)` where they need no Unix tool.

## Target

Owned: `crates/gitio/src/{names.rs,merge_config.rs}`, `crates/gitio/tests/{glab.rs,names.rs}`, and the existing test
file of `merge_config` if it has its own. Read-only: everything else (`crates/gitio/src/lib.rs` belongs to the build
running beside you; you should not need it).

## Acceptance

- Existing merge-config and remote tests green and unchanged in what they assert; `cargo test -p yamt-gitio
  -p yamt-review -p yamt-merge-requests`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`.
- `wc -l crates/gitio/tests/glab.rs` < 400; `grep -n NO_MATCH_STATUS crates/gitio/src` shows one definition.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://verification`.
