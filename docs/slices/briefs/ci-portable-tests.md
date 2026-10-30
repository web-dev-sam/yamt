# Slice CiPortableTests — two Rust tests that fail on Windows and macOS CI

Board "Release 0.6.0-beta.2" row 4 (session 36). Owner #1759: "CI failed on macos and windows" (run 41018261920 at
`e965fca`, step "Rust tests without the runner's git config (RK19)", `just test`). The same two tests have failed on
every ci run since 0.6.0-beta.1; Linux passes. Only the tests are wrong; the product's behaviour is not in question.
No Windows or macOS machine here: prove by reasoning, the Linux run, and `cargo check` for both targets (installed:
`x86_64-pc-windows-msvc`, `aarch64-apple-darwin`).

1. **Windows** `crates/agent/tests/process.rs:189-216` `a_missing_program_lists_path_and_the_home_entries`: `left !=
   right` (CI annotation, cut after the PATH entries). Cause, by reading: the product turns each home entry into a
   path segment by segment (`crates/pipe/src/program.rs` `relative_folder`: `"agents/bin"` → `agents\bin` on
   Windows), the test joins the raw string (`home.join("agents/bin")` → `…\agents/bin`). PATH entries come from the
   same process on both sides. Fix the expected list so it is built the way the product builds it (segment by
   segment), without weakening what the test pins (every PATH entry in order, then the two home entries).
2. **Windows** `crates/gitio/tests/diff.rs:317-358` `paths_with_spaces_newlines_and_non_utf8_bytes_round_trip`:
   `git update-index --add --cacheinfo 100644,<oid>,renamed\tname.txt` fails: "error: Invalid path
   'renamed\tname.txt'" — git for Windows refuses control characters in paths (`core.protectNTFS`, on by default
   there), so such names cannot be staged on Windows; `new\nline.txt` is refused the same way.
   **macOS**: the same test panics at `diff.rs:364:42`, `fs::write` of `b"bytes \xff\xfe.txt"` — APFS refuses a file
   name that is not UTF-8.
   The parser under test reads git's `-z` output in platform-independent Rust, so Linux covers those names fully. Keep
   every case on the systems that can create it: the tab and newline names off Windows, the non-UTF-8 name on Unix
   systems other than macOS (`cfg(all(unix, not(target_os = "macos")))`), the space name everywhere; one short comment
   per gate naming the reason (CP1). The test must still pin a rename and an add on every system, and leave no unused
   `mut` or import on any target (the Windows build warned `unused_mut` at `diff.rs:338`).

## Target

Owned: `crates/agent/tests/process.rs`, `crates/gitio/tests/diff.rs`. Read-only: everything else (no product code
changes; if you find the product wrong, stop and report).

## Acceptance

- `cargo nextest run -p yamt-agent -p yamt-gitio` passes on Linux (paste the summary), and `just clippy` and
  `cargo fmt --all --check` are clean.
- `cargo check --tests -p yamt-agent -p yamt-gitio --target x86_64-pc-windows-msvc` and the same with
  `--target aarch64-apple-darwin`: no error and no warning in the two files (paste the tails). If a dependency's
  build script cannot cross-compile here, say which and how far it got.
- Also try `cargo check --workspace --target x86_64-pc-windows-msvc` and `--target aarch64-apple-darwin` (the CI app
  build step after the tests never ran on those systems since 0.6.0-beta.1); report the result, fix nothing outside
  your two files.

## Skills

`skill://rust-conventions`, `skill://verification` (plus your autoloaded ones).
