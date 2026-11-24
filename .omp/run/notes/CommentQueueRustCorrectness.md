# CommentQueueRustCorrectness

Agent output (`agent://CommentQueueRustCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/CommentQueueRustCorrectness.md), collected 2026-11-24T18:21:51.269Z.

{
  "verdict": "pass",
  "checked": [
    "One path: send_queue and send_message both go through send(..,only)→post_queue. waiting_and_owned narrows queued by retain, owned stays store-wide. Glab/lined_up/drafts/send_one/Tally are shared; of is 1 or 0.",
    "Unknown id: require_listed uses list(range), which filters by file_at like shown_message, so the error is the same UnknownMessage. It runs before any glab call; the test asserts log==\"\" and would fail without the check.",
    "Tests: only_the_named (bodies==[RENAMED]) fails if retain is dropped; does_not_wait (no draft_notes argv) fails without the empty return; drafted fails if drafts aren't listed; refusal fails if the whole queue is sent.",
    "src-tauri: send_message with the guard held and UNKNOWN_ID would answer UnknownMessage without send_guard. through_glab shows send_queue gets SendRunning during send_message's POST. RK33 holds via shared post_queue.",
    "Accepted deviations: empty send_queue now gives Sent 0/0 (UI can't reach it: sendButton disables at queued===0, rangeGitLab.ts:97); unknown id checked before glab-missing; Sent doc text; bindings.ts:63 has sendMessage.",
    "Mutation: just mutants HEAD gave 18 mutants (6 caught, 12 unviable, 0 missed), so no kept survivors to check against VF7. I ran no tests; the review is by reading."
  ],
  "findings": [
    {
      "file": "crates/review/src/send.rs",
      "line": 61,
      "severity": "nit",
      "problem": "On every Shift+Send, require_listed clones the range's whole ThreadList (every message's text) just to check that one id exists. Growth effect: nothing, since list and shown_message share file_at.",
      "fix": "In a slice that owns thread_store.rs, add a pub(crate) ThreadStore::require_shown(range, message) that wraps shown_message, and call it here."
    }
  ]
}
