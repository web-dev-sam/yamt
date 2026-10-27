All five Change items from the brief are in. Every Acceptance test passes. `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings` and `cargo test -p yamt-gitio` all came back clean, and cargo-mutants caught every mutant on the changed functions. shellcheck isn't installed, so it was not run.

**summary**
- `yamt-gitio` can now run glab: `Glab::find` / `at` / `with_timeout` / `run` → `GlabRun::{Printed, Failed, TimedOut}`, with `GLAB_TIMEOUT` set to 20 s. stdin is closed unless a body is given (then it is written and closed). The child gets the user's environment plus `NO_COLOR=1` and `GIT_TERMINAL_PROMPT=0`, runs in the folder passed in, and its argv is logged at debug.
- Git and glab share one deadline runner, `run.rs` `run_with_deadline`, and one PATH lookup, `program_in(path, name)`, which replaces `git_in`.
- Two new reads on `Repo`: `symbolic_full_name` (`rev-parse --verify --symbolic-full-name`) and `remote_names` (`git remote`).
- A POSIX-sh fake glab (`scripts/fake-glab/glab`), a `runner` scenario for it, and `tests/glab/README.md` describing the folder layout, the log format and the real glab outputs I measured.
- New test that "exit 1 with a message is a failure": `commit_named("treetag")` returns `GitFailed { status: Some(1), stderr: …expected commit type… }`.

**files_changed**
- `crates/gitio/src/glab.rs` (new), `crates/gitio/src/lib.rs`, `crates/gitio/src/run.rs`, `crates/gitio/src/repo.rs`, `crates/gitio/src/names.rs`
- `crates/gitio/tests/glab.rs` (new), `crates/gitio/tests/diff.rs`
- `scripts/fake-glab/glab` (new, mode 755)
- `tests/glab/runner/{auth-status.out, auth-status.exit, merge-request.json, post-1.json, post-2.status, post-2.json, post-3.exit, post-3.err, post-4.sleep, post-4.json}` (new)
- `tests/glab/README.md` (new)

**tests_added**
- `glab_missing_on_path_is_none`: a child process whose PATH has only an empty folder and a non-executable `glab` gets `None` from `find()`.
- `glab_on_path_is_found`: with the fake's folder first on PATH, `find()` returns the fake, and `auth status` gives exit 1, empty stdout, and stderr equal to `auth-status.out`.
- `stdin_reaches_glab_and_stdout_comes_back`: the POST body appears in the fake's log, and stdout is `post-1.json` without its final newline.
- `a_failing_glab_keeps_its_exit_stdout_and_stderr`: three cases, compared byte for byte:
  - a 400 with `--include` keeps the CRLF headers, the body and `glab: … (HTTP 400)`;
  - a failure before any HTTP answer keeps empty stdout and the scenario's stderr;
  - a GET 404 gives `{"message":"404 Not Found"}` and `glab: 404 Not Found (HTTP 404)`.
- `a_hanging_glab_times_out`: with `with_timeout(300 ms)`, a post that sleeps 5 s gives `TimedOut` in under 5 s.
- `glab_runs_in_the_repository_with_no_color_and_stdin_closed`: the exact log is `cwd` = the canonical repo root, `NO_COLOR=1 GIT_TERMINAL_PROMPT=0`, and `stdin: ` empty; the run doesn't hang even though the fake reads stdin.
- `a_body_glab_left_unread_fails_only_a_run_that_exited_0`: a 1 MiB body that glab never reads is a `GlabIo` error after exit 0, but stays `Failed` after exit 1.
- `a_glab_that_cannot_start_is_an_i_o_error_naming_it`: `GlabIo { program }` names the missing path.
- `branch_names_from_heads_and_remote_tracking_and_none_for_a_commit_id`:
  - `refs/heads/remote`, `refs/remotes/origin/feature`, and `HEAD` → `refs/heads/local`;
  - a full commit id and `remote~1` give `None`;
  - `main...remote` is `GitFailed`;
  - a detached `HEAD` gives `HEAD`.
- `remote_names_lists_every_remote`: no remotes gives `[]`; after adding `upstream`, `origin`, `fork` the list is `fork`, `origin`, `upstream`.
- `a_name_that_is_not_a_commit_is_git_s_failure_with_its_message` (in `diff.rs`): pins the survivor at `repo.rs:202`.
- `only_the_program_named_is_found` (unit test in `repo.rs`). The existing `git_in` unit tests now go through `program_in(…, "git")`.

**smoke_evidence**
- `cargo test -p yamt-gitio --test glab --test diff`:
  - `tests/glab.rs`: `test result: ok. 10 passed; 0 failed; 2 ignored` (the two ignored ones are the child halves, run by their parents);
  - `tests/diff.rs`: `test a_name_that_is_not_a_commit_is_git_s_failure_with_its_message ... ok`, `test result: ok. 12 passed`.
- `cargo test -p yamt-gitio`: every binary ok (unit 36, abort_continue 5, diff 12, edit_stop 6, glab 10, merge_heads 12, operations 26, repo 19, rerere 4, what_git_wrote 10).
- `cargo fmt --check` → ok. `cargo clippy --workspace --all-targets -- -D warnings` → `Finished`, no warnings.
- `sh -n scripts/fake-glab/glab` → ok. `shellcheck`: not installed.
- `cargo mutants -p yamt-gitio` on the changed functions → `36 mutants tested in 2m: 28 caught, 8 unviable`.
- **Real glab 1.124.0** (`/tmp/glab-probe/bin/glab`, `env -i HOME=/tmp/glabhome XDG_CONFIG_HOME=/tmp/glabhome/cfg`, no token, network reachable):
  - `glab api projects/gitlab-org%2Fcli` → exit 0. stdout is 970 bytes of JSON ending `…"web_url":"https://gitlab.com/groups/gitlab-org"}}`, with no final newline. stderr is empty, except that the first run under a fresh config also printed `What's new in glab v1.124.0 / Run: glab whatsnew` there.
  - `glab api --include projects/gitlab-org%2Fcli` → exit 0. stdout starts `HTTP/2.0 200 OK`, then the headers, each ending `\r\n`, then an empty line and the body. stderr is empty.
  - `glab api projects/gitlab-org%2Fno-such-project-yamt` → exit 1. stdout is `{"message":"404 Project Not Found"}` (35 bytes, no newline). stderr is `glab: 404 Project Not Found (HTTP 404)\n`.
  - `glab api --include …no-such-project-yamt` → exit 1. stdout is `HTTP/2.0 404 Not Found\r\n…X-Runtime: 0.040899\r\n\r\n{"message":"404 Project Not Found"}`. stderr is the same `glab: 404 Project Not Found (HTTP 404)\n`.
  - `glab api --include --method POST projects/34675721/merge_requests/1/draft_notes --input -` → exit 1. stdout is `HTTP/2.0 401 Unauthorized` … `{"message":"401 Unauthorized"}`. stderr is `glab: 401 Unauthorized (HTTP 401)\n`.
  - `glab auth status` → exit 1 with empty stdout. Everything goes to stderr: `gitlab.com`, `x gitlab.com: API call failed: … 401 …`, `✓ …` lines, `! No token found (checked config file, keyring, and environment variables).`, the ERROR box, and `X could not authenticate …`.

**deviations_from_brief**
- **Where `program_in` lives:** in `repo.rs`, not `run.rs`. The brief says `run.rs` holds `git_in`, but it was actually in `repo.rs`; keeping it there also keeps `run.rs` under 400 lines (RS6). It appends `std::env::consts::EXE_SUFFIX`, which gives the same `git` / `git.exe` names as before.
- **Additions to the contract:**
  - `Glab` carries a `timeout` field, and `Glab::with_timeout(self, Duration)` sets it. The hang test needs a short deadline, and row 16's timeout test will too.
  - `GlabRun` derives `Debug, PartialEq, Eq`.
  - New error `Error::GlabIo { program, source }` ("i/o error while running <program>"), so a glab that is gone doesn't read "while running git". No crate matches on gitio's `Error` exhaustively.
- **Shared runner:**
  - `run.rs` now has `run_with_deadline` (returns `io::Result<Waited>`), and `run_accepting` sits on top of it. `Waited::Exited` now wraps `Finished`.
  - The stdin write's own failure now counts only after exit 0. This is the same behaviour as before for every git caller: only `run` passes stdin, and it accepts exactly exit 0.
  - The panic message changed from "git pipe thread panicked" to "pipe thread panicked".
- **Additions to the fake's layout:**
  - `post-<n>.status` gives the HTTP status line (default `201 Created`).
  - `.err` replaces glab's own error line for a status ≥ 400.
  - `.exit` means glab failed before any HTTP answer.
  - The log also records `cwd` and `env` lines.
  - Everything is documented in `tests/glab/README.md`.
- **Outside the Owned globs:** `tests/glab/README.md` is outside `tests/glab/runner/**`, but the brief asks for it.
- **Docs not updated:** the project map, `docs/architecture.md` and `crates/gitio/AGENTS.md` don't mention `glab.rs`, `scripts/fake-glab/glab`, `tests/glab/`, `GlabIo`, or the two new `Repo` reads. They aren't owned, so the orchestrator needs to add these. `map-check` doesn't flag the fake today, but it already fails on unrelated range files.
- **Scenario text not from real glab:** `runner/auth-status.out` is the measured text with trailing spaces dropped. `post-3.err` is the fake's own wording, not real glab output (the README says so).

**open_risks**
- `crates/gitio/tests/glab.rs:67-75`: each test writes and immediately runs a wrapper script. In theory a parallel fork elsewhere in the test binary could cause ETXTBSY. Rust opens files close-on-exec, so the window is tiny, and I didn't observe it.
- glab's update check is on by default, and on first run under a fresh config it printed a one-time "What's new" notice on stderr. Plan #118 fixes the environment, so yamt doesn't add `GLAB_CHECK_UPDATE`. Row 16 should read `Failed` stderr knowing that the notice can be there.
- `crates/gitio/src/names.rs:47-56`: `--verify` turns a range or option-like name into `GitFailed` rather than `None`. It also turns an empty name into `GitFailed`. Row 16 must treat "" as "current branch" itself, as the design says.
- `scripts/fake-glab/glab`: the fake only builds `glab: <message> (HTTP n)` from a string `"message"`. GitLab's object-shaped validation messages need a recorded `.err`, and I never measured how real glab prints those.
- The fake's executable bit must survive the commit, because `glab_on_path_is_found` depends on it.