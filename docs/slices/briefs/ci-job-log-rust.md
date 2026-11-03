# Slice ci-job-log-rust — a failed job's log, offered pages only, GitLab's 500 KB tail, kept for the run

Feature: CI job log (request `docs/slices/request-ci-job-log.md` rules 8–9 and the Rust acceptance; design
`docs/slices/briefs/ci-job-log-design.md` option A, §1.1–1.3, §2.1; proposed plan §2 #158; RK41, RK53, proposed RK57).
Runs beside `ci-job-log-core`. After it lands the orchestrator runs `just bindings`.

## Target

Owned: `crates/merge-requests/**`; `src-tauri/src/merge_requests.rs`, `src-tauri/src/merge_requests/**`;
`src-tauri/src/commands.rs` (the command list only); `scripts/fake-glab/glab`; `tests/glab/ci-job-log/**` (new);
`tests/glab/README.md`; `scripts/gitlab-playground.sh`.

Read-only: everything else — `frontend/**` (the generated `frontend/src/ipc/bindings.ts` is the orchestrator's `just
bindings`, PM4), `crates/gitio/**` (`Glab::get` as it is: whole stdout, `Err` = glab's last stderr line,
`glab.rs:101-104,131-139`), every `Cargo.toml` (no new dependency), other scenarios under `tests/glab/`,
`src-tauri/tauri.conf.json` (no CSP change), `docs/**` (the docs keeper's: put the lines in `deviations_from_brief`).

Non-goals: logs of running, pending or passed jobs; following a running log; retrying; artifacts (request non-goals);
a `Range` header or `byte_offset`/`byte_limit` (design §1.3); a streaming reader in `gitio`; keeping failures; a
GraphQL `id` in the list query; the window's code.

## Contract

Fixed (add-only beyond this). In `yamt-merge-requests`, new module `job_log.rs`, re-exported from `lib.rs`
(`pub use job_log::{JobLog, JobLogReply, MAX_LOG_BYTES, read_job_log};`); IPC types `Clone, Debug, PartialEq, Eq,
Serialize, Type` with `#[serde(rename_all = "camelCase")]`, documented as their neighbours are:

```rust
/// The most of a log the window shows: GitLab's job page shows the same tail (`Gitlab::Ci::Trace::Stream::LIMIT_SIZE`,
/// 500 KiB).
pub const MAX_LOG_BYTES: usize = 500 * 1024;

/// A failed job's log as the window shows it.
pub struct JobLog {
    /// The log as GitLab stores it, colour codes and all; bytes that are not UTF-8 read as U+FFFD.
    pub text: String,
    /// Whether earlier lines were left out: the log was longer than `MAX_LOG_BYTES`.
    pub cut: bool,
}

/// How asking for a failed job's log ended.
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum JobLogReply {
    /// GitLab's log of the job.
    Log { log: JobLog },
    /// This window's list never offered that job page (or the page is no job's), so nothing was asked.
    NotOffered,
    /// GitLab has no log for the job: an empty answer or HTTP 404.
    NoLog,
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn { /** glab's first line, which names the instance. */ detail: String },
    /// glab failed, timed out or answered something unexpected, in glab's or yamt's words.
    Failed { /** What went wrong. */ message: String },
}

/// `page`'s log, read through glab in the repository's root: no glab → `GlabMissing`; not a `…/-/jobs/<digits>` page
/// → `NotOffered` (before any glab run); `logged_in_project` → `NotLoggedIn`/`Failed`; `glab api <trace_route>`
/// (`Glab::get`): `Ok` empty → `NoLog`, `Ok(bytes)` → `Log { tail(bytes) }`, `Err(line)` ending in "(HTTP 404)" →
/// `NoLog`, any other `Err` → `Failed { message: line }`. One `tracing::info!` per call naming the page, the outcome's
/// kind, the bytes read and `cut` — never the log's text.
pub fn read_job_log(repository: &GitLabRepository, glab: Option<&Glab>, page: &WebPage) -> JobLogReply;

/// GitLab's `Stream#limit`: at most `MAX_LOG_BYTES` → the whole log, `cut: false`; more → from just after the first
/// `\n` at or after `len − MAX_LOG_BYTES` to the end (the line the cut lands in is dropped even when the cut lands on
/// a line start; no `\n` there → empty text), `cut: true`. Then `String::from_utf8_lossy`.
pub(crate) fn tail(bytes: &[u8]) -> JobLog;

/// `projects/<the job's project path with "/" as "%2F">/jobs/<n>/trace` for the page `<origin><path>/-/jobs/<n>`:
/// `<path>` without the sub-path GitLab is installed under (`project.web_path` minus `/<project.full_path>`) when it
/// starts with it, then without its leading `/`. `None` when `page` is no job page or its origin is not
/// `project.web_origin`. A fork's pipeline names the fork (design §1.1).
pub(crate) fn trace_route(project: &Project, page: &WebPage) -> Option<String>;
```

`src-tauri` (`merge_requests.rs`, new `merge_requests/job_logs.rs`):

```rust
/// The run's logs: the latest `Log` per page; a failure is never kept, so the next ask reads GitLab again.
#[derive(Default)]
pub(super) struct JobLogs(Mutex<BTreeMap<WebPage, JobLog>>);   // MergeRequestState gains `job_logs: JobLogs`

/// Not in `pages` → `NotOffered` (a `tracing::warn!` naming the page, as `open_page`) without glab; a kept log →
/// `Log` without glab; no GitLab project → `Failed { NO_PROJECT }`; else `read_job_log`, and a `Log` is kept. Never
/// holds `job_logs` while glab runs, never together with `pages`.
pub(super) fn job_log_reply(state: &MergeRequestState, glab: Option<&Glab>, page: &WebPage) -> JobLogReply;

#[tauri::command]
#[specta::specta]
pub(crate) async fn read_job_log<R: Runtime>(window: WebviewWindow<R>, page: WebPage)
    -> Result<JobLogReply, IpcError>;   // blocking_reply(move || Ok(job_log_reply(&window.state(), Glab::find().as_ref(), &page))), as rerequest_review
```

Registered in `commands.rs` `collect_commands!` beside `merge_requests::rerequest_review::<tauri::Wry>`. The window
calls it `commands.readJobLog(page)`.

**Fake glab** (`scripts/fake-glab/glab`): a route `"GET projects/"*"/jobs/"*"/trace"` (before the default) → a
`trace` function: `n` = the endpoint's segment between `/jobs/` and `/trace`; after `$scenario/traces/<n>.log.sleep`
seconds (when present) it logs `answered: <endpoint>`, then prints `$scenario/traces/<n>.log` with `cat` (bytes as
they are, an empty file prints nothing), exit 0; no such file → `answer '404 Not Found' '{"message":"404 Not
Found"}'`. Every other route unchanged. `tests/glab/README.md`: the two new rows (`traces/<n>.log`, `.sleep`) and the
scenario.

**Scenario `tests/glab/ci-job-log/`** (`.gitattributes` keeps every byte, `* -text`): logged in;
`merge-requests/`'s project (`taskboard/taskboard` on `https://gitlab.example`); user `sam`; one list page, the last,
with every field today's list query reads (copy the shape of `mr-row-details/graphql-page-1.json`); no `diffHeadSha`
(the local check runs no git):

- !71 failed pipeline: `phpunit` (`/taskboard/taskboard/-/jobs/302`), `lint` allowed to fail (`…/303`), `e2e`
  (`…/304`), `docs` (`…/305`), and a trigger job `deploy` with `webPath: null`.
- !70 failed pipeline: `phpunit` (`…/312`) — the same job name on another merge request.
- !69 from a fork (`sourceProjectId` 2): `phpunit` at `/sam/taskboard/-/jobs/310`.
- `traces/302.log`: a short realistic runner log with the timestamp prefix on every line (`2026-11-03T09:00:00.123456Z
  00O ` shape, design §1.2) and one `+` continuation line; `\e[0K` before section markers
  `\e[0Ksection_start:<ts>:prepare_script[collapsed=true]\r\e[0K` + a header and the matching `section_end`; a
  progress line rewritten with lone `\r`s; `\e[32;1m`, `\e[1;31m`, `\e[3m`, `\e[4m`, `\e[38;5;208m`, `\e[41m`,
  `\e[0;m`, `\e[38;2;255;0;0m`; a line holding `<b>not bold</b> & <script>x</script>`; ending with a PHPUnit-like
  failure (`FAILURES!`, `Tests: 12, Assertions: 30, Failures: 2.`).
- `traces/303.log`: more than 512,000 bytes (about 520 KB of numbered lines, colour codes on some), its first line
  distinct so a test sees it gone, ending in a failure line.
- `traces/305.log`: empty. No `304.log` (→ 404). `traces/310.log`: a short fork log. `traces/312.log`: a short
  coloured log with "fail" in it.

**Playground** (`scripts/gitlab-playground.sh`): a sixth branch `feature/failing-ci` from `main` whose one commit (fixed
author and date, as the script's other commits) adds `.gitlab-ci.yml` with two jobs that fail: `phpunit` (a
collapsed section via `printf '\e[0Ksection_start:%d:%s[collapsed=true]\r\e[0K%s\n'`, a `\r` progress line, bold
red, italic, underline, a 256-colour word, a red background, `exit 1`) and `long-log` (about 600 KB of numbered
coloured lines, `exit 1`); merge request "Failing CI". Header comment and `--reset` updated. This slice never runs it
against GitLab (the owner does).

## Change

1. Measure first, read-only, with the logged-in glab in `../glab-yamt-playground` (as `briefs/mr-diff-stats.md`
   did): `glab api "projects/gitlab-org%2Fcli/jobs?scope[]=failed&per_page=1"` → one failed job's `id` and
   `web_url` (check `web_url` ends in `/-/jobs/<id>`); `glab api projects/gitlab-org%2Fcli/jobs/<id>/trace | head -c 400
   | od -c | head -40` (paste: the timestamp prefix or its absence, `section_start`, `\033[`); `time glab api
   projects/gitlab-org%2Fcli/jobs/<id>/trace | wc -c`; the same with `-H 'Range: bytes=-1000'` piped to `wc -c` (a
   whole size confirms design §1.3). Write nothing to GitLab.
2. `job_log.rs`: the types, `read_job_log`, `tail`, `trace_route`; unit tests.
3. `lib.rs` re-exports; `web_page.rs` may gain a crate-only accessor for a job page's parts (one place parses
   `/-/jobs/<n>`: `WebPage::job` and `trace_route` share it).
4. `tests/job_log.rs` with the fake glab (`tests/fake_glab/mod.rs` as `rerequest.rs` uses it).
5. `src-tauri`: `merge_requests/job_logs.rs` (`JobLogs`, `job_log_reply`), the field in `MergeRequestState` and
   `manage`, the command; `commands.rs`; `merge_requests/tests/job_log.rs`.
6. Fake glab route, the scenario, `README.md`; the playground branch; the crate's `AGENTS.md` (the log: route, cut,
   no keeping in the crate).

## Acceptance

- Tests (`cargo nextest run -p yamt-merge-requests` with the hermetic prefix as `just test`, and `-p yamt-app
  merge_requests`), each named for the bug it catches, at least:
  - `job_log.rs`: `a_log_of_exactly_500_kib_is_whole`, `a_longer_log_keeps_its_tail_from_the_next_line_start`,
    `a_cut_drops_the_line_it_lands_in_even_a_whole_one`, `a_cut_tail_without_a_line_break_is_empty_and_cut`,
    `bytes_that_are_not_utf8_read_as_replacement_characters`, `the_trace_route_names_the_jobs_own_project` (same
    project, a fork, a GitLab under `/gitlab`, a page without the sub-path, a merge-request page → `None`, another
    origin → `None`), `a_404_is_no_log_and_other_failures_keep_glabs_words`.
  - `tests/job_log.rs` (scenario `ci-job-log`): `an_offered_jobs_log_comes_byte_for_byte_with_its_colour_codes` (302:
    `text` equal to the file, `cut` false), `a_log_over_500_kib_is_cut_at_a_line_start_and_flagged` (303: ends equal,
    starts after a `\n`, ≤ 512,000 bytes, `cut` true), `a_jobs_log_is_asked_by_its_own_projects_path` (310: the fake
    log's `argv:` names `projects/sam%2Ftaskboard/jobs/310/trace`), `a_missing_trace_is_no_log` (304),
    `an_empty_trace_is_no_log` (305), `glab_missing_is_glab_missing`, `logged_out_is_not_logged_in` (scenario
    `logged-out`), `a_merge_request_page_is_not_a_job_and_runs_no_glab` (no `argv:` line).
  - `src-tauri` `merge_requests/tests/job_log.rs`: `a_job_no_list_offered_gets_no_log_and_runs_no_glab` (RK57),
    `a_second_request_for_the_same_job_runs_no_glab` (after a list: two asks, one `…/trace` call and no second
    `auth status` in the fake log), `a_failure_is_not_kept_and_the_next_request_asks_again` (304 twice → two calls),
    `read_job_log_replies_on_paths_glab` (as the re-request's `through_glab` test).
- `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all --check`, `just arch-check`: summary lines.
- Step 1 pasted (job id = web_url number, the head bytes, the size and time, the `Range` result).
- `bash -n scripts/gitlab-playground.sh` and `sh -n scripts/fake-glab/glab`: no output.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK41, RK53; proposed RK57),
`skill://verification`.
