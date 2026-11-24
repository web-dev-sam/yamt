# CommentQueueRust

Agent output (`agent://CommentQueueRust`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/CommentQueueRust.md), collected 2026-11-24T18:19:41.479Z.

{
  "summary": "`yamt_review::send_message(range, glab, threads, message, progress)` now exists, and the `send_message` Tauri command is registered right after `send_queue` in `commands.rs`. It sends one message through the same path as `send_queue`: `send_queue` and `send_message` both go through `send(.., only: Option<MessageId>, ..)` → `post_queue`, which narrows the queued messages to `only`. An unknown id gets the store's `UnknownMessage` error before any glab call. A message that is not waiting gets `Sent 0/0` and no glab call after the check. The command takes the same `send_guard` as `send_queue`.",
  "files_changed": [
    "crates/review/src/send.rs",
    "crates/review/src/lib.rs",
    "crates/review/tests/review.rs",
    "src-tauri/src/review.rs",
    "src-tauri/src/review/tests.rs",
    "src-tauri/src/commands.rs"
  ],
  "tests_added": [
    {
      "name": "send_message_posts_only_the_named_message_and_the_others_stay_queued",
      "proves": "Only the named message is POSTed (one body) and becomes pending 101. The other two stay queued in memory and on disk. Progress is [1 of 1]."
    },
    {
      "name": "send_message_keeps_a_refused_message_queued_with_its_reason",
      "proves": "A 400 answer leaves the message Refused with GitLab's reason; Sent 0/1. The third message stays queued."
    },
    {
      "name": "send_message_stopped_by_a_timeout_leaves_the_message_queued",
      "proves": "A stop reason (glab timed out) gives Stopped 0/0 with the message still queued and no progress."
    },
    {
      "name": "send_message_takes_the_unowned_draft_with_its_text_instead_of_posting_again",
      "proves": "The existing draft 301 is recorded and no body is POSTed; the other messages stay queued."
    },
    {
      "name": "send_message_without_glab_or_lined_up_merge_request_is_not_lined_up",
      "proves": "No glab gives GlabMissing and a moved MR gives Moved. Drafts are not listed and nothing changes on disk."
    },
    {
      "name": "send_message_on_an_unknown_id_is_the_store_s_error_before_any_glab_call",
      "proves": "An unknown id gets Error::UnknownMessage and the fake glab log stays empty."
    },
    {
      "name": "send_message_on_a_message_that_does_not_wait_sends_nothing",
      "proves": "A note that was never queued, and a message already pending, each get Sent 0/0 with the current list. After the check: no draft listing, no POST, no progress."
    },
    {
      "name": "src-tauri review::tests::a_second_send_while_one_runs_answers_send_running (extended)",
      "proves": "While the send guard is held, both send_queue and send_message answer SendRunning."
    },
    {
      "name": "src-tauri through_glab::a_message_send_holds_off_a_queue_send_until_its_post_ends",
      "proves": "With the real command on the slow-post fake glab: send_queue answers SendRunning while send_message's post runs. Then send_message answers Sent 1/0 with progress [1 of 1]."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo test -p yamt-review",
      "observed": "All 7 send_message_* tests ok; test result: ok. 24 passed (tests/review.rs); the other suites 48, 8 and 23 passed; 0 failed"
    },
    {
      "command": "cargo test -p yamt-app (the src-tauri package; its lib is named yamt)",
      "observed": "test result: ok. 238 passed; 0 failed; 48 ignored. Among them: review::tests::a_second_send_while_one_runs_answers_send_running ok, through_glab::a_message_send_holds_off_a_queue_send_until_its_post_ends ok, through_glab::a_send_holds_off_a_second_send_until_its_post_ends ok"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 37.75s (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "exit 0 (FMT_OK)"
    },
    {
      "command": "just mutants HEAD",
      "observed": "Found 18 mutants to test; 18 mutants tested in 2m: 6 caught, 12 unviable; mutants: no TypeScript changes since HEAD"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — 18 mutants: 6 caught, 12 unviable, 0 missed",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The early `queued.is_empty()` return in post_queue also covers send_queue: an empty-queue send_queue now answers Sent 0/0 without listing drafts. Before, it listed them and could answer Stopped if that failed. I kept one rule over a send_message special case; no existing test changed. Owner may want it gated on `only.is_some()`.",
    "Unknown id check: I compare against the message ids in `ThreadStore::list(range)` (`require_listed` in send.rs) and return `Error::UnknownMessage`, because the store's `shown_message` is private and thread_store.rs is read-only. A `pub(crate) ThreadStore::require_shown(range, message)` would put this check in one place.",
    "The unknown-id check runs before the glab-missing check, so an unknown id gives the error even when glab is missing.",
    "lib.rs: the doc of SendReply::Sent now reads \"Every queued message the send covers was handled.\" This changes the doc text in the generated bindings.",
    "Docs for the orchestrator: name `send_message` beside `send_queue` in docs/architecture.md:731 and :798, .omp/skills/ipc-contract/SKILL.md:95 (`send_message(message: MessageId, progress) -> SendReply`, SendRunning while any send runs), and .omp/skills/project-map/tree.md:70 and :134. `just map-check` needs these. Then run `just bindings`."
  ],
  "open_risks": [
    {
      "location": "crates/review/src/send.rs:114",
      "risk": "The empty-queue early return slightly changes send_queue's behaviour when the queue is empty (see deviations)."
    },
    {
      "location": "crates/review/tests/review.rs",
      "risk": "This test file is now about 1020 lines, well past RS6's 400. It was already 833. A split (for example tests/send_message.rs with shared helpers) is outside Owned."
    }
  ]
}
