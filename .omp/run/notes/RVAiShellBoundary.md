**Verdict: fail** — one `block` finding.

The block is `forward` in `ai.rs`. The implementer copied it from `servers.rs` because `servers.rs` was not in Owned. The rest are `should`s and one nit; three of the `should`s are for the orchestrator (a stale comment in plan §2 #108, missing architecture and ipc-contract docs).

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "growth: rule copied instead of shared",
      "file": "src-tauri/src/ai.rs",
      "line": 130,
      "problem": "`forward` is a line-for-line copy of `servers.rs:57` `forward`. It now works on the identical type, because `yamt_agent::HostEvent` and `yamt_lsp_host::HostEvent` are both re-exports of `yamt_pipe::HostEvent`. Its rule ('returning drops the receiver, which stops the run once the page cannot take its events') therefore has two copies that must change together. The test helpers `channel_into` (ai.rs:300) and `is_alive` (ai.rs:310) also copy `servers.rs:200`/`:222`. The implementer declared the copy only because `servers.rs` was not Owned.",
      "fix": "The orchestrator widens Owned to `servers.rs`. Keep one `pub(crate) fn forward` (in a small module both use, e.g. `events.rs`, or `pub(crate)` in `servers.rs`) and call it from `ai::start_agent`. Share `channel_into`/`is_alive` as `#[cfg(test)] pub(crate)` helpers, the way `range::tests::open_range_window` is shared."
    },
    {
      "severity": "should",
      "rule_id": "CP1 / contract premise",
      "file": "src-tauri/src/ai.rs",
      "line": 76,
      "problem": "The doc comment says only 'a prepare holding the state' is skipped because 'no agent runs during one'. Since 8acdd72, `start_agent` also holds `Mutex<AiState>` on a worker for up to ~3 s while `Workspace::start` reaps the old agent and spawns the new one. A reload during a start is skipped (`WouldBlock`), so the new agent stays running with the dead page's Channel until the next start or the exit. The reloaded channel still accepts events, as the comment at `commands.rs:77` says. If this stays, every future lock holder silently widens the 'skipped' set.",
      "fix": "On `WouldBlock`, have a thread wait for the lock and then call `stop_agent`, so the stop is deferred instead of dropped. Otherwise state in the comment (and in AGENTS.md) that a start in flight is skipped too, and why that is acceptable."
    },
    {
      "severity": "should",
      "rule_id": "DR5 / naming",
      "file": "docs/plan.md",
      "line": 140,
      "problem": "Row #108 still records `AiState = Mutex<Ai>` with `Ai = Off | On(Workspace)` and `Ai::workspace()`. The code, following the brief, has `args::Ai = Off | On`, `enum AiState { Off, On(Workspace) }`, `AiState::workspace()`, and spells `Mutex<AiState>` six times. Elsewhere in the shell `*State` names the managed Mutex alias (`MergeState`, `CompareState`, `HostState`), so a reader following the decision row finds different names and a different meaning of `State`.",
      "fix": "The orchestrator amends #108's names to the built ones (`args::Ai`, `AiState` the enum managed as `Mutex<AiState>`). Alternatively, give the enum its own name with `type AiState = Mutex<…>`, matching `MergeState`."
    },
    {
      "severity": "should",
      "rule_id": "dead weight",
      "file": "src-tauri/src/ai.rs",
      "line": 34,
      "problem": "`pub(crate) fn lock` has no caller outside `ai.rs` (grep `ai::lock`: none), unlike `merge::lock`/`servers::lock`, which other modules use. `compare::lock`, used only in its own module, is private. The wider export invites other modules to take the AI lock and breaks the 'a command locks one' rule documented in AGENTS.md.",
      "fix": "Make it a private `fn lock`, as `compare.rs:17` does."
    },
    {
      "severity": "should",
      "rule_id": "comment accuracy (AGENTS.md)",
      "file": "src-tauri/AGENTS.md",
      "line": 1,
      "problem": "The text still describes `start_agent` only as 'a small thread forwards …' and lists the `Mutex<AiState>` holders as 'a prepare … and the start's sweep'. Since 8acdd72, `start_agent` runs on a `spawn_blocking` worker and holds the lock for up to ~3 s while it reaps the old agent. `discard_checkout` also holds it while it removes the folder. During those holds the sync `send_to_agent`/`stop_agent` wait on the main thread. A maintainer reading the lock rules gets the wrong set of long holders.",
      "fix": "Name `start_agent` as a worker command, and list prepare, start (reap ≤ ~3 s), discard (removal) and the start's sweep as the AI lock's long holders."
    },
    {
      "severity": "should",
      "rule_id": "RS6",
      "file": "src-tauri/src/window.rs",
      "line": 182,
      "problem": "The slice adds about 24 lines (the `ai` plumbing, the `ai_line` match, the new test) and takes `window.rs` to 408 lines, over the 400-line file limit. The file already owns window building, the close watch, the start script, the backgrounds and the title, so the next window flag lands in an over-limit file.",
      "fix": "Move `start_script` and its two tests into a `start_script.rs` (or move `CloseWatch` and its tests into a `close_watch.rs`), so `window.rs` keeps only building and waiting."
    },
    {
      "severity": "should",
      "rule_id": "PM6",
      "file": "docs/architecture.md",
      "line": 445,
      "problem": "The seven new commands (`prepare_checkout` … `diff_texts`), `Mutex<AiState>` as the third range-window Mutex and its state-ownership row, `AiOff`/`RemoveFailed` (IPC4 list), and `yamt-compare`'s `Difference` re-export are named nowhere in `architecture.md`, the `ipc-contract` skill or the project map. `just map-check`'s command loop (map-check.sh:24-28) reports all seven. The design's C4 row included these docs, but the brief's Owned list did not, so no one has updated them.",
      "fix": "The orchestrator adds the seven commands to architecture and the ipc-contract command list, adds a state-ownership row for `Mutex<AiState>` (owner `ai.rs`, written by `manage`/`end_at_exit`; the workspace only through `AiState::workspace()`), and adds the two `IpcError` kinds to IPC4."
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": "src-tauri/src/window.rs",
      "line": 14,
      "problem": "`use crate::args::Ai;` sits in its own group, a blank line apart from the other `crate::` imports. Nothing gets harder.",
      "fix": "Drop the blank line so it joins the `crate::` group."
    }
  ],
  "checked": [
    "PM1: `src-tauri/Cargo.toml` lists `yamt-agent` with session/settings/lsp-host/compare/range/review only. `arch-check.sh:73` allows exactly that set. No `gitio`/`merge-core` edge: `Difference` is reached through `yamt_compare`'s new `pub use yamt_merge_core::Difference` (compare/src/lib.rs:17), and the private `use` dropped it, so the name is defined once.",
    "HostEvent: since 8acdd72 `ai.rs` imports `yamt_agent::HostEvent`, a re-export of `yamt_pipe::HostEvent`, as `lsp-host` re-exports the same type. One specta type, so no duplicate `HostEvent` in the bindings.",
    "One state→error mapping: `IpcError::AiOff` is built only in `AiState::workspace()` (ai.rs:29, grep). Every command reaches the workspace through it. `stop_agent_on_page_start`, `end_at_exit` and the sweep thread match `AiState` themselves but map no error.",
    "`From<yamt_agent::Error>` is exhaustive (Git/Remove/Rename). `PartialClone` comes through the transparent `Git`. Tests are in `ipc_error/tests.rs:269-291`.",
    "Fence 'only the range window gets AI state': `ai::manage` is called only from `range::manage_range_in` (range.rs:57), after every fallible step, for Off and On alike. `compare::manage_store_in` and `with_session` never manage it. The `with_commands` page-load hook uses `try_state`, so the compare window does nothing. The start script's `(Range, On)` arm is the only one that emits `data-ai` (window.rs:183-187), covered by `the_start_script_marks_ai_only_when_on`.",
    "The merge/compare windows still register the AI commands through the shared `specta_builder`. There they would answer tauri's unmanaged-state string (`send_to_agent`/`stop_agent`) or `WorkerStopped` after a `window.state()` panic. This is the same as the existing range/review commands, and those pages never build an agent source (the main.ts fence, #108). Not a finding: #108's rejected alternative concerns a range window without `--ai`, which answers `AiOff` (`every_agent_command_answers_ai_off_without_the_flag`).",
    "Lock order of the three range Mutexes (`threads`, `sending`, `Mutex<AiState>`): `ai.rs` never takes another Mutex. `review.rs` never touches `AiState` (grep). The sweep thread holds `AiState` and only `try_hold`s other pairs' file locks, so no Mutex cycle. `end_at_exit` takes the workspace out with `mem::replace` in a temporary guard, so `Workspace::end` runs with the lock released while `RangeState._lock` (the PairLock) is still held: `at_exit` runs before the app is dropped (window.rs:114-115).",
    "Contract: `Invocation::Range { spec, repo, ai }`, `enum Ai { Off, On }`, `start_script(theme, kind, ai)`, `AiState { Off, On(Workspace) }` and `workspace()`. The seven command signatures match the brief. `start_agent` changed from `State` to `window` and became async in 8acdd72, per the agent crate review's item 7, and is registered as `::<tauri::Wry>` (commands.rs:62). That is accepted drift recorded by the orchestrator.",
    "The `ai` parameter through `open_with_data_folder`/`open_and_wait` (merge and compare pass `Ai::Off`, compare passes `|_| {}` as `at_exit`) follows from the fixed `start_script(theme, kind, ai)` contract. Accepted as the declared deviation.",
    "Deviations accepted: the `crates/compare/src/lib.rs` re-export (Main widened Owned); `with_commands` hosting the AI page-load hook (Tauri keeps one `on_page_load` per builder, documented in AGENTS.md); `sweep_while_held`'s handshake (manage returns once the sweep holds the lock); the usage line for `--ai`. The `forward` copy deviation became finding 1.",
    "Open risks accepted: the untested `Error::Git` → `Git` arm (no gitio dependency possible under PM1); `start_agent`'s main-thread cost (resolved by 8acdd72); the frontend `store.test.ts` typecheck (another slice's).",
    "Decision rows: #108 (the flag never stored, the sweep only with `--ai`, no agent/checkout without it); #110 (sweep through `Workspace::sweep_leftovers(&mut self, range_dir)`); #111 (`end_at_exit` → `Workspace::end` after the window closed, exit 0 unchanged, window.rs:115-119); #114 (`diff_texts` on a worker, `ColumnTooLarge` over 8 MiB). No contradiction beyond the naming in finding 3.",
    "IPC5: each AI command body is at most 7 lines and delegates one `Workspace` call. IPC4: both new error kinds are structured, never strings.",
    "Comments: the `prepare_checkout` comment (ai.rs:103-104) is CP1 with a source (tauri-macros 2.7 wrapper.rs:222), matching range.rs:76. `forward`'s and `manage`'s doc lines state facts the code cannot express. The test comment at window.rs:320 names the guarded bug.",
    "RS6 for `ai.rs`: 346 lines, every function under 40. `commands.rs` (415 lines) was already near 400 before the slice; the slice adds one line per registered command there, so it is not reported.",
    "Mutation survivor `ai.rs:66 sweep_while_held → ()` is the already-found gap (RVAgentCrateR1Check finding 2), so it is not repeated.",
    "I ran nothing: no cargo, no map-check. Every finding comes from reading files."
  ]
}
```