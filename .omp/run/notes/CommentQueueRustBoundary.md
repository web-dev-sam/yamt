# CommentQueueRustBoundary

Agent output (`agent://CommentQueueRustBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/CommentQueueRustBoundary.md), collected 2026-11-24T18:22:18.199Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership/PM1: only the 6 Owned files changed. No new crate edge or state. ThreadStore stays the only writer of threads.json. The send guard is shared (review.rs:181 send_guard).",
    "Contract matches the brief: send_message is re-exported in lib.rs:21. The command is registered right after send_queue. bindings.ts:63 has sendMessage(message, progress).",
    "One path, not a copy: send_queue and send_message both go through send() -> post_queue. The message is picked in waiting_and_owned. Draft matching, send_one, stops and refusals are not duplicated.",
    "Deviation 1 accepted. The early return on an empty queue (send.rs:114) only changes send_queue when nothing is queued, and the UI disables Send then (rangeGitLab.ts:97).",
    "Deviations 3 and 4 accepted. Deviation 5 (doc rows for map-check) is the orchestrator's.",
    "The guard test (tests.rs:154-159) uses UNKNOWN_ID, which fixes the order: guard first, then the store's error. The comment on send_message cites #198 (CP2)."
  ],
  "findings": [
    {
      "file": "crates/review/src/send.rs",
      "line": 83,
      "severity": "block",
      "rule_id": "growth: copied decision",
      "problem": "require_listed builds a second copy of the store's 'shown message, else UnknownMessage' lookup (thread_store.rs:230 shown_message) outside the store. It clones the whole ThreadList (every message's text) just to check that one id is present, and it takes the store lock a second time.",
      "fix": "Widen Owned to thread_store.rs and add `pub(crate) fn require_shown(&self, range, message) -> Result<()>` that delegates to shown_message. Call it from send_message and delete require_listed."
    },
    {
      "file": "crates/review/tests/review.rs",
      "line": 214,
      "severity": "should",
      "rule_id": "RS6",
      "problem": "The test helper Review::send_one calls send_message, but send.rs's private send_one is the per-message post inside any send. The same name means two different things in src and tests, so a reader following a send failure lands in the wrong function.",
      "fix": "Rename the test helper to `send_only` (or rename the private send.rs fn `send_one` to `post_one`)."
    },
    {
      "file": "crates/review/tests/review.rs",
      "line": 844,
      "severity": "should",
      "rule_id": "RS6",
      "problem": "This test file grows from 833 to about 1040 lines, against RS6's 400. The next send test has to be found in an even longer file. The send_message tests are their own group.",
      "fix": "Widen Owned and move the seven send_message_* tests into tests/send_message.rs. Share Review/Fake/queued/pending through a tests module, as stored_threads/mod.rs does."
    },
    {
      "file": "crates/review/src/send.rs",
      "line": 65,
      "severity": "nit",
      "rule_id": "principles §1",
      "problem": "`only: Option<MessageId>` needs a doc comment to say that None means the whole queue. A reader of send/post_queue/waiting_and_owned has to remember that convention.",
      "fix": "Use `enum Covers { Queue, Message(MessageId) }` and match on it in waiting_and_owned, then drop the comment."
    }
  ]
}
