The review fails with one block finding: a later `--help`/`--version` no longer wins over the two new `--diff=` usage errors. Everything else I traced behaves as the brief and plan §2 #101/#103/#107 require. I ran no tests, because reading the code settles the block.

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "src-tauri/src/args.rs",
      "line": 72,
      "rule_id": "plan §2 #101 / src-tauri AGENTS.md args.rs",
      "problem": "The new usage errors are returned inside the loop (`with_compare()?` :72, `with_range(range)?` :81), so `yamt --diff --diff=a..b --help` and `yamt --diff=main --version` exit 2 with the usage error. The patch's own AGENTS.md line lists the 'not both' error and then says '`--help`/`--version` win'. The older combination rule still keeps that promise: `--diff --repo p --version` → Version (`help_wins_over_diff`), because `DIFF_WITH_REPO` is decided after the loop. So two combination errors of the same kind now behave differently. No test covers a range argument followed by `--help`.",
      "fix": "Carry `window` through the loop as a `Result<Window, String>` (`window = window.and_then(Window::with_compare)` / `window.and_then(|w| w.with_range(range))`) and apply `let window = window?;` after the loop, as `DIFF_WITH_REPO` already is. Add `help_wins_over_a_range_error`, asserting `--diff --diff=a..b --help` → Help and `--diff=main --version` → Version."
    }
  ],
  "checked": [
    "Mutation survivor `range.rs:64 range_folder -> Default::default()`: it cannot be dropped under VF7 (a)/(b)/(c). It is the boundary review's existing block ('a test of the range folder'), so it is not repeated here. The other 26 mutants were caught (8) or unviable (18).",
    "Usage lines: `SpecError`'s Display (crates/range/src/spec.rs:21-30) gives each line of design §1's table word for word: Empty, NoDots, ExtraDots for both `a....b` and `a..b..c`, and Dash. `args.rs` passes it through unchanged (`map_err(to_string)`). `each_malformed_range_is_its_usage_line` pins all five as literals, so a remapped or swallowed error fails it.",
    "'not both': `--diff --diff=a..b`, `--diff=a..b --diff` and two `--diff=` all give DIFF_TWICE (`Window::with_compare`/`with_range`). `diff_and_a_range_or_two_ranges_are_a_usage_error` covers all three orders. `--diff --diff` stays Compare, as before; plan #101 does not list it.",
    "`--diff=a..b --repo p` in both orders gives Range with repo `p`; with no `--repo` the repo is `.` (`a_range_takes_the_current_directory_or_a_repo_in_either_order`). `--diff` alone stays Compare (`diff_opens_the_compare_window`), and `--diff --repo` stays DIFF_WITH_REPO (existing test, unchanged).",
    "Help text: `diff` of RangeDesign.md:135-151 against args.rs:7-23 shows no difference except the closing fence. `the_usage_names_the_range_forms` pins both usage lines and the `--diff=<range>` row.",
    "lib.rs: the Range arm calls `appimage::repo_from_start_dir` on Linux, then `range::run_range(...).report()`. A usage error goes through the existing `Err` arm: message, then USAGE, exit 2 (outcome.rs `Exit::Failure = 2`; `report` prints `yamt: <line>`).",
    "Order resolve → build → lock → list: `run_range` resolves before `open_window` builds the app (range.rs:22-30). `manage_range_in` takes `PairLock` before `list` and manages the state only after both succeed. Every failure returns `Ending::failure` before `open_and_wait`, so no `WebviewWindowBuilder` runs. tauri.conf.json `windows: []`, so building the app opens no window. The smoke supports resolve-before-build: the git lines appeared with DISPLAY unset, where a GTK build would have failed first.",
    "Exit codes: resolve, data folder, lock and list failures, and an `open_and_wait` error, all end in `Ending::failure` (exit 2). A closed window ends in `Ending { Success, None }` (exit 0), with the same `CloseWatch` and no question, as for compare. No `MergeState`/`HostState` is read after close, unlike `open_merge`, so no panic on unmanaged state.",
    "Title: `range_title` = `spec.text()` (the text as typed, spec.rs:66) + `window_title(resolved.root())` (the repository root, open.rs:65), passed to `open_and_wait`'s `.title`. `the_title_is_the_range_as_typed_then_the_repository_folder` pins the format. The Xvfb screenshot /tmp/rvshell/first.png has no title bar (no window manager), so the real-app title rests on the report's stated observation plus this unit test and one line of wiring.",
    "Start script: `WindowKind::Range` → \"range\" in an exhaustive match. Its test asserts the full script string with `data-window = \"range\"` (window.rs test), so a wrong name fails it.",
    "IpcError: `From<yamt_range::Error>` matches all seven variants with no wildcard. UnknownFile → `UnknownRangeFile { file }`; Git(e) → `Git { message: e.to_string() }`; NotARepository/UnknownName/NoMergeBase/Locked/LockFailed → `Git { message: error.to_string() }`. The ipc_error test serializes `{kind:'UnknownRangeFile',file:9}` and NoMergeBase → Git with its line, so swapping the two mappings fails it.",
    "Commands: `open_range_answers_the_range_s_start` compares the IPC reply with a fresh `Range::start()` serialization. `a_listed_file_loads_and_an_unknown_id_answers_unknown_range_file` checks the loaded right text and `Err {kind:'UnknownRangeFile',file:7}` end to end through `invoke_on`, so the error path through `?` and the From is exercised.",
    "Pair lock: `a_second_window_on_the_same_pair_is_refused_naming_both_short_ids` asserts the exact Locked line with both short ids and the root. The smoke's lock folders under /tmp/rvshell/data/yamt/range/proj-<hash>/<left>-<right>/lock agree with plan #107. A different pair gets its own folder (two pair folders present).",
    "Accepted open risks: the `Git(source)` arm is untested (PM1 forbids constructing a gitio error); the untested WorkerStopped path is already in the boundary review's shared-helper finding and is not repeated.",
    "Not repeated, per the task: the shared worker-panic helper, the shared data-folder opener with one APP_FOLDER, and one `with_commands`."
  ]
}
```