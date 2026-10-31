# Slice MrAiCarry — `--ai` reaches the changes window a merge request opens

Owner, 2026-10-31: "make the gitlab vscode task have --ai flag". Asked whether the flag should only be added to
the task (no visible effect) or carried on, he picked "Pass --ai on to opened windows". Amends plan §2 #108
("only `Invocation::Range { ai }` keeps it") and #132 ("… reaped by a waiter thread, without `--ai`").

Today: `args.rs` parses `--diff --ai` to plain `Invocation::Compare`, so the flag is dropped. The merge-request
page's "Show Diff" (`merge_requests.rs` `opened` → `second_window::start_range`) starts `yamt --diff=<base>..<head>
--repo <root>` without `--ai` (`range_arguments`), even from a range window that was started with `--ai`.

## Target

Owned: `src-tauri/src/args.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/window.rs`, `src-tauri/src/merge_requests.rs`
and its tests (`src-tauri/src/merge_requests/**`), `src-tauri/src/second_window.rs`, `src-tauri/src/range.rs` (only
its call to `merge_requests::manage`, if it is there), and `src-tauri/AGENTS.md`. Read-only: everything else,
`frontend/` included. No IPC type changes (`just bindings-check` stays clean).

## Change

1. `Invocation::Compare { ai: Ai }`: `--diff --ai` keeps the flag. The parse tests pin both forms. `--ai` is still
   never stored, and still does nothing in the merge window.
2. The compare window's start script stays as it is (no `data-ai`: the compare window has no threads); only the
   window's merge-request state learns the flag.
3. `MergeRequestState` holds the window's `Ai`, set by `manage` from the compare window's and the range window's
   own flag.
4. "Show Diff" passes it on: `start_range` adds `--ai` to the second yamt's arguments when the window's `Ai` is `On`,
   and leaves it out when it is `Off`. Resolve and Continue still start the merge window without `--ai` (it has no
   AI).
5. Tests: the arguments with and without `--ai` (rename the `…_without_ai` test so it pins both cases), and the parse
   of `--diff --ai`.

## Acceptance

- Hermetic `cargo nextest run -p yamt-app`, `cargo clippy -p yamt-app --all-targets -- -D warnings`, `cargo fmt
  --check`, `just bindings-check`: report the summary lines. `just mutants HEAD` (SP11).
- Smoke with the debug build on a private display: `scripts/mr-conflict-repo.sh /tmp/<dir>`, then `just app-session
  start-app --diff --ai --dir /tmp/<dir> --glab mr-conflicts` (pass the flag through the way `start-app` accepts
  extra arguments; if it does not, say so and use the closest equivalent). Open "Merge requests" and click "Show Diff"
  on one row. Report the started child's command line (`pgrep -af 'yamt --diff='`), which ends with `--ai`. Then
  repeat without `--ai` and report that the child has no `--ai`. Stop every session, and leave no yamt from this run.

## Skills

`skill://rust-conventions`, `skill://verification`, `skill://decision-record`.
