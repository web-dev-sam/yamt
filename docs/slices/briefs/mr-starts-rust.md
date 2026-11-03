# Slice MrStartsRust — `--mr` and `YAMT_AI` at start

Request `docs/slices/request-mr-starts.md` parts B and C (rules B1–B3, C1–C2, acceptance B and C). Base: main
`6c34a149`. Shape given by the request; no designer.

Known facts (tree at base):

- `src-tauri/src/args.rs`: `parse(args)` → `Invocation::{Merge { repo }, Compare { ai }, Range { spec, repo, ai },
  Help, Version}`; `Window::{Merge, Compare, Range}` collects the `--diff` flags; `(Window::Compare, Some(_))` is
  refused with `DIFF_WITH_REPO` (`:27`, `:109`); `USAGE` at `:6-25`.
- `src-tauri/src/lib.rs:49` calls `args::parse(std::env::args_os().skip(1).collect())`; `:58-63` hand `ai` to
  `window::run_compare` and `range::run_range`. `LOG_FILTER_VAR = "YAMT_LOG"` (`:42`) is the one env name there today.
- `src-tauri/src/start_script.rs`: `start_script(theme, kind, ai)` writes `document.documentElement.dataset.*` lines
  the page reads at start (`frontend/src/main.ts:42`, `:71`); `data-ai` only for `Range` + `On`. `window.rs:145` uses
  it; `window.rs:100` opens the compare window with `Ai::Off` (the compare page has no threads).
- `second_window.rs:123-141`: its tests build arguments and check them with `args::parse`, so they pin
  `Invocation`'s shape.

## Target

Owned: `src-tauri/src/args.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/start_script.rs`, `src-tauri/src/window.rs`,
`src-tauri/src/range.rs`, `src-tauri/src/range/**`, `src-tauri/src/second_window.rs`, `src-tauri/AGENTS.md`.

Read-only: everything else; `frontend/**` (the page side is another slice; it relies on the contract below),
`README.md`/`.readmer/**` and `docs/**` (lines needed there go to `deviations_from_brief`).

Non-goals: any other env variable; an AI setting; `--mr` doing anything in the merge window; the second yamt
started by "Show Diff" getting `--mr` (it opens a range window on its files, as today).

## Contract (fixed)

- The page learns the start screen from the start script: `document.documentElement.dataset.open = "mergeRequests";`
  appended for a compare or range window started with `--mr`, and absent otherwise (never for the merge window).
  The frontend slice reads exactly `dataset["open"] === "mergeRequests"`.
- Env name `YAMT_AI`. Unset, empty or `0` → `Ai::Off`; any other value (incl. non-UTF-8) → `Ai::On`. `--ai` →
  `Ai::On` regardless. Read once in `lib.rs` and passed into `parse` (the parse tests set no process environment).

## Change

1. `args.rs`: `--mr` flag. With no `--diff`/`--diff=<range>` it means `--diff` (`Window::Merge` → compare); with
   `--diff` or `--diff=<range>` (either order) it only marks the start screen. `yamt --mr --repo p` and
   `yamt --repo p --mr` are refused with `DIFF_WITH_REPO`, as `--diff --repo p`. `--mr` twice is the same as once.
   The start screen is a sum type carried by `Invocation::Compare` and `Invocation::Range` (vision 4: no `bool`), not
   by `Merge`.
2. `args.rs`: `parse` takes the `YAMT_AI` value (`Option<OsString>` or `Option<&OsStr>`) beside the arguments and
   starts `ai` from it; `lib.rs` passes `std::env::var_os("YAMT_AI")` through a named constant.
3. `start_script.rs` + `window.rs` + `range.rs`: the start screen reaches `start_script`, which appends the contract
   line. Keep one function deciding the extra lines; extend its two tests (marker only for compare/range with `--mr`).
4. `USAGE`: a `yamt --mr` line and `[--mr]` on the `--diff` forms; a `--mr` option line ("open the merge-request page
   at start; without --diff=<range> it means --diff"); an environment line naming `YAMT_AI=1` as `--ai` for every start,
   beside `--ai`. Plain words, the existing column layout.
5. Tests (`args.rs`): every combination of rules B1, B2 (`--mr`; `--diff --mr`; `--mr --diff`; `--diff=a..b --mr`;
   `--mr --diff=a..b --repo p`; `--mr --repo p` refused with the same text; `--mr` + `--help` → Help), and C1
   (variable unset, empty, `0`, `1`, `yes`; `--ai` with `0`). `second_window.rs` tests follow the new shape.

## Acceptance

- `cargo nextest run -p yamt-app`, `cargo clippy -p yamt-app --all-targets -- -D warnings`, `cargo fmt --check`,
  `just bindings-check` (no IPC change): summary lines. `just mutants HEAD` (SP11).
- Debug build: `target/debug/yamt --help` shows the new lines (paste them); `target/debug/yamt --repo /tmp --mr`
  prints the refusal and exits non-zero.
- Real app on a private display (`scripts/mr-conflict-repo.sh /tmp/<dir>`, `just app-session start-app --diff --dir
  /tmp/<dir> --glab mr-conflicts`; the session tool has no `--mr` yet, so pass it the way the tool allows or run the
  debug binary on the session's display yourself): `document.documentElement.dataset.open` is `"mergeRequests"` with
  `--mr` and `undefined` without (read it through the session's WebDriver `execute`). With `YAMT_AI=1` in the
  environment and `--diff=<range>` the page has `dataset.ai === "on"`; with `YAMT_AI=0` it is absent. Stop every
  session; leave no yamt from this run.

## Skills

`skill://rust-conventions`, `skill://verification`, `skill://decision-record`.
