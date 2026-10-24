```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "file": "scripts/fake-glab/glab",
      "line": 1,
      "rule_id": "PM6",
      "problem": "This patch adds a new miss to `just map-check`, and the implementer's note says it adds none. `git ls-files 'scripts/*'` lists subfolders too: the map lists the `scripts/demo/{base,main,feature}/` files for that reason. The basename `glab` appears nowhere in skill://project-map, so `scripts/fake-glab/glab` is reported. The written descriptions also no longer match the code. The map's gitio line and `crates/gitio/AGENTS.md` (\"Git subprocess layer only\") say gitio runs only git, while lib.rs `//!` now says it runs glab too. Nothing describes `tests/glab/`. Row 16 and W3b's `--glab` will have to find the fake, its scenario folder and `Glab` from the code alone.",
      "fix": "In the D0 lane (outside this brief's Owned globs, so for the orchestrator): add a map line for `scripts/fake-glab/glab` and `tests/glab/<scenario>/` (README, the runner scenario). Extend the gitio entry with `glab.rs` (`Glab`, `GlabRun`, `GLAB_TIMEOUT`, `GlabIo`), `program_in`, and names.rs `symbolic_full_name`/`remote_names`. Also update `crates/gitio/AGENTS.md`'s first line and architecture §3.2, as ThreadsDesign D0 lists."
    },
    {
      "severity": "should",
      "file": "crates/gitio/src/glab.rs",
      "line": 5,
      "rule_id": "RS12",
      "problem": "glab.rs imports `crate::repo::program_in`, and the shared PATH lookup (`program_in` plus `is_runnable`, repo.rs:243-262) stays inside the `Repo` module. A reader of glab.rs who asks where its lookup lives has to search repo.rs among the Repo methods. Any later program would gain the same edge into repo.rs for something that has nothing to do with a repository.",
      "fix": "Move `program_in`, `is_runnable` and their four unit tests into `crates/gitio/src/program.rs` (the name lsp-host uses for its lookup), and import it from both repo.rs (`find_git_on_path`) and glab.rs. run.rs stays under 400 lines, which was the deviation's reason, and repo.rs keeps only `Repo`."
    },
    {
      "severity": "nit",
      "file": "scripts/fake-glab/glab",
      "line": 11,
      "rule_id": null,
      "problem": "The fake is indented with tabs, while every other file under scripts/ uses 4 spaces. That makes two indent conventions in one folder; nothing else gets harder.",
      "fix": "Re-indent the fake with 4 spaces."
    },
    {
      "severity": "nit",
      "file": "scripts/fake-glab/glab",
      "line": 45,
      "rule_id": null,
      "problem": "Top-level statements sit between function definitions: the scenario check and the three log lines at 30-36, and the globals `include`/`method`/`input`/`endpoint` at 45-48 that `api` writes and `answer` reads. A reader has to piece together what runs, and in what order, from three places. Nothing else gets harder.",
      "fix": "Move lines 30-36 and 45-48 just above the final `case`, so the file reads as the functions followed by the run."
    }
  ],
  "checked": [
    "One deadline runner. Git (`run_accepting`, run.rs) and glab (`Glab::run`) both go through `run_with_deadline`, which returns `io::Result<Waited>`. Each caller maps the outcome its own way: `Error::Timeout`/`GitFailed` for git, `GlabRun::TimedOut`/`Failed` for glab. `run_to_end` (no deadline: Abort/Continue) is the existing second runner and was not touched. No copy of the spawn/wait/collect code was added.",
    "One PATH lookup. `program_in(search_path, name)` replaces `git_in`. `find_git_on_path` and `Glab::find` are its only callers. `EXE_SUFFIX` matches the old `GIT_FILE_NAME` on unix and Windows. lsp-host's own lookup (program.rs) is a separate crate that may not depend on gitio (PM1), so it is not a second copy inside gitio.",
    "PM1. No Cargo.toml change. gitio gained no `serde_json` and no dependency on merge-core. glab.rs treats stdout/stderr as plain bytes and never parses JSON. The only parsing of glab's text is the fake's `sed` over its own scenario body, which is test tooling.",
    "Contract (fixed) unchanged. `Glab`, `GlabRun::{Printed, Failed, TimedOut}`, `GLAB_TIMEOUT` = 20 s, `find`/`at`/`run(cwd, args, stdin)`, `Repo::symbolic_full_name -> Result<Option<Vec<u8>>>`, `remote_names -> Result<Vec<Vec<u8>>>`, all re-exported from lib.rs. The additions are accepted: `with_timeout` (the brief allows a test deadline, and row 16 is the second user), `GlabRun: Debug, PartialEq, Eq`, and `Error::GlabIo { program, source }`. No downstream crate matches gitio's `Error` exhaustively: range/open.rs and session/operation.rs only use `if let GitFailed`.",
    "Plan §2 #118. The glab run gets the user's environment (no `env_clear`) plus `NO_COLOR=1`/`GIT_TERMINAL_PROMPT=0`, cwd = the folder passed in, and stdin `Stdio::null` unless a body is given. argv is logged at debug as `running glab`, next to git's `running git`. #119: `symbolic_full_name` uses `rev-parse --symbolic-full-name`; stripping the remote is left to row 16, as the design says.",
    "names.rs is the right home for the two reads: the module already holds the ref/branch name reads. `non_empty_lines` now has two users (`refs_pointing_at`'s list and `remote_names`), so extracting it is justified.",
    "RS1 (owned return types, borrowed parameters, no lifetimes), RS4 (`program_in` uses 3 adapters), RS6 (glab.rs 84 lines, `run_with_deadline` and `Glab::run` well under 40; run.rs at 392 is why `program_in` was not moved there, deviation accepted), RS7 (`GlabIo` is named by its cause, lowercase message), RS8 (no unwrap outside tests), RS13 (`GLAB`/`GIT` constants; env pairs written inline as `git_command` does).",
    "Comments (CP1/CP2). `GLAB_TIMEOUT` cites #118. The `run_with_deadline` doc states the exit-0 write rule and why. The `symbolic_full_name` doc gives the `--verify` refusal. The fake's header names its job, its variables, the measured glab 1.124.0 behaviour, and points to the README (CP4). No narrating comments, no TODOs.",
    "The fake's place and layout follow ThreadsDesign R1 and §8: `scripts/fake-glab/` holds only `glab`, so W3b can put that folder first on PATH. Scenarios are in `tests/glab/runner/`, and `tests/glab/README.md` documents the variables, the files, the log format and the measured outputs. The extra `post-<n>.status`, and `.err`'s two roles (with or without `.exit`), are documented there.",
    "`tests/glab/README.md` is outside `tests/glab/runner/**` but the brief asks for it, so the deviation is accepted. The `.omp/run/notes/RVGlab.md` commit follows the earlier slices' patches.",
    "The fake's second user (app sessions, ThreadsDesign:487) per the design sets only `PATH` and `YAMT_FAKE_GLAB`. The README says `YAMT_FAKE_GLAB_STATE` is required for posts, so W3b's `--glab` must also set it. That is W3b's scope, not this patch's.",
    "The test harness `Fake` (glab.rs tests) stays local: it has one user today, so not sharing it is correct under vision 5. Row 16 is where it would gain a second user.",
    "Test file layout matches the crate's other integration tests (`#![cfg(test)]` header, conflict-repo helpers, `run_ignored_in_child` for PATH). The `diff.rs` treetag test sits beside the merge-base test, as brief item 5 asks.",
    "Not repeated, already raised in RVGlabCorrect.md: the ETXTBSY flake, environment pinning in a child process, the fake inventing stderr, and `REV_PARSE` declared twice."
  ]
}
```