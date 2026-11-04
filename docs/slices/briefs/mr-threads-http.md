# Slice mr-threads-http — one reader of `glab api --include`, in `yamt-gitio`

Feature: whose turn it really is, the whole thread beside the box, answering it, and sized images. Sources:

- Request `docs/slices/request-mr-threads.md`: C8–C10 (a refused write comes back with GitLab's reason).
- Design `docs/slices/briefs/mr-threads-design.md` option A, §1.3 "Reading the HTTP answer", §3.3.
- Proposed plan §2 #181; RK33 (amended).

Runs in wave 1, beside `mr-threads-fixtures`. **Needs first** the orchestrator's shared edit: `crates/gitio/Cargo.toml`
gains `serde_json.workspace = true` (design §3.3). `mr-threads-crate` sends its writes through what this slice adds.

## Target

**Owned:**

- `crates/gitio/src/glab.rs`, `crates/gitio/src/glab/**` (new, if you split the HTTP reader into `glab/http.rs`)
- `crates/gitio/src/lib.rs`
- `crates/gitio/tests/**` (if the crate has integration tests touching `Glab`)
- `crates/review/src/glab_answer.rs`, `crates/review/src/gitlab.rs`, `crates/review/src/send.rs`

**Read-only:** everything else.

- `crates/gitio/Cargo.toml`, `Cargo.lock`: the orchestrator's.
- `crates/review/src/gitlab/**`, other `crates/review/src/*`: use as they are.
- `crates/merge-requests/**`: `mr-threads-crate`'s.
- `docs/**`, `AGENTS.md` files: lines in `deviations_from_brief` (the docs keeper writes `docs/architecture.md` §3.2,
  §3.8).

**Non-goals:** changing `yamt-review`'s outcomes (`Drafted`/`Refused`/`Stop`, plan #118, RK33); any new glab call; any
merge-request code.

## Contract

Fixed; you may add, never change.

```rust
// yamt_gitio (re-exported from lib.rs beside Glab, GlabRun, TIMED_OUT, last_line)

/// What `glab api --include` printed: the HTTP status and the body after the headers, and glab's last stderr line.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HttpAnswer {
    pub status: u16,
    pub body: Vec<u8>,
    /// glab's last non-empty stderr line (`glab: 403 Forbidden (HTTP 403)`), when it printed one.
    pub glab_line: Option<String>,
}

/// How one `glab api --include` call ended.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HttpCall {
    /// GitLab answered (any status).
    Answered(HttpAnswer),
    /// No HTTP answer: glab could not run, timed out, or printed no status line; glab's or gitio's words.
    NotAnswered(String),
}

impl HttpAnswer {
    /// GitLab's words in an error body: its string `message`; a non-string `message` as JSON text; else its string
    /// `error`; else None. (Moved from `yamt-review` `gitlab.rs` `error_message_from`, unchanged in meaning.)
    #[must_use] pub fn gitlab_message(&self) -> Option<String>;
    /// `gitlab_message`, else `glab_line`, else `HTTP <status>`.
    #[must_use] pub fn reason(&self) -> String;
    #[must_use] pub fn is_success(&self) -> bool; // 200..=299
}

/// Pure: what a run of `glab api --include …` came to. `Printed`/`Failed` with a status line on stdout → Answered;
/// `Failed` without → NotAnswered(last stderr line, else "glab printed no HTTP answer"); `TimedOut` →
/// NotAnswered(TIMED_OUT); `Err(reason)` → NotAnswered(reason).
#[must_use]
pub fn http_call(run: std::result::Result<GlabRun, String>) -> HttpCall;

impl Glab {
    /// `glab <args>` with `body` on stdin (None: stdin closed), read as an HTTP answer. `args` must hold `--include`.
    #[must_use]
    pub fn send(&self, cwd: &Path, args: &[&str], body: Option<Vec<u8>>) -> HttpCall;
}
```

- The status-line parse is today's `http_answer_from` (`crates/review/src/glab_answer.rs:55-72`): first line `HTTP/…
  <code>`, body after the first `\r\n\r\n` (none: empty). Moved, not copied: `yamt-review` keeps no parser.
- `yamt-review` `posted(call: HttpCall) -> Outcome` keeps its outcomes exactly: NotAnswered → `Stop(reason)`; 2xx →
  `Drafted(draft_id_from(body))` (or `Stop` on a bad id); 401, 403, 429 → `Stop(answer.reason())`; other 4xx →
  `Refused(answer.reason())`; else `Stop(answer.reason())`. `send.rs:176` calls `posted(glab.send(…))` (or through
  `glab_answer::run` reshaped). `gitlab.rs` `error_message_from` goes; its other users call `gitlab_message` or keep a
  private reader of their own if they parse a body that is not an `HttpAnswer` (say which in `deviations_from_brief`).

## Change

1. `yamt-gitio`: `HttpAnswer`, `HttpCall`, `http_call`, `Glab::send`, re-exports; unit tests moved from
   `glab_answer.rs`'s `mod tests` (the status line, the body, no answer, a notice before glab's line) plus the new ones.
2. `yamt-review`: `posted` on `HttpCall`; delete `HttpAnswer`, `http_answer_from`, `NO_HTTP_ANSWER` (now gitio's) and
   `error_message_from`; its tests assert the same outcomes through `http_call`.

## Acceptance

**Tests**, each named for the bug it catches, at least:

- gitio: `a_status_line_and_body_are_read_after_the_headers`, `an_answer_without_headers_end_has_an_empty_body`,
  `no_status_line_is_not_answered_with_glabs_last_line`, `a_timeout_is_not_answered`,
  `gitlabs_message_then_error_then_glabs_line_then_the_code_is_the_reason`, `a_non_string_message_is_its_json_text`,
  `send_writes_the_body_on_stdin` (a fake program: a script printing `HTTP/2.0 201 Created\r\n\r\n` and its stdin; as
  gitio's existing `Glab` tests run one).
- review: every existing `glab_answer.rs` and `send.rs` test passes with the same `Outcome`s (401/403/429 Stop, other
  4xx Refused, 2xx Drafted, no answer Stop) — RK33's proving tests unchanged.

**Commands:** `cargo fmt --all --check`; `cargo clippy --workspace --all-targets -- -D warnings`; `cargo nextest run -p
yamt-gitio -p yamt-review -p yamt-app` with the hermetic prefix as `just test`; `just mutants HEAD`.

**Smoke:** none beyond the tests (no window change); `cargo nextest run -p yamt-app` covers the range window's draft
posts over the fake glab.

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK33), `skill://verification`, `skill://ipc-contract` (no IPC
change: say so).
