---
name: rust-conventions
description: House rules for Rust in yamt — beginner-readable Rust, error types, crate layout, lints, tests, subprocess rules — plus a curated subset of leonardomso/rust-skills in references/. Autoloaded into rust-impl.
---

# Rust conventions

The product owner is a Rust beginner and reads every crate (vision 1). Idiomatic ≠ clever.

## Readability (reviewer flags violations as `should`, repeated → `block`)

- [RS1] Owned types at crate boundaries: `String`, `Vec<T>`, `PathBuf` in public structs and
  return types. Borrow only in parameters (`&str`, `&[T]`, `&Path`). No lifetimes in public
  signatures. Violation: `pub fn files(&self) -> impl Iterator<Item = &FileState> + '_`.
- [RS2] A generic needs two concrete instantiations in the workspace; a trait needs two
  implementations. Otherwise write the concrete type. Exception: `LineRange<L>` (decision 18).
- [RS3] Derive macros only (`serde`, `thiserror`, `specta`, std derives). No `macro_rules!`,
  no proc-macro crates beyond those.
- [RS4] Iterator chains: at most three adapters; beyond that, a `for` loop with a named
  accumulator. Violation: `.iter().filter().map().enumerate().skip_while().collect()`.
- [RS5] No `Rc`, `RefCell`, `Arc`, `Cell` outside `src-tauri`'s one `Mutex<MergeSession>`.
  No `async`, no `tokio`: git subprocesses and diffs are synchronous and fast.
- [RS6] Functions ≤ 40 lines, files ≤ 400 lines; split by responsibility, not by count.
  Detector: clippy `too_many_lines` (threshold 40).
- [RS16] A name says what it returns: `is_/has_/can_` return `bool`; a fn returning data is named for the
  data (`computed_json`, `stdout_or_failure`, not `expected_json`, `succeeded`); a call kept only as a guard is `require_*`; no one-letter helpers (`g`).

## Errors

- [RS7] One `#[derive(Debug, thiserror::Error)] pub enum Error` per crate, variants named by
  cause (`GitFailed { args, stderr }`, `NotUtf8 { path }`), lowercase messages without trailing
  punctuation. `Result<T> = std::result::Result<T, Error>` alias per crate. No `anyhow` in
  library crates; `anyhow` allowed in `cli` and `src-tauri` main only.
- [RS8] `unwrap`/`expect`/`panic!`/`unreachable!` are denied outside `#[cfg(test)]`. Index
  with `.get()` and handle `None`. Detector: clippy deny set.
- [RS9] A domain `match` lists every variant — no `_ =>` arm on `ChunkKind`, `FileStatus`,
  `Eol`, `Error`. Detector: clippy `wildcard_enum_match_arm`.

## Layout

- [RS10] `lib.rs` is the public surface: `pub use` the handful of types, everything else
  `pub(crate)`. One module per file; `mod.rs` only for a directory module. Binaries in
  `src/main.rs` ≤ 30 lines delegating to the lib.
- [RS11] Unit tests in `#[cfg(test)] mod tests { use super::*; }` at the bottom of the file
  they test. Integration tests (real git, real files) in `crates/<x>/tests/`. Goldens are
  `tests/golden/<case>/expected.json` (`just golden-update`; byte-compared by `just golden`), invariants via `proptest`. Test names say the behaviour:
  `add_add_conflict_yields_single_conflict_chunk`.
- [RS12] No `mod util`, `mod helpers`, `mod common`. Name the module after what it owns.

## Constants and numbers

- [RS13] Every literal other than `0`, `1` gets a named `const` next to its only user, or in
  `merge_core::DEFAULT_GAP` if it is the tuning constant. Detector: review.

## Subprocess (gitio)

- [RS14] Explicit argv via `std::process::Command`, never a shell string. Always:
  `-c core.quotepath=false`, `LC_ALL=C`, cwd = repo root, stderr captured into the error.
  Bytes in, bytes out — `gitio` never decodes UTF-8.
- [RS15] `git` binary resolved once in `Repo::discover`; every call logs argv at `debug`
  through `tracing`.

## Lints (workspace `[lints]`, do not loosen per crate)

`clippy::pedantic = warn`, `clippy::unwrap_used/expect_used/panic/unreachable = deny`,
`clippy::wildcard_enum_match_arm = deny`, `clippy::too_many_lines = warn` (40),
`unsafe_code = forbid`, `missing_docs = warn` on `merge-core` only.
`#[allow]` requires a one-line reason and is a `should` finding by default.

## References (read on demand, `references/rust-skills/<rule>.md`)

Curated from `leonardomso/rust-skills` (MIT): `own-*`, `err-*`, `name-*`, `type-*`, `proj-*`,
`lint-*`, `anti-*`, `test-*`. Deliberately excluded: `mem-*`, `opt-*`, `perf-*`, `async-*`
(premature optimisation for a tool that diffs 16 files), builder/typestate/sealed-trait
idioms (library-publishing patterns), `mockall` (we run real git). Where a vendored rule
conflicts with RS1–RS15, the house rule wins.
