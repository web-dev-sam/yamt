# WindowsBuild — round 1 (`4512fbb`, base `9da4adb`)

Brief: `docs/slices/briefs/3.X-windows-build.md`. Patch: `.omp/run/patches/WindowsBuild.patch`.

## What exists now

- gitio: `path_from_git` (entry.rs; unix raw bytes, elsewhere UTF-8 lossy) for paths read from git; `as_encoded_bytes`
  for paths sent to git; `find_git_on_path` → `git_in` + `GIT_FILE_NAME` + `is_runnable` (per platform: `git.exe` on
  Windows, execute bit on unix; absolute PATH entries only on both).
- session: `create_private_dir` (0700 on unix, plain `create_dir` elsewhere); link target bytes via `into_encoded_bytes`.
- conflict-repo: `link_to` (unix symlink; elsewhere `Unsupported` — replaced in rework 1, #784).
- src-tauri: `appimage` Linux-only; `tauri.conf.json` `nsis` target; before-commands `pnpm dev --mode tauri …` /
  `pnpm build --mode tauri` with `frontend/.env.tauri` (`VITE_CHUNK_SOURCE=tauri`).
- `.gitattributes` `* -text`; `.github/workflows/ci.yml` (push + PR, ubuntu-22.04 / macos-14 / windows-2025, `just test`
  via taiki-e/install-action, tauri build, NSIS artifact `yamt-windows-installer`, frontend tests on Ubuntu);
  `release.yml` + windows-2025 (bash default shell); licence script: Windows target, CR stripped, `\` → `/`.
- Orchestrator: `THIRD_PARTY_LICENSES.txt` regenerated (`c6f2da9`, 332 → 356 crates).

## Evidence (implementer)

- `cargo check` / `cargo clippy -D warnings --workspace --all-targets --target x86_64-pc-windows-msvc`: exit 0 (llvm-rc
  23.1.1 unpacked into `/tmp/yamt-llvm` for tauri-winres).
- `just clippy` exit 0; `just test` 359 run, 359 passed, 1 skipped; `cargo fmt --check` clean.
- `cargo tauri build --debug --no-bundle`: `pnpm build --mode tauri` → `vite build --mode tauri`; app lists the smoke
  repo's 7 files from git (app-session `read`).
- YAML parses; actionlint 1.7.12 exit 0 (shellcheck absent).

## Deviations accepted

deny.toml unchanged (no `[graph] targets`); `just test` in CI instead of a copied hermetic env; lossy UTF-8 path on
non-unix (git for Windows stores UTF-8); licence-script CR/backslash handling for Git Bash.

## Facts for README

Installer `yamt_<version>_x64-setup.exe` (CI artifact `yamt-windows-installer`), per-user, no admin; WebView2 ships with
Windows 10/11, otherwise the installer downloads Microsoft's bootstrapper; Git for Windows required (`git.exe` on PATH);
console program, run from a terminal in the repository; `core.autocrlf=true` repositories untested.

## Open risks

`just` on windows-2025 must resolve `bash` to Git Bash, not WSL's launcher; gitio timeout tests use `sleep` in a git `!`
alias on Windows; licence diff under Git Bash; Windows temp ACL [INFERENCE]; the first CI run is the proof (#780).

## Review

Boundary: fail — blocks #781 (deleted_side link fixture), #782 (whole-file unix gates), #783 (copied workflow setup),
promoted should #784 (Symlink compiles on Windows); dropped #785, #786. → rework 1.

## Rework 1 (`cace957`)

`FileKind::Symlink` unix-only at compile time (`link_to` stub gone); smallest gates in deleted_side, disk_is_truth,
start_from_disk, describe, take, every_kind (Windows compiles 74 session tests, was 41); `.github/actions/setup` shared
by ci.yml and release.yml. Boundary re-check pass.

## Mutants (`9da4adb`) and correctness

44 mutants, 29 caught, 8 unviable, 7 missed — all judged (#792): non-unix variants killed on windows-2025 by named tests,
`link_to` gate-covered, start.rs:284 newline guard = old #581. Correctness fail: #790 (RK25: under Git for Windows'
core.symlinks=false a link conflict is a plain file and was staged silently at the first refresh), #791 (promoted).

## Rework 2 (`278321e`)

`compare_stage`: `OnDisk::File(bytes) if is_link => same(link blob, bytes)`; later `!is_link` guards removed as
redundant. Test `a_link_git_wrote_as_a_plain_file_is_untouched_and_stays_an_unresolved_link` (ungated, builds the 120000
stage with git plumbing): failed before (`DiskChange{link, Staged}`), passes after. Only link rows gated in
open_and_load (RK18 submodule reset now on Windows), describe, disk_is_truth. `just test` 370 pass; Windows-target
check/clippy clean (with #793 fixed in `454db8e`). Correctness re-check pass.
