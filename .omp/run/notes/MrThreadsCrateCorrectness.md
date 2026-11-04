# MrThreadsCrateCorrectness

Agent output (`agent://MrThreadsCrateCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsCrateCorrectness.md), collected 2026-11-04T14:25:02.127Z.

{
  "verdict": "pass",
  "checked": [
    "Turn data/RK71/RK61: one builder (turn.rs open_discussion) for box and thread, person notes only, earlier oldest first, place from first person note (test has system note first). Mentions: one USER_LINK test; d01/d04/d12/d10 via fake.",
    "200 rule fails open discussions only (resolved cut stays Open); thread applies it to any. Edited rule pins equal time, null editor, null time, later+person. ISO compare accepted: GitLab Time is iso8601 to the second.",
    "Thread: NotFound before drafts call; drafts matched on hex, pending counts all; --paginate pages and empty read; bad JSON/200/missing MR → Failed; bodies only via described_on (RK60/RK66); pages/uploads deduped in order.",
    "RK54: blank → glab → logged_in_project → one Glab::send; exact argv/bodies for all five (%2F, no reviewer_state); each_write_is_one_post: state 5, 5 --include lines; reads/preview log none. 2xx/4xx/other/NotAnswered mapping pinned.",
    "Batch timeout [INFERENCE]: not a regression on measured data. Old query took 19.7 s on busiest 10, so today's batch of 20 likely fails all 20; now 10 fail, 10 load. Regresses only if one half carried >84% of a sub-20 s batch.",
    "Survivors vs VF7: read.rs:102 queries count is wiring (c). Both log_read reasons lack the smoke observation (c) needs; preview reason wrong (finding 3). Hex-rule copy left to boundary lens. No test run."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/discussions.rs",
      "line": 32,
      "severity": "should",
      "problem": "At 10, the busiest gitlab-org rows still take 23.5 s, past glab's 20 s deadline, so 'Load fully' fails them in groups of 10 with no retry. Today's 20-row batch very likely times out on the same rows, so this is no regression, but the brief's under-the-deadline goal is not met. Nothing builds on the number.",
      "fix": "Hand Main the choice to measure 5 busy rows, or split a timed-out batch once into halves, and record the 23.5 s / 19.7 s pair in the doc comment as the reason; no code change in this slice.",
      "rule_id": "RK69"
    },
    {
      "file": "crates/merge-requests/src/discussion_thread/read.rs",
      "line": 173,
      "severity": "should",
      "problem": "found_discussion reads every later discussions page (up to 10 heavy calls, each with its own 20 s deadline) before picking the id. A discussion on page 1 still pays for the extra calls, and a later page timing out fails the whole thread.",
      "fix": "Stop paging once a page holds the asked id (check each page inside the paging loop or an early-exit loop here); keep NotFound/Failed for an id never found."
    },
    {
      "file": ".omp/run/mutants/MrThreadsCrate.survivors.txt",
      "line": 2,
      "severity": "should",
      "problem": "The markdown_preview.rs:122 reason says 'the kind names are pinned by tests', but no test pins the preview's inline outcome strings. Neither log_read survivor names the smoke observation VF7(c) requires, so the preview's log words can drift unnoticed.",
      "fix": "Add outcome(&MarkdownPreviewReply) and pin it as the_logs_name_each_outcome_by_its_kind does; have the app slice's smoke name the thread and preview log lines.",
      "rule_id": "VF7"
    }
  ]
}
