# MrThreadsHttp

Agent output (`agent://MrThreadsHttp`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsHttp.md), collected 2026-11-04T11:54:02.067Z.

{
  "summary": "yamt-gitio now has the one reader of `glab api --include` output, in `glab/http.rs`: `HttpAnswer` (gitlab_message, reason, is_success), `HttpCall`, `http_call` and `Glab::send`, all re-exported from lib.rs. yamt-review's `posted` takes an `HttpCall` and gives the same `Outcome`s as before. `HttpAnswer`, `http_answer_from`, `NO_HTTP_ANSWER` and `error_message_from` are deleted from yamt-review, which no longer has a parser of its own. send.rs posts through `glab_answer::sent`.",
  "files_changed": [
    "crates/gitio/src/glab/http.rs",
    "crates/gitio/src/glab.rs",
    "crates/gitio/src/lib.rs",
    "crates/gitio/tests/glab.rs",
    "crates/review/src/glab_answer.rs",
    "crates/review/src/gitlab.rs",
    "crates/review/src/send.rs"
  ],
  "tests_added": [
    {
      "name": "gitio glab::http::tests::a_status_line_and_body_are_read_after_the_headers",
      "proves": "the status comes from the first line and the body starts after the first CRLFCRLF (a later CRLFCRLF stays in the body); glab's last stderr line is kept after a notice"
    },
    {
      "name": "gitio glab::http::tests::an_answer_without_headers_end_has_an_empty_body",
      "proves": "a status line with no end of headers is Answered with an empty body"
    },
    {
      "name": "gitio glab::http::tests::no_status_line_is_not_answered_with_glabs_last_line",
      "proves": "no `HTTP/` status line, a missing or non-numeric code, or non-UTF-8 → NotAnswered(glab's last line, else 'glab printed no HTTP answer')"
    },
    {
      "name": "gitio glab::http::tests::a_timeout_is_not_answered",
      "proves": "TimedOut → NotAnswered(TIMED_OUT); Err(reason) → NotAnswered(reason)"
    },
    {
      "name": "gitio glab::http::tests::gitlabs_message_then_error_then_glabs_line_then_the_code_is_the_reason",
      "proves": "reason order: string message, null message falls to error, a non-string error is skipped, then glab_line, then 'HTTP <code>'"
    },
    {
      "name": "gitio glab::http::tests::a_non_string_message_is_its_json_text",
      "proves": "an object message becomes its JSON text"
    },
    {
      "name": "gitio glab::http::tests::only_a_2xx_is_a_success",
      "proves": "is_success holds for 200..=299 only (199, 300 and 404 are not)"
    },
    {
      "name": "gitio::glab send_writes_the_body_on_stdin",
      "proves": "Glab::send with --include on the fake glab returns Answered 201 with post-1.json as the body and no glab_line; the fake's log shows the body arrived on stdin"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "fmt check passed; clippy: `Finished `dev` profile [unoptimized + debuginfo] target(s) in 49.05s`, no warnings (the `&&` chain then went on to nextest)"
    },
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-gitio -p yamt-review -p yamt-app",
      "observed": "Summary [7.614s] 532 tests run: 532 passed, 49 skipped. PASS: all 7 glab::http tests, yamt-gitio::glab send_writes_the_body_on_stdin, review glab_answer::tests::a_refusal_keeps_gitlab_s_words_and_a_failure_of_user_or_server_stops, ::no_http_answer_a_timeout_or_glab_gone_stops_in_glab_s_words, and every yamt-review::review send test (e.g. a_timeout_stops_the_send_and_leaves_the_rest_queued, a_refused_message_keeps_its_reason_and_stays_queued_while_the_others_are_sent)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 25 mutants to test; 25 mutants tested in 75s: 20 caught, 5 unviable; no TypeScript changes",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Review's post wrapper is reshaped from `glab_answer::run` into `glab_answer::sent(glab, root, args: &[String], body: Vec<u8>) -> HttpCall`. It wraps `glab.send(…, Some(body))`, because review's args are `Vec<String>`. send.rs:176 is now `posted(sent(…))`.",
    "`error_message_from` had no other users. Its test `gitlab_s_words_are_its_message_or_its_error` moved into gitio's reason and json-text tests, which cover the same cases.",
    "Review's `glab_answer.rs` tests now go through `http_call` (a `posted_run` helper). The no-answer case asserts the literal 'glab printed no HTTP answer', since gitio keeps `NO_HTTP_ANSWER` private. Added: a 2xx with a bad id is `Stop` (behaviour already in the brief).",
    "Added `only_a_2xx_is_a_success` beyond the listed tests, so `is_success` has a test; nothing in the workspace calls it yet (mr-threads-crate will).",
    "Docs for the docs keeper: tree.md line 32-33 (gitio glab row) should name `glab/http.rs` (`HttpAnswer`, `HttpCall`, `http_call`, `Glab::send`). tree.md line 69 (review glab_answer) is now 'posted: one status match on gitio's HttpCall'. architecture §3.2/§3.8 as the brief says.",
    "No IPC change (ipc-contract): no type crossing IPC was touched and bindings are unaffected."
  ],
  "open_risks": [
    {
      "location": "crates/gitio/src/glab.rs:115-119",
      "risk": "`Glab::send` does not enforce that `args` holds `--include`; it is documented only. Without it, a 2xx is read as NotAnswered('glab printed no HTTP answer'), the same as before the move."
    }
  ]
}
