# Review of `yamt-agent` (`040cc47`): fail, with two blocking findings

The crate does what row #110 asks: the stop-then-remove order is enforced by the types, and its dependencies match `arch-check`. Two findings block it:
1. The public `start` signature uses `HostEvent` without re-exporting it. The shell therefore gets the AI's event type from the language-server crate.
2. The sweep keeps its own copy of `yamt-range`'s pair-folder name format, and no test checks that copy against the real one.

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "PM1",
      "file": "crates/agent/src/lib.rs",
      "line": 18,
      "problem": "Confirmed from RVPipeBoundary finding 3. `Workspace::start(…, events: Sender<HostEvent>)` (workspace.rs:57) puts `yamt_pipe::HostEvent` in this crate's public API, but lib.rs never re-exports it. `arch-check.sh` forbids `yamt-app → yamt-pipe`, so `src-tauri/src/ai.rs:14` has to import it as `yamt_lsp_host::HostEvent`. The AI's events therefore reach the shell through the language-server crate, which the AI never uses. The crate's own test (`tests/process.rs:12`) reaches into `yamt_pipe` directly for the same reason. This is growth harm: data passing through a layer that does not use it.",
      "fix": "Add `pub use yamt_pipe::HostEvent;` to the `pub use` block in `crates/agent/src/lib.rs` (lines 16-18). Import it as `yamt_agent::HostEvent` in `src-tauri/src/ai.rs:14` and in `tests/process.rs:12`."
    },
    {
      "severity": "block",
      "rule_id": null,
      "file": "crates/agent/src/sweep.rs",
      "line": 38,
      "problem": "`right_commit` parses the pair folder name `<left>-<right>` again with `split_once('-')`. That name format belongs to `yamt-range` and is built only in `PairLock::take` (`crates/range/src/lock.rs:24-29`). The tests never use `take`: they build the same string by hand (`tests/checkout.rs:35-38`, `tests/sweep.rs:31-34`). So if `take`'s format changes, every test still passes, while a real sweep reads the wrong commit, sees every leftover as `head_moved` and keeps clean checkouts forever (full working trees on disk). This is a decision copied instead of shared, and nothing tests the copy against its source.",
      "fix": "Keep the format and its parse together in yamt-range. Add, for example, `pub fn pair_right_commit(folder: &Path) -> Option<Oid>` next to `take` (the contract allows additions), built from one `PAIR_SEPARATOR` that `take` also uses, with a range unit test that parses a folder made by `take`. Delete `sweep.rs::right_commit` and call the range function instead."
    },
    {
      "severity": "should",
      "rule_id": "PM1",
      "file": ".omp/skills/project-map/SKILL.md",
      "line": 48,
      "problem": "Plan §2 #110 says the crate \"amends §7, PM1\", but no written architecture names `yamt-agent`. A grep for `yamt-agent|crates/agent` finds nothing in `docs/architecture.md` or the project map, which lacks its tree entry, its diagram edges (`gitio, pipe, range ◄── agent ◄── src-tauri`) and its PM1 rule. `crates/range/AGENTS.md`'s `lock.rs` entry also leaves out `try_hold` and `pair_folders`. Reviewers and later builds take these documents as the truth, so the crate stays invisible to them. The implementer listed this as outside Owned.",
      "fix": "Orchestrator: add a `crates/agent (yamt-agent)` tree entry to the map (lib, workspace, checkout, look, process, sweep, bin agent-echo; depends on gitio, pipe and range only; NO tauri, NO serde_json), the diagram edge and a PM1 clause. Mirror these in `architecture.md` §1/§2/§3/§7, citing #110. Add `try_hold` and `pair_folders` to `crates/range/AGENTS.md`."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "crates/agent/src/sweep.rs",
      "line": 12,
      "problem": "The window's own `checkout.partial`/`checkout.removing` have two writers: `Workspace::prepare` (`checkout.rs:27` `remove_leftovers`) and the free function `sweep_leftovers`' own-pair branch. They do not race only because `src-tauri/src/ai.rs:64-73` holds the `AiState` mutex for the whole sweep; the types do not enforce it. The `own` parameter can also differ from the workspace's `pair.folder`. Every new caller of `sweep_leftovers` has to know this hidden rule. The rest of the checkout's lifetime is ordered by `&mut self`/`self` on `Workspace`.",
      "fix": "Propose a contract revision: make the sweep `Workspace::sweep_leftovers(&mut self, range_dir: &Path)` and take the own pair from `self.pair.folder`. The borrow then orders it against `prepare`, and the behaviour #110 records for the own pair (only partial and removing folders) stays the same."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "crates/agent/src/workspace.rs",
      "line": 56,
      "problem": "`start` can block for about 3 s (`stop_and_reap`: 2 s grace, kill, drain; implementer open risk 3), but its doc says nothing about blocking, while `prepare`'s doc does. Its caller `src-tauri/src/ai.rs:117` `start_agent` is a sync Tauri command. Under Tauri 2 a sync command runs on the main thread, so restarting an agent that ignores stdin closing would freeze the window [INFERENCE: not observed]. As more callers appear, each has to find this out from the code.",
      "fix": "Say in `start`'s doc that it blocks until an earlier agent is reaped (up to about 3 s). Route to C4: make `start_agent` async through `blocking_reply`, as `prepare_checkout` and `discard_checkout` already are."
    },
    {
      "severity": "should",
      "rule_id": "promote",
      "file": "crates/agent/src/bin/agent-echo.rs",
      "line": 12,
      "problem": "No yamt-agent test uses `huge` or `stderr` (grep of `tests/`; the six surviving mutants on line 12 confirm it for `huge`). `HUGE_LINE_BYTES = 64 * 1024 * 1024 + 1` is a third literal copy of `yamt_pipe::MAX_MESSAGE_BYTES` (RVPipeBoundary finding 2 named the same copy in `line-echo.rs:22`). If the cap changes, these copies have to be found by hand, and they are dead weight in a test program that pipe's `line-echo` already covers.",
      "fix": "Orchestrator: allow dropping `huge` and `stderr` from agent-echo (the brief's Change named them), since pipe's `tests/lines.rs` already tests framing. If they stay, write `yamt_pipe::MAX_MESSAGE_BYTES + 1` and add a test that uses each."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "crates/agent/tests/process.rs",
      "line": 34,
      "problem": "Three fixtures are near-copies of each other: `Fixture::new` (`tests/checkout.rs:20-50`), `unprepared` (`tests/process.rs:34-63`) and `Leftover::new` (`tests/sweep.rs:19-51`). Each builds the same `diverged_repo` with the same `a.txt`, a range folder, a `source-0123456789abcdef` repo key and a pair folder, and `commit_of` is copied as well. A change to `Pair` (for example an `Oid` brand for `new_commit`) or to the pair layout needs three edits.",
      "fix": "Move one pair fixture (source, range folder, pair folder, `Pair`, `commit_of`) into `crates/agent/tests/common/mod.rs` and use it from all three test files."
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": "crates/agent/src/look.rs",
      "line": 19,
      "problem": "The checkout's location `pair_folder.join(CHECKOUT)` is computed in three places (`look.rs:19`, `checkout.rs:23`, `checkout.rs:54`), and `look.rs` and `checkout.rs` import each other. A reader tracing where the checkout lives has to check all three.",
      "fix": "Add `pub(crate) fn checkout_folder(pair_folder: &Path) -> PathBuf` in `checkout.rs` and call it from all three places."
    }
  ],
  "checked": [
    "Ownership: every source file in the patch is in `crates/agent/**`, `crates/range/src/{lock,lib}.rs`, `src-tauri/Cargo.toml` or `scripts/arch-check.sh`. The root `Cargo.toml` (`crates/agent` member, `yamt-agent` workspace dependency) and `src-tauri/Cargo.toml:33` `yamt-agent.workspace = true` show that the orchestrator applied the notes' first deviation (the notes still describe a path dependency). `Cargo.lock` is cargo's file. The `.omp/run/notes/RVAgentCrate.md` in the commit is an orchestrator artifact.",
    "PM1 / arch-check: the agent rule bans transitive `yamt-*` other than agent, gitio, pipe, range and merge-core (merge-core is allowed because range uses it), plus `tauri*` and `serde_json`. gitio (thiserror, tracing), range (gitio, merge-core, serde, specta, thiserror) and pipe (serde, specta, tracing) bring in none of the banned crates. The yamt-app list gained `agent` and still leaves out `pipe`. `crates/agent/Cargo.toml`'s normal deps (gitio, pipe, range, serde, specta, thiserror, tracing) are all used. Dev-dependencies `yamt-conflict-repo` and `tempfile` are used in all three test files.",
    "Contract: `AgentRun(pub u32)`, `AgentCommand { program, args, home_folders }`, `AgentStartReply`, `CheckoutReply`, `CheckoutLook` (serde tag `kind`, variant names PascalCase as the brief says), `Pair`, the `Workspace` fields and the nine methods, `LookJob::look(self)`, `sweep_leftovers(range_dir, own)`, `Error::{Git, Remove}` all match the brief. `Error::Rename` is an allowed addition and is used at `checkout.rs:35`. `pair_folders` and `PairLock::try_hold` match their signatures.",
    "`PairLock::take` refactor (deviation 4) accepted: both open and lock failures still go through `lock_failed(&path, …)`, and `WouldBlock` still becomes `Error::Locked`. Behaviour is the same, and it removes a second open-and-lock path.",
    "Checkout lifetime by construction (#110): `discard(&mut self)` and `end(self)` both call `stop_and_reap` (`agent.take()`, `stop`, `wait(self)`, which joins the supervisor) before `checkout::remove` / `remove_when_clean`. `start` returns `NoCheckout` while `checkout` is `None`, and `discard` resets it. `end` and the sweep share one rule, `remove_when_clean`, so a changed or unreadable checkout is never removed by either.",
    "`look_job` reading `<pair>/checkout` before `prepare` (deviation) accepted: it matches AgentDesign §4 (a kept own-pair checkout is judged again at close) and #111.",
    "Extra `Unreadable` case (`look.rs` `own_repo`: git finding an outer repository) accepted under #110 \"a checkout git cannot read is never removed unasked\". Its comment states the git fact it depends on (CP1).",
    "`prepare` also removing `checkout.removing` (deviation) accepted: #110 says both kinds of leftover are safe to delete.",
    "Decision record: #110 (shared clone, `remote remove origin`, `checkout --detach`, `.partial` → rename, `.removing`, changed = a status entry or `HEAD` ≠ right, the sweep only under a lock it takes), #111 (at exit: stop, look again, remove only a clean checkout), #115 (ignored-only counts as clean), #109 (`Framing::Lines`, Rust never parses ACP, PATH then home folders, no project entries: `process.rs` `ProgramFolders { project: [] }`). No contradiction found.",
    "Growth check: `Workspace` has one job (the checkout plus the agent in it). Each file has one job: checkout = make/remove, look = status, process = lookup/start, sweep = other pairs. New state is the checkout folder and the agent run, both written only through `Workspace`, apart from the own-pair leftovers in finding 4. New edges `agent → gitio, pipe, range` and `app → agent` match #109, #110 and the design's C3b row.",
    "Comments: `//!` crate line (CP3), the `///` on public items, the cited fact on `CHECKOUT` (#110), the `own_repo` git fact (CP1) and the `agent-echo.rs` header listing its commands (as `line-echo.rs` does). No narration, TODO or history. `crates/agent/AGENTS.md` matches every file and rule in the code.",
    "Naming: `Pair.new_commit` against the docs' \"right commit\" is fixed by the brief's contract (it matches #113's `NEW_COMMIT`), so it is not a finding.",
    "Mutation survivors: the `checkout.rs:58`/`:87` NotFound guards are left to the correctness lens. The `agent-echo.rs:12` survivors support finding 6.",
    "Read-only review: I ran no test and no gate."
  ]
}
```