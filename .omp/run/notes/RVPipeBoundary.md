```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "rule_id": "promote",
      "file": "crates/pipe/tests/lines.rs",
      "line": 196,
      "problem": "The supervisor's lifecycle is now tested twice, and both test programs carry the same machinery. `lines.rs:196-329` copies ten tests from `crates/lsp-host/tests/run.rs:166-272`: the stop grace, ignore-stop kill, idle run, dropped receiver, late burst, orphan drain and stderr close. `line-echo.rs` also copies `lsp-echo.rs`'s `--ignore-stop`, `--late-burst`, `--hold`, `--stderr-closed`, `spawn_copy`, `write_burst` and `is_alive`. Any later change to `STOP_GRACE`, `OUTPUT_DRAIN` or the `Exited` ordering would have to be made in two suites and two echo programs, and the lsp-host copies no longer kill any mutant because the mutants run uses `--test-workspace=false`. The brief forced this split: lsp-host's tests had to stay unchanged, and SP5 asked for the moved lines' mutants to be killed in yamt-pipe.",
      "fix": "Orchestrator, in a follow-up slice: keep the lifecycle tests only in `crates/pipe/tests/lines.rs`. Cut `crates/lsp-host/tests/run.rs` down to what `Host` adds: the project refusals, the program lookup, `stop_all`/`stop_every`, one Content-Length round trip and the 8 KiB stderr cut. Drop `burst`/`orphan`/`close-stderr` from `lsp-echo.rs`."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "crates/pipe/src/frame.rs",
      "line": 106,
      "problem": "The 64 MiB cap is written down in four places outside `MAX_MESSAGE_BYTES`, against vision 2 (one constant per tunable): the literal \"a message of more than 64 MiB\" here, `HUGE_LINE_BYTES = 64 * 1024 * 1024 + 1` (`line-echo.rs:22`), and the expected strings in `frame.rs`'s test and `lines.rs:18`. The surviving mutant `frame.rs:5:37` (`* → +`) shows that nothing ties the log text to the constant: if the cap changes, the window's log line keeps saying 64 MiB. The Content-Length branch (`run.rs:166`) already formats its text from the constant.",
      "fix": "Make `Frame::Dropped` carry a closed reason, e.g. `Dropped(DropReason::TooLong | DropReason::NotUtf8)`, and build the log line in `run.rs` from `MAX_MESSAGE_BYTES / (1024 * 1024)`, so the text stays exactly \"…more than 64 MiB\". Set `HUGE_LINE_BYTES` to `yamt_pipe::MAX_MESSAGE_BYTES + 1`; the bin can use its own crate's library."
    },
    {
      "severity": "should",
      "rule_id": "PM1",
      "file": "src-tauri/src/ai.rs",
      "line": 14,
      "problem": "Drift in the later commit `040cc47`, caused by this patch putting `HostEvent` in yamt-pipe with lsp-host as its only re-exporter. The agent path imports its event type with `use yamt_lsp_host::HostEvent`, because `yamt_agent::Workspace::start(…, Sender<HostEvent>)` exposes the type without re-exporting it, and arch-check forbids `yamt-app → yamt-pipe`. So the AI's IPC events reach the shell through the language-server crate, which the AI never uses, and removing or changing lsp-host would break the AI window. This meets the block bar (data through a layer that does not use it) in `040cc47`'s own review.",
      "fix": "Add `pub use yamt_pipe::HostEvent;` to `crates/agent/src/lib.rs` and import it in `src-tauri/src/ai.rs` as `yamt_agent::HostEvent`."
    },
    {
      "severity": "should",
      "rule_id": "PM1",
      "file": ".omp/skills/project-map/SKILL.md",
      "line": 48,
      "problem": "The written architecture now contradicts the crates, and readers and reviewers take these documents as truth. The project map's lsp-host entry still lists run/frame/program and says \"NO yamt-*\"; PM1 (line 174) and the dependency diagram (line 168) do not mention yamt-pipe; `docs/architecture.md:52`, `:109`, `:997` and `:1208` (the §7 crate list) also say lsp-host depends on no yamt-* crate and frames the messages itself. The implementer could not edit these read-only files and reported the gap.",
      "fix": "Orchestrator: add a `crates/pipe (yamt-pipe)` entry to the map (lib, run, frame with `Framing`, program with `plain_name`, bin line-echo; NO yamt-*, NO tauri, NO serde_json). Change lsp-host to \"yamt-pipe only among yamt-*\" and add the edge `pipe ◄── lsp-host, agent` to the diagram. Mirror the same changes in `architecture.md` §2/§3.5/§7, citing plan §2 #109."
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": "crates/pipe/src/run.rs",
      "line": 41,
      "problem": "`ToServer` keeps the language-server word in a crate whose second user is the agent. A reader of yamt-agent tracing a `send` finds \"Server\" in code that has nothing to do with servers. Nothing gets harder beyond that.",
      "fix": "Rename `ToServer` to `ToProgram`. Leave the window-visible log texts and `HostEvent`'s doc comment as they are: the comment is fixed by `bindings.ts`, and the texts by \"no change for language servers\"."
    }
  ],
  "checked": [
    "PM1 / arch-check: `yamt-pipe`'s normal deps (transitive `cargo tree`) refuse any `yamt-*` other than itself, `tauri*` and `serde_json` (arch-check.sh pipe block). lsp-host allows only `yamt-(lsp-host|pipe)` and keeps its tauri/serde_json ban. The yamt-app list (`yamt-(app|session|settings|lsp-host|compare|range|review|agent)`) correctly leaves out a direct pipe edge. `crates/pipe/Cargo.toml` deps are serde, specta and tracing, with dev tempfile (used by program.rs tests). lsp-host's are yamt-pipe, serde and specta; tracing was dropped and has no remaining use (grep).",
    "No second copy of the move: `crates/lsp-host/src/{run,frame,program}.rs` are gone (glob), and `plain_name` exists only in `crates/pipe/src/program.rs:73`, with `lsp-host/src/files.rs:5` importing it. lsp-host keeps `Host`, `files.rs` and `lsp-echo`, as plan §2 #109 and R-AI8 say.",
    "Contract: `lib.rs` re-exports `Framing`, `MAX_MESSAGE_BYTES`, `find`, `Found`, `ProgramFolders`, `ProgramFound`, `ProgramPlace`, `HostEvent` and `Running` as the brief fixes. `Running::start(program, args, folder, framing, events)`, `send`, `stop`, `is_finished` and `wait` match the brief's signatures. `Found { pub path, pub place }` and `find(...) -> Result<Found, Vec<PathBuf>>` also match. `Framing` derives `Clone, Copy, Debug, PartialEq, Eq`. The added `plain_name` is allowed (\"may add\") and has 2 users.",
    "lsp-host public API is unchanged: `pub use yamt_pipe::{HostEvent, ProgramFolders, ProgramFound, ProgramPlace}`. `Host` calls `yamt_pipe::find` and `Running::start(…, Framing::ContentLength, …)` (lib.rs:92,101). `src-tauri/src/servers.rs:9-12` still imports everything from `yamt_lsp_host`.",
    "Bindings shape: `bindings.ts:251-252,466-475` still read `HostEvent`'s doc comment \"What a running server sends the window…\" and the `ProgramFolders` field docs. The `#[expect(missing_docs, reason = …)]` on `HostEvent`/`ProgramPlace`/`ProgramFound` states an external fact (specta copies doc comments) and is accepted under CP1. The implementer's diff of a fresh export (IDENTICAL) is accepted.",
    "`ProgramFound`/`ProgramPlace` living in yamt-pipe while lsp-host is their only user: fixed by the brief's contract `pub use crate::program::{…ProgramFound, ProgramPlace}`. Accepted, not a finding.",
    "Decision record: plan §2 #109 (one process core, two framings, 64 MiB, a longer line dropped with a log line, lsp-host keeps Host/files/lsp-echo) and #70 (Rust never parses a message) both hold. `read_line_message` only cuts at bytes and checks UTF-8. AgentDesign Point 2 (`Running::start(…, framing, …)`, `bounded_line` capped at `MAX_MESSAGE_BYTES`, the exact drop text) matches frame.rs:95-116.",
    "Framing behaviour vs Change step 2: a trailing `\\r` is removed only when the line was not cut (`Line::without_carriage_return`); empty lines are skipped; over-cap and non-UTF-8 lines become `Dropped` and reading goes on. Content-Length keeps its earlier policy: too large or broken stops the run (`run.rs:164-172`). `log_line` keeps the 8 KiB cap and the lossy text.",
    "A `\\n` inside a `Lines` message is the caller's job (open risk). Accepted: `Framing::Lines`'s doc says \"One message per line\", and #109's window side sends serialized JSON lines.",
    "Comments: `//!` crate lines in both lib.rs files (CP3). The `///` items on pipe's public surface are needed by `#![warn(missing_docs)]`. The `Line`/`bounded_line`/`without_carriage_return` comments state the cut-line reason. `line-echo.rs`'s header lists its commands, like `lsp-echo.rs`. No narration and no TODO.",
    "AGENTS.md files: `crates/pipe/AGENTS.md` names every file, both framings, the thread model and the arch-check bans. `crates/lsp-host/AGENTS.md` says the process core lives in yamt-pipe and every run is `Framing::ContentLength`. Both agree with the code.",
    "Growth check: yamt-pipe has one job (run a program and frame its pipes) plus the lookup moved with it. No new state outside the run's threads; one writer per channel as before; new edges `lsp-host → pipe` (and later `agent → pipe`) match #109.",
    "Ownership: every source file the patch touches is in `crates/pipe/**`, `crates/lsp-host/**` or `scripts/arch-check.sh`. The root `Cargo.toml` lines (`\"crates/pipe\"` member and the `yamt-pipe` workspace dependency) are the orchestrator's lines named in the brief; the commit uses `yamt-pipe.workspace = true`, not the `../pipe` path the notes describe, so the notes' deviation was applied. `Cargo.lock` is cargo's. `.omp/run/notes/RVWindowR1Check.md` (another slice's review) rode along in this commit; it is an orchestrator artifact and does not affect the code.",
    "`#![cfg(test)]` at the top of `tests/lines.rs` follows the house pattern of every crate's integration tests (`agent`, `cli`, `compare`, `gitio` tests).",
    "Mutation survivors are left to the correctness lens, except `frame.rs:5:37`, which supports finding 2.",
    "Read-only review: no test or gate was run."
  ]
}
```