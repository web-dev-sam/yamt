# CiPortableTests — notes (session 36)

Owner #1759: ci red on macOS and Windows (run 41018261920 at `e965fca`); the same two tests had failed on every ci run
since 0.6.0-beta.1 (#1760). Read through the public API (`actions/runs`, `check-runs/<job>/annotations`; full logs need
a token). Brief `docs/slices/briefs/ci-portable-tests.md`; rust-impl, isolated, 3m43s; patch `ca1ddd4`,
`.omp/run/patches/CiPortableTests.patch`. Test files only.

- `crates/agent/tests/process.rs`: the expected home entries built segment by segment (`home.join("agents").join("bin")`),
  as `crates/pipe/src/program.rs` `relative_folder` does; Windows had `…\agents/bin` against `…\agents\bin`.
- `crates/gitio/tests/diff.rs`: tab and newline names off Windows (`core.protectNTFS` refuses them,
  `PATHS_MAY_HOLD_CONTROL_CHARACTERS = !cfg!(windows)`), the non-UTF-8 name on `all(unix, not(macos))` (APFS refuses
  it), a rename and an `added name.txt` add on every system; `const LINK` `cfg(unix)` like its only test.
- Linux: 185 tests pass; clippy, fmt clean. `cargo check --tests` for `x86_64-pc-windows-msvc` and
  `aarch64-apple-darwin`: no warnings in the two files. `cargo check --workspace` for Windows: ok; for macOS everything
  but `yamt-app` (its `objc2-exception-helper` build script needs Apple's compiler).
- Correctness review pass. Not provable here: the real Windows and macOS runs — ci on the next push.

## Fix round 1 (`CiPortableTestsR1`, 2m4s, patch `60d9519`, `.omp/run/patches/CiPortableTestsR1.patch`)

Owner #1761: ci still red at `d2a86e9` — the agent test passed on Windows; the odd-names test failed on macOS and
Windows at `commit`: "invalid object … for 'added name.txt'". `blob()` hashes without `-w`; on Linux the non-UTF-8
step's `git add` stored "new\n" by chance, round 1 compiled that step out elsewhere. Fix: `stored_blob` (`git
hash-object -w` on `.git/stored-blob`) for both staged ids. Linux with the gate off: the CI error before, pass after;
153 gitio tests; clippy, fmt, both cross `cargo check --tests` clean. Correctness re-check pass (traced every staged id
per platform; `GIT_CONFIG_NOSYSTEM=1` keeps Windows' system autocrlf out); one should dropped (#1762).
