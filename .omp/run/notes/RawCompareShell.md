# RawCompareShell (3.C-shell, board Raw compare row 6)

`yamt --raw` now opens the compare window, and every acceptance line passed except `just map-check`. That check fails because the eight new command names still need adding to `docs/architecture.md` and `.omp/skills/ipc-contract/SKILL.md`, which this slice can't edit. One part of the real-app proof is weaker than asked: I ended the window by destroying it from the page, not by a native close (details under smoke_evidence).

```
summary
  `yamt --raw` (Invocation::Compare) opens a "Compare — yamt" window over yamt_compare::TabStore in
  <data_dir>/yamt/compare/; no MergeSession, no git, no Mutex<Merge>/HostState, no appimage repo lookup.
  If the store can't be opened, yamt exits 2 with one line before any window. A normal close is exit 0, no message.
  Both windows go through one open_and_wait; the start script sets data-theme and data-window="merge|compare".
  Eight commands in src-tauri/src/compare.rs (load_tab/set_column lock the store only to call it, then diff
  on a worker after the lock is released); new IpcError kinds UnknownTab, ColumnTooLarge, WorkerStopped, with words.

files_changed
  src-tauri/src/compare.rs (new), src-tauri/src/args.rs, src-tauri/src/lib.rs, src-tauri/src/window.rs,
  src-tauri/src/commands.rs, src-tauri/src/ipc_error.rs, src-tauri/src/mock_window.rs, src-tauri/AGENTS.md,
  frontend/src/ui/problemText.ts, frontend/src/ui/problemText.test.ts,
  frontend/src/ipc/bindings.ts (regenerated locally by `just bindings`, only to typecheck)

tests_added
  args::raw_opens_the_compare_window: `--raw` → Compare
  args::raw_with_a_repo_in_either_order_is_a_usage_error: `--raw --repo p` and `--repo p --raw` → the error
  args::help_wins_over_raw: `--raw --help` → Help; `--raw --repo p --version` → Version
  args::the_usage_names_raw: the usage has the `yamt --raw` line and the `--raw` option
  window::the_start_script_names_the_theme_and_the_window (replaces the_start_script_names_the_theme): both kinds and the theme
  compare::a_fresh_store_lists_one_tab_and_every_tab_command_answers_the_list: open_compare (one "Compare 1",
    column_limit), add_tab, rename_tab (trimmed), set_tab_language, show_tab, close_tab, each reply exact JSON
  compare::a_fresh_tab_loads_two_empty_texts_without_differences: load_tab on a fresh store
  compare::set_column_stores_the_text_and_load_tab_gives_it_with_the_differences: the set_column reply and the
    load_tab texts give merge-core compare's exact difference JSON; the column file is written
  compare::an_unknown_tab_and_a_too_large_column_reach_the_window_as_their_kinds: UnknownTab {tab}, ColumnTooLarge {limit}
  compare::a_second_open_of_the_same_data_folder_says_another_window_is_open: the Locked line
  compare::a_broken_tabs_file_says_where_and_that_nothing_was_changed: the Broken line
  compare::a_newer_tabs_file_names_its_format: the NewerFormat line
  compare::a_read_failure_says_the_tabs_cannot_be_read: ReadFailed gives the same words as Broken
  ipc_error::compare_store_problems_serialise_as_read_failures_naming_the_file: Locked, NewerFormat, Broken → ReadFailed
  ipc_error::compare_write_tab_and_size_errors_serialise_with_their_kinds: WriteFailed, ColumnTooLarge, UnknownTab
  problemText.test.ts: "an unknown compare tab says the tab was closed"; "a column over the limit names the
    limit from the reply in MiB" (8 and 4 MiB); "a stopped worker says to try again"

smoke_evidence
  cargo fmt --all --check → fmt ok
  just clippy (cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings) → Finished, no warnings
  cargo test -p yamt-app → test result: ok. 87 passed; 0 failed (+ 5 passed in tests/cli.rs)
  just arch-check → arch-check: ok
  pnpm -C frontend typecheck → `vue-tsc -b`, no errors
  pnpm -C frontend test → Test Files 129 passed (129), Tests 1792 passed (1792)
  oxfmt --check / oxlint --type-aware on the problemText files → correct format, exit 0
  Real app: `cargo tauri build --debug --no-bundle` → Built application at target/debug/yamt
    The app-session tool always passes `--repo`, so I gave it a /tmp launcher that cds to a folder outside any
    repo (`git rev-parse` there: fatal: not a git repository) and runs `yamt --raw`; fresh HOME, XDG_DATA_HOME unset.
    - process: cwd /tmp/yamt-raw-smoke/outside, args `.../target/debug/yamt --raw`
    - just app-session read 'document.documentElement.dataset.window' → {"value":"compare"} (theme "dark")
    - native title (xdotool getwindowname on :2) → Compare — yamt
    - <home>/.local/share/yamt/compare/ → lock, tabs.json {"format": 1, "shown": 1, "nextId": 2, "tabs": [{"id": 1, ... "name": "Compare 1" ...}]}
    - second `yamt --raw`, same HOME → yamt: another yamt --raw window is open (/tmp/yamt-raw-smoke/home/.local/share/yamt/compare); exit 2
    - ending the first: invoke("plugin:window|destroy") from the page, the call Tauri's JS close handler ends
      with → launcher recorded exit 0, no yamt process left
    - `yamt --raw --repo x` → yamt: --raw compares pasted text and takes no --repo, then the usage; exit 2
    - after scripts/conflict-repo.sh: `yamt --raw` started inside it (cwd confirmed), closed the same way → exit 0;
      `git status --porcelain=v2` (7 lines) and `git ls-files -u` (19 lines) → cmp: byte-equal before and after
  Not exercised: a native close through CloseWatch. `xdotool windowquit` on a bare Xvfb (no window manager)
    didn't close the compare window, nor the merge window in the same test; `plugin:window|close` is not
    permitted by the app's capabilities.
  just map-check → fails: the eight commands are not named in docs/architecture.md or the ipc-contract skill (see deviations)

deviations_from_brief
  - Added a third new IpcError kind, `WorkerStopped`: the worker join can fail if the diff panics, and no existing
    kind fits. It is logged with tracing::error!. Its words are in problemText.ts and the bindings carry it.
  - problemText.ts: causedText was over the 40-line lint limit, so `Git` and `Unexpected` now share one case and the
    fixed reasons (NoConfigFolder, MergeAborted, UnknownTab, WorkerStopped) come from a `FIXED_REASONS` table.
    Same words as before.
  - open_compare returns Result as the contract says, with #[expect(clippy::unnecessary_wraps, reason)] because it
    cannot fail.
  - From<yamt_compare::Error>: Locked → ReadFailed with message "another yamt --raw window holds it"; NewerFormat →
    message "written by a newer yamt (format N)". The brief did not give these messages.
  - Start-failure words: Broken and ReadFailed are written out in compare.rs (ReadFailed's own text differs); the
    other errors use the crate's own message (Locked and NewerFormat already match the brief).
  - The difference test pins merge-core compare's JSON as observed (InlineRange = {line, start, len}), because
    yamt-app cannot depend on yamt-merge-core (PM1).
  - Docs outside Owned, needed for `just map-check`: name open_compare, load_tab, set_column, add_tab, close_tab,
    rename_tab, set_tab_language, show_tab in docs/architecture.md and .omp/skills/ipc-contract/SKILL.md (Commands
    block and IPC4: UnknownTab, ColumnTooLarge, WorkerStopped). The project map's src-tauri line should name
    compare.rs and the third Mutex (RS5 is amended by plan §2 #97).
  - Compare mode registers the same invoke handler as the merge window, so merge or server commands called there
    answer Tauri's "state not managed" error. Row 11's page never calls them.
  - The tree already had uncommitted changes in crates/merge-core, crates/cli and .omp/run/slices.json that are not
    from this slice; I left them alone. My bindings.ts reflects them too.

open_risks
  - src-tauri/src/window.rs:79-90 (open_compare): the exit 0 on a native close (window-manager close → CloseWatch →
    the page answers → destroy) wasn't seen in a real run, only the destroy step. Until row 11 the compare window
    still shows the merge page, whose list and server calls fail with "state not managed" (logged, harmless).
  - src-tauri/src/compare.rs (on_worker): store I/O and the diff both run on spawn_blocking; the sync tab commands
    (add/close/rename/language/show) write tabs.json on the calling thread, as the settings commands do.
  - Opening the store happens after the Tauri app is built but before any window; the app is dropped on failure.
```

Checks for you to run on the merged tree: `just check` (it will fail at `map-check` until the docs above are updated), `just bindings-check` after you regenerate the bindings, and `just mutants`.