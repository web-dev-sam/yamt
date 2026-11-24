# CommentQueueWebCorrectness

Agent output (`agent://CommentQueueWebCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/CommentQueueWebCorrectness.md), collected 2026-11-24T18:40:26.633Z.

{
  "verdict": "fail",
  "checked": [
    "Failure chain tested: failed add → step note, text kept; failed queue → step queue, note stays notQueued, no send; failed send → step send, message stays queued (rangeGitLab.test.ts 'a failed …' ×3).",
    "fixtureReview.send order matches Rust (review.rs send_guard → send.rs require_shown → lined_up): SendRunning, then UnknownMessage, then notLinedUp; not waiting → 0/0, no progress. Shared postQueue path, no copy.",
    "Survivors rangeThreads.ts:138, :159, :238 kept as VF7 (b): each mutant reads a member of a `X | undefined` value, which vue-tsc strict rejects. Valid reason.",
    "addTyped/lastMessage: Rust appends under the store lock and returns that list, so its last message is the note just added. addThread/addNote wrappers and rangeAi.askFrom behave as before; canAsk still sees Queue/Note adds.",
    "Post: note → action queue (rangeGitLab.test.ts:197), AI answer → write (:256). Post box Queue uses queueButton. Edit box unchanged. Open risk 3 accepted: pressPost queues only when postButton gates it.",
    "WebKit/real-app acceptance not run (no WebKitWebDriver/Xvfb): Shift label, click shiftKey, pressPost's .vue dispatch, look; .vue not mutated. Accepted as routed to the verifier's smoke pass (VF11)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/rangeGitLab.ts",
      "line": 176,
      "severity": "block",
      "rule_id": "R-brief-change-1",
      "problem": "The open risk is real. If Send to GitLab, or another box's Send, starts after queueTyped/queuePost passed their check but before queueAndSend reaches send(), send() returns at its guard without reporting. Rust's post_queue reads its waiting list at start, so a Shift+Send ends merely queued, with no notice or problem.",
      "fix": "When send() finds a send running, report {action:'threads', step:'send', cause:{kind:'SendRunning'}} (or let the one-message call reach Rust's SendRunning). Add a test: gitlab.send() starts between queue and sendMessage; expect that problem and the message queued."
    },
    {
      "file": "frontend/src/ui/rangeGitLab.ts",
      "line": 118,
      "severity": "nit",
      "problem": "In postButton, `body` is the PostBody and `shown` is the message's own body, so two different bodies sit in one signature; nothing gets harder as the app grows beyond a reread.",
      "fix": "Rename the destructured `body: shown` to `body: messageBody`, or test `message.body.kind` directly."
    }
  ]
}
