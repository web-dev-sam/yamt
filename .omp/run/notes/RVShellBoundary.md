```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "src-tauri/src/range.rs",
      "line": 63,
      "rule_id": "VF7",
      "problem": "Mutation survivor `range_folder -> Default::default()` still passes every test, so nothing checks the folder plan §2 #107 fixes at `<data_dir>/yamt/range/`, which is where B's threads and C's checkout will live. If the folder is wrong, the pair locks are created under the process's current directory. That can be the user's work tree, where they show up as untracked files. Two windows started from different directories would also not see each other's lock, so the same pair would open twice. The survivor cannot be dropped under (a), (b) or (c): `range_folder` is a path constant, not wiring, and the smoke's 'Lock folders: data/yamt/range/…' line is not a committed test.",
      "fix": "In `open_range_window` or a new test, assert `window._app.state::<RangeState>()._lock.folder().starts_with(window.data.path().join(\"yamt\").join(\"range\"))`, with literal folder names, so a changed constant or a dropped join fails the test."
    },
    {
      "severity": "should",
      "file": "src-tauri/src/range.rs",
      "line": 86,
      "rule_id": "growth: copied decision",
      "problem": "The rule that a panicked worker is logged with `tracing::error!` and answers `IpcError::WorkerStopped` (86–92) is copied from `compare.rs` `on_worker` (60–67). Only compare's copy is tested (`compare.rs:286`), so the range copy is the untested path named in open_risks. Each further async range command copies the rule again, without a test.",
      "fix": "Put one `pub(crate) async fn blocking_reply<T: Send + 'static>(work: impl FnOnce() -> Result<T, IpcError> + Send + 'static) -> Result<T, IpcError>` beside `WorkerStopped`, for example in `ipc_error.rs`. Call it from `load_range_file` and from compare's `on_worker`, and move compare's panic test onto it. This touches `compare.rs`, so the orchestrator has to widen Owned."
    },
    {
      "severity": "should",
      "file": "src-tauri/src/range.rs",
      "line": 33,
      "rule_id": "promote",
      "problem": "`open_window` (33–48) copies `window.rs` `open_compare` (88–103) almost line for line: the build, the `data_dir()` lookup with its 'no data folder: …' line, the early failure, `open_and_wait`, and `Ending { Success, None }`. `APP_FOLDER = \"yamt\"` (range.rs:11) also repeats `compare.rs:12`. A change to the app's data folder or to that refusal now has to be made twice, or the two windows quietly diverge. This is the second slice in a row (after RVColumns) whose shared home lay outside Owned, which is why it is tagged promote.",
      "fix": "Add one `window.rs` function, for example `open_with_data_folder(app, title, kind, manage: impl FnOnce(&App, &Path) -> Result<(), String>) -> tauri::Result<Ending>`, that hands `manage` `<data_dir>/yamt` (one `APP_FOLDER` there). `open_compare` and `range::run_range` call it, and `compare_folder`/`range_folder` join only their own sub-folder. `compare.rs` is not in Owned, so the orchestrator has to widen it."
    },
    {
      "severity": "should",
      "file": "src-tauri/src/commands.rs",
      "line": 71,
      "rule_id": "growth: dead weight",
      "problem": "`with_range` has the same body as `with_compare` (66): `builder.invoke_handler(specta_builder().invoke_handler())`. Every window whose state is managed after the build gets another identical function, and `commands.rs` is already at 392 of 400 lines (RS6). The brief named `with_range`, so this goes to triage.",
      "fix": "Replace both with one `with_commands(builder)`, documented as 'a window whose state is managed once the data folder is known', and call it from `window::open_compare` and `range::open_window` (or from the shared opener in the finding above)."
    },
    {
      "severity": "nit",
      "file": "src-tauri/src/args.rs",
      "line": 40,
      "rule_id": "RS16",
      "problem": "The private enum `Window { Merge, Compare, Range(RangeSpec) }` shares its name with `mock_window::Window` and tauri's `Window`, and has the same variants as `window::WindowKind`. A reader searching for `Window::Merge` finds two unrelated types. Nothing gets harder as the app grows.",
      "fix": "Rename it after what it holds, for example `DiffFlags` (its own doc says 'what the `--diff` flags seen so far ask for')."
    }
  ],
  "checked": [
    "Ownership: the patch touches only Owned files (args, lib, window, range (new), commands, ipc_error .rs, src-tauri/AGENTS.md) plus the report under .omp/run/notes, as earlier patches do (RVCrate, RVGitio, RVColumns). Cargo.toml was not touched; `yamt-range.workspace = true` is already at src-tauri/Cargo.toml:31.",
    "The contract matches the brief: `Invocation::Range { spec, repo }` (args.rs:35); `WindowKind::Range` → \"range\", with `context()` and `open_and_wait()` made pub(crate) (window.rs:46–59, 77, 105); `RangeState { range, _lock }` with no Mutex (range.rs:15); `run_range(&Path, &RangeSpec) -> Ending`; and `open_range`/`load_range_file` with the contract's signatures. `IpcError::UnknownRangeFile { file }` is in place, and `From<yamt_range::Error>` is exhaustive with the mapping the contract gives (ipc_error.rs:128–144).",
    "PM1: yamt-app depends on yamt-range, which arch-check.sh:52 allows (amended by #104). No gitio or merge-core import was added to src-tauri. range.rs imports only yamt_range, tauri and crate modules.",
    "Plan #101 (extended): `--diff` alone is Compare, `--diff --repo` is DIFF_WITH_REPO, `--diff=` with `--repo` in either order is Range, and `--diff` with `--diff=` or a second `--diff=` gives DIFF_TWICE (args.rs:47–97). The help text matches design §1 word for word (args.rs:6–23 against RangeDesign.md §1).",
    "Plan #103/#107: the range is resolved before any app is built (range.rs:29–32). The lock is taken before `list`, and both before `open_and_wait`, so 'the window appears after git listed the files' holds and the Locked refusal builds no window. The title is `<spec.text()> — <window_title(root)>`, reusing the one `window_title` rule. The window ends with exit 0 and no message. There is no MergeSession, no `servers::manage` and no TabStore: `with_range` sets only the invoke handler.",
    "lib.rs: the Range arm is exactly design §1's arm (appimage on Linux, then `run_range(...).report()`), and the crate doc line covers the third mode (CP3).",
    "State: `RangeState` is written once by `manage_range_in` and only read afterwards (`open_range`, `load_range_file`), so it has one writer. There is no Mutex, so RS5's three-Mutex note stays true. The §5.1 row for it belongs to the docs pass.",
    "IPC5: both commands are 12 lines or fewer and delegate to one `Range` method. `load_range_file` reads its state from the window, as compare's async commands do, and the comment above it is CP1 with its source (tauri-macros 2.7 wrapper.rs:222).",
    "RS2: `manage_range_in<R>` and `load_range_file<R>` are each instantiated with Wry (the app and the specta builder) and MockRuntime (the tests), the same as compare's.",
    "RS6: range.rs 201, args.rs 242, window.rs 368, ipc_error.rs 349 and commands.rs 392 lines, all within 400; no function over 40 lines. RS13: `RANGE_FLAG`, `CURRENT_DIR`, `DIFF_TWICE` and `RANGE_FOLDER` are named; the two `\".\"` literals became `CURRENT_DIR`.",
    "Comments: the doc lines on `RangeState`, `run_range`, `manage_range_in`, `with_range` and the args `Window` enum each say what the item is (CP2). No narration, TODO or section headers.",
    "Accepted deviation: `window_title` made pub(crate), which reuses the one '<folder> — yamt' rule instead of copying it.",
    "Accepted deviation: the range tests build their own mock window in range.rs (`range_app` + `invoke_on`). It is test-only, its only user is range.rs, and AGENTS.md documents it; moving it into mock_window.rs adds nothing until a second user exists.",
    "Not accepted: the APP_FOLDER duplicate (reported above as `promote`). Its fix is outside Owned, so it goes to triage rather than blocking.",
    "Open risk 'Git(source) arm untested': accepted. Constructing a `yamt_gitio::Error` would need a gitio dependency, which PM1 forbids, and the arm is `source.to_string()`, the same as the session mapping at ipc_error.rs:57.",
    "Generated TS: the committed bindings.ts:227 already carries `{ kind: \"UnknownRangeFile\"; file: RangeFileId }`, and problemText.ts:24,141 handles it in its exhaustive switch (IPC4), so the frontend typecheck does not break on the new variant.",
    "args.rs: `--diff=main --help` answers the usage error, not Help, because range errors are found inside the loop. This is the same as the existing unknown-argument rule (`--force --help`), and USAGE is printed either way. Not a finding.",
    "AGENTS.md: the new range.rs, window.rs, commands.rs, args.rs and ipc_error.rs passages match the code. The project-map, architecture §3.5/§5.1 and the ipc-contract IPC4 list belong to the orchestrator's docs pass and are not graded here.",
    "I ran no checks of my own; this review comes from reading the patch and the files."
  ]
}
```