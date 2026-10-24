`yamt --diff=<range>` now opens a read-only window over the range: the argument is parsed, the window has its own state, and its two commands exist. Every acceptance item ran on a real build. Until row 9 lands, the window still shows the merge page.

```
summary
  - args.rs: `--diff=<text>` goes through RangeSpec::parse, and its SpecError is the usage line. `--repo <p>` works
    in either order. `--diff` alone stays Compare, and `--diff --repo` stays DIFF_WITH_REPO. `--diff` together with
    `--diff=`, or two `--diff=`, gives "give --diff or one --diff=<range>, not both". The help text is design §1's,
    word for word.
  - New range.rs: run_range checks the range before any app is built. It then takes PairLock under
    <data_dir>/yamt/range, lists the range, manages RangeState (no Mutex), opens WindowKind::Range titled
    "<range> — <folder> — yamt", and exits 0. It has two commands: open_range and load_range_file (spawn_blocking;
    a panic → WorkerStopped).
  - window.rs: WindowKind::Range → data-window="range"; context, open_and_wait and window_title are now pub(crate).
    lib.rs gains the Range arm (appimage on Linux). commands.rs registers both commands and adds with_range.
    ipc_error.rs gains UnknownRangeFile and an exhaustive From<yamt_range::Error>.

files_changed
  src-tauri/src/args.rs
  src-tauri/src/lib.rs
  src-tauri/src/window.rs
  src-tauri/src/range.rs (new)
  src-tauri/src/commands.rs
  src-tauri/src/ipc_error.rs
  src-tauri/AGENTS.md

tests_added
  args.rs:
    - a_range_takes_the_current_directory_or_a_repo_in_either_order: catches a dropped --repo, or a range
      treated as Merge or Compare.
    - each_malformed_range_is_its_usage_line: the five lines of the §1 table, written out as literals.
    - diff_and_a_range_or_two_ranges_are_a_usage_error: --diff then --diff=, --diff= then --diff, and two --diff=.
    - the_usage_names_the_range_forms: both usage lines and the `--diff=<range>` option row.
    - Unchanged: diff_opens_the_compare_window (--diff alone stays Compare).
  window.rs:
    - the_start_script_names_the_theme_and_the_window gains the Range case, data-window="range".
  range.rs:
    - open_range_answers_the_range_s_start: the IPC reply equals serde(Range::start()).
    - a_listed_file_loads_and_an_unknown_id_answers_unknown_range_file: id 0 loads as texts; id 7 gives
      Err {"kind":"UnknownRangeFile","file":7}.
    - a_second_window_on_the_same_pair_is_refused_naming_both_short_ids: manage_range_in on the same data folder
      gives the Locked line with both short ids and the root.
    - the_title_is_the_range_as_typed_then_the_repository_folder: "main...feature — proj — yamt".
  ipc_error.rs:
    - an_unknown_range_file_has_its_kind_and_a_start_refusal_is_its_line: UnknownFile → UnknownRangeFile;
      NoMergeBase → Git with its line.

smoke_evidence
  cargo fmt --check → FMT_OK
  cargo clippy --workspace --all-targets -- -D warnings → "Finished `dev` profile", no warnings
    (also run with --features yamt-app/bindings → Finished, no warnings)
  cargo test -p yamt-app → "test result: ok. 101 passed; 0 failed" (lib), "ok. 5 passed" (the other binary)
  just arch-check → "arch-check: ok"
  export-bindings into target/range-bindings.ts (bindings.ts itself not touched): openRange, loadRangeFile,
    `{ kind: "UnknownRangeFile"; file: RangeFileId }` and every Range* type are present.
  Real app: `cargo tauri build --debug --no-bundle`, then target/debug/yamt against a temp repository
    (main, feature branched off main, and `other` with unrelated history). Private Xvfb; XDG_DATA_HOME and
    XDG_CONFIG_HOME pointed at temp folders.
    $ yamt --diff=main --repo proj
      → "yamt: --diff=main: a range needs two dots (a..b) or three (a...b); yamt does not compare the working tree"
        + usage, exit 2
    $ yamt --diff=nope..main --repo proj → `yamt: git names no commit "nope"`, exit 2
    $ yamt --diff=main...feature --repo /tmp
      → "yamt: /tmp is not inside a git repository: fatal: not a git repository (or any parent up to mount point /)",
        exit 2
    $ yamt --diff=main...other --repo proj → "yamt: main and other have no merge base", exit 2
    $ yamt --diff --diff=main..feature → "yamt: give --diff or one --diff=<range>, not both" + usage, exit 2
    (These four ran with DISPLAY unset, so no window could have been built.)
    $ yamt --diff=main...feature --repo proj & → window "main...feature — proj — yamt"
      (screenshot /tmp/rvshell/first.png)
    Same pair again → "yamt: another yamt window shows bb9ed6b..f2f29a4 of /tmp/rvshell/proj", exit 2
    Same pair typed as feature~1..feature → the same line, exit 2
    $ yamt --diff=main..feature --repo proj & → a second window "main..feature — proj — yamt" beside the first
    WM_DELETE_WINDOW to both → "first window closed: exit 0", "second window closed: exit 0"
    Lock folders: data/yamt/range/proj-1f0b7712b903b6bf/<base>-<feature>/lock and <main>-<feature>/lock
    What the window showed: the merge page (empty Files panel) with the problem bar "Could not list the conflicted
    files: state not managed for field `state` on command `list_stop`…". That is expected until row 9's main.ts
    switch lands.

deviations_from_brief
  - range.rs has its own APP_FOLDER "yamt", the same value as compare.rs's private constant, because compare.rs is
    not in Owned. One shared constant (vision 2) would need compare.rs to make APP_FOLDER pub(crate); range.rs could
    then import it.
  - window_title in window.rs is now pub(crate) too, so the range title reuses "<folder> — yamt".
  - The range tests build their own mock window inside range.rs (with_range(mock_builder()) + invoke_on), because
    mock_window.rs is not in Owned. A range-window helper there would follow open_compare_window if wanted.
  - A test beyond the acceptance list: the same pair twice in the shell (manage_range_in) gives the Locked line.
  - The real-app close used WM_DELETE_WINDOW sent directly (a throwaway ctypes script, since deleted). Xvfb has no
    window manager, and `xdotool windowquit` closed neither the range nor the --diff window there.
  - app-session cannot start --diff=<range> yet (W4 adds that), so the smoke used a plain run instead.
  - Docs outside Owned, for the docs slice: the project-map src-tauri entry (range.rs, WindowKind range,
    with_range, UnknownRangeFile) and architecture §3.5.

open_risks
  - src-tauri/src/range.rs load_range_file: the WorkerStopped path has no test. Compare's test injects a panicking
    closure through on_worker; the range command has no such seam, and I did not add one for a single caller.
  - src-tauri/src/ipc_error.rs From<yamt_range::Error>: the Git(source) arm has no test. src-tauri may not depend
    on yamt-gitio (PM1), so the test cannot construct a gitio Error.
```