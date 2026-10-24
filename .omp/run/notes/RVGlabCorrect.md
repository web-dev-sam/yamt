```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "crates/gitio/tests/glab.rs",
      "line": 76,
      "rule_id": "SP5",
      "problem": "Each `Fake::new` writes an executable wrapper and runs it straight away. The tests run on parallel threads and fork git all the time (for example `diverged_repo`). A child forked while `fs::write`'s write descriptor is open keeps that descriptor until its own exec, because close-on-exec only acts at exec. The wrapper's execve then fails with ETXTBSY, which surfaces as `GlabIo`. That is what failed the unmutated baseline of `just mutants` in `stdin_reaches_glab_and_stdout_comes_back`, so the slice has no orchestrator mutation evidence. The same failure can hit any of the five `Fake` tests under `just test`. The implementer's open_risk said this window was tiny and had not been seen.",
      "fix": "Never exec a file this test process wrote, as `crates/lsp-host/tests/run.rs` `place_echo` already does. Either make `dir/glab` a symlink to `scripts/fake-glab/glab` and have the fake read its three variables from a `glab.env` beside `$0` when they are unset (write that down in tests/glab/README.md), or run the written wrapper as an argument of `Glab::at(\"/bin/sh\")`. Then rerun `just mutants` and get a clean baseline."
    },
    {
      "severity": "should",
      "file": "crates/gitio/tests/glab.rs",
      "line": 158,
      "rule_id": null,
      "problem": "`glab_runs_in_the_repository_with_no_color_and_stdin_closed` checks what the test process already passes on. It would still pass with `.env(\"NO_COLOR\", \"1\")` or `.env(\"GIT_TERMINAL_PROMPT\", \"0\")` removed whenever the owner's shell or CI already sets them. It would also still pass with stdin inherited instead of `Stdio::null`, because nextest gives tests /dev/null. So this acceptance line is proven only by the environment the test happens to run in, and row 16 relies on these overrides with nothing pinning them.",
      "fix": "Run its body in a child through `run_ignored_in_child`: give it `NO_COLOR=0`, `GIT_TERMINAL_PROMPT=1` and a stdin file holding `leaked`, then assert the exact log (`env: NO_COLOR=1 GIT_TERMINAL_PROMPT=0`, `stdin: ` empty)."
    },
    {
      "severity": "should",
      "file": "scripts/fake-glab/glab",
      "line": 65,
      "rule_id": null,
      "problem": "For an HTTP error whose body has no string `\"message\"` (GitLab's Grape `{\"error\":\"note is missing\"}`, or an object-shaped `message`), the fake makes up `glab: <status words> (HTTP n)`. Nobody measured what real glab prints in that case. Row 16's refusal tests (`a_refused_message_keeps_its_reason…`) can therefore pin text that real glab never prints.",
      "fix": "When the body has no string `message`, have the fake exit 2 with `fake glab: no recorded stderr for this body` unless `post-<n>.err` is present, so every stderr line it prints is either measured or recorded on purpose."
    },
    {
      "severity": "nit",
      "file": "crates/gitio/src/names.rs",
      "line": 8,
      "rule_id": null,
      "problem": "`REV_PARSE` is declared again here even though `repo.rs` already has the same constant. Nothing gets harder as the app grows.",
      "fix": "Make `repo.rs`'s `REV_PARSE` `pub(crate)` and import it in names.rs."
    }
  ],
  "checked": [
    "ETXTBSY cause, worked out by reading (I did not rerun it): `Fake::new` (glab.rs:63-80) writes `dir/glab` with `fs::write` and then `Glab::run` execs it. Rust's O_CLOEXEC closes the descriptor only at the forked child's exec, so a fork from a parallel test in that window holds a write handle. The checked-in fake is never written, so `glab_found_on_path_is_the_one_run` is not exposed. The repo already records the cause and fix at lsp-host/tests/run.rs:375-380 (a symlink).",
    "Deadline: `run_with_deadline` (run.rs) puts one `deadline` over the wait and the pipe collection. On timeout `child.kill()` and `child.wait()` run and the writer thread is left detached. A grandchild holding stdout/stderr gives TimedOut through `receive_output`. RK15's run.rs tests `hanging_git_call_times_out_and_child_is_reaped` and `background_process_holding_stderr_open_times_out` are still in place.",
    "`a_hanging_glab_times_out` would catch a lost deadline: `with_timeout` mutated to keep 20 s means the 5 s sleep ends in Printed and the test fails. It leaves an orphan `sleep 5`, which is harmless.",
    "stdin: None gives `Stdio::null` (spawn_piped). Some(body) is written on a thread and the pipe is closed when the thread drops it. A write failure counts only after exit 0. Every other caller of `run_accepting` passes `None` (merge_config.rs:29, merge_file.rs:53, rerere.rs:37), so the implementer's claim that git's behaviour is unchanged holds. `a_body_glab_left_unread_fails_only_a_run_that_exited_0` is deterministic because 1 MiB is more than the default 64 KiB pipe buffer, and it kills both flips of `&& finished.status.success()`.",
    "Environment pass-through is proven: the child in `glab_on_path_is_found` sets `YAMT_FAKE_GLAB` in its own environment, so an `env_clear` would make the fake exit 2 and the test fail.",
    "`program_in` replacing `git_in`: `EXE_SUFFIX` is \"\" on unix and \".exe\" on Windows, which matches the old `GIT_FILE_NAME` on every supported target. The relative-entry and non-executable tests now go through it, and `only_the_program_named_is_found` kills a lookup that ignores `name`. Keeping it in repo.rs (deviation) is accepted, since `git_in` already lived there.",
    "`symbolic_full_name`: heads, remote-tracking, HEAD on a branch, detached HEAD (`HEAD`), a full id (None) and `remote~1` (None) are all asserted. `main...remote` is a real range (diverged_repo creates `main`, conflict-repo lib.rs:84,173), so the refusal comes from `--verify` and not from an unknown name. An empty name returning GitFailed is accepted as an open_risk that row 16 handles, as the design says (ThreadsDesign:239).",
    "`remote_names`: an empty list, then three remotes in git's sorted order. Mutating `non_empty_lines` to return an empty vec is caught.",
    "`GlabRun` mapping: exit 0 gives Printed even with stderr text (the What's-new notice); anything else gives Failed with `status.code()` (None on a signal). `a_failing_glab_keeps_its_exit_stdout_and_stderr` compares all three byte for byte, so swapping stdout/stderr or a wrong status would be caught.",
    "The fake matches the measured glab 1.124.0 behaviour: no final newline on the body (`$(cat)` plus `printf %s`); with `--include`, a status line, CRLF headers and an empty line; an HTTP error gives exit 1 with `glab: <message> (HTTP n)\\n` on stderr; `auth status` prints only on stderr and exits 1; the method defaults to POST with `--input`, as glab does. The case order sends GET `…/merge_requests/12/draft_notes` to draft-notes.json before `*/merge_requests/*`.",
    "Not raised as a finding: `--paginate` returns the single file. How real glab prints several pages was not measured, and that is row 16's concern, outside this brief's measurement list.",
    "Brief item 5: `a_name_that_is_not_a_commit_is_git_s_failure_with_its_message` (diff.rs:391) gets `GitFailed { status: Some(1) }` with `expected commit type`. The `repo.rs:202` mutant `stderr.is_empty()` → true would turn that into Ok(None), so the survivor is killed.",
    "No survivors to triage: the orchestrator's run stopped at the baseline (RVGlab.survivors.txt). The implementer's own run reports 28 caught and 8 unviable on the changed functions; I accept it as their evidence, not the orchestrator's.",
    "The docs not updated (project map, architecture, gitio AGENTS.md) were all outside Owned; the deviation is accepted and left for the orchestrator.",
    "RK19: the glab tests build their repos with `diverged_repo` (isolated git), and the fake reads no git config."
  ]
}
```