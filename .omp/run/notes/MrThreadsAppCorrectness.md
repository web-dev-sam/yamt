# MrThreadsAppCorrectness

Agent output (`agent://MrThreadsAppCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsAppCorrectness.md), collected 2026-11-04T14:35:44.664Z.

{
  "verdict": "fail",
  "checked": [
    "Offers before reply (RK41/RK53): thread.rs:23-26 offers pages, uploads, then pictures, one lock at a time, before returning; preview at :41-43. Tests show all notOffered/404 before the read, opened/served after.",
    "One write per post (RK54): `written` offers nothing, one call. panel_writes_on_paths_glab expects exactly 5 --include argv+stdin pairs in order, exact bodies, state 5, after-post-5 read. A duplicate write fails it.",
    "Refused reason: refused_writes_on_paths_glab expects Refused 403 Forbidden, Refused note is missing, Failed deadline, Failed 500 exactly. Blank reply → Refused, calls log empty (an_empty_reply_on_paths_glab).",
    "No project: all 5 commands answer Failed{NO_PROJECT}. Bad id (upper/39/path) fails deserialisation with NOT_AN_ID; glab log empty. Whole thread: 4 authors+editors+times, drafts, pending 2.",
    "Mutation VF7: 13 mutants, 1 caught, 12 unviable, 0 missed; no kept survivor to judge. Unviable plausible (no Default on the reply enums). Statement deletion is never mutated; see finding.",
    "Deviations accepted: #[path] mod thread_commands matches the test-name constants; `use std::thread` in tests.rs shadows the glob for resolve.rs; discussions.rs JSON gains only the new fields. No tests run, no edits."
  ],
  "findings": [
    {
      "file": "src-tauri/src/merge_requests/tests/thread.rs",
      "line": 99,
      "severity": "block",
      "rule_id": "RK53",
      "problem": "No test checks the contract's third offer, thread.rs:25 `state.pictures.offer(read.pictures)`. Deleting it keeps every test green, yet the panel would get 404 avatars for editors (the box offers only note authors, turn.rs:64-70) and for new authors after a write.",
      "fix": "In thread_pages_on_paths_opener, assert asked(&window, \"/dmitri\") is 404 before the read, then after it 200 with the bytes of mr-threads/pictures/uploads/-/system/user/avatar/5/avatar.png."
    }
  ]
}
