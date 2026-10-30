# Slice CiPortableTestsR1 — the odd-names test stages a blob it never wrote

Board "Release 0.6.0-beta.2" row 4, fix round 1. Round 1 `ca1ddd4` (brief `docs/slices/briefs/ci-portable-tests.md`,
notes `.omp/run/notes/CiPortableTests.md`) fixed the agent test (it now passes on Windows). Owner #1761: "CI still fails
on macos and windows" (run 41021286691 at `d2a86e9`).

**#1761 (block)** `crates/gitio/tests/diff.rs` `paths_with_spaces_newlines_and_non_utf8_bytes_round_trip` fails on
macOS and Windows at `commit(root, "odd names")` (`diff.rs:65:57`): `error: invalid object 100644
3e757656cf36eca53338e520d134963a44f793f8 for 'added name.txt'` / `Error building trees`. Cause, by reading: the test's
`blob()` (`diff.rs:25`) goes through `yamt_conflict_repo::hash_object`, which runs `git hash-object --stdin` without
`-w`, so it returns the id of `"new\n"` without storing the object. `stage_blob` then puts that id in the index. On
Linux the test passes only because `stage_non_utf8_name` writes a file holding `"new\n"` and `git add`s it, which
stores the same blob; on macOS and Windows that step is now compiled out, so the commit finds no object. (`oid` for
`"same\ntext\n"` exists because `diverged_repo` committed a file with that text.)

Fix in the test file only: every blob the test stages through `--cacheinfo` is stored first (e.g. a local helper that
writes the object — `git hash-object -w` on a scratch file, or `--stdin` through a helper that feeds stdin — used by
this test's `stage_blob` callers), so no case depends on another case's side effect. Do not change
`yamt_conflict_repo::hash_object` (other tests use it as a pure hash). Check whether any other test in `diff.rs` stages a
`blob()` id it never stored; fix those the same way and name them.

## Target

Owned: `crates/gitio/tests/diff.rs`. Read-only: everything else.

## Acceptance

- Failing before on Linux: with the non-UTF-8 step taken out for one run (e.g. the gate's cfg flipped temporarily, or
  the call commented out), the test fails with the same `invalid object … for 'added name.txt'` as CI; after the fix it
  passes that way too (paste both), then with the gate restored.
- `cargo nextest run -p yamt-gitio` passes; `just clippy`, `cargo fmt --all --check` clean;
  `cargo check --tests -p yamt-gitio --target x86_64-pc-windows-msvc` and `--target aarch64-apple-darwin`: no
  warning or error in `diff.rs`.

## Skills

`skill://rust-conventions`, `skill://verification` (plus your autoloaded ones).
