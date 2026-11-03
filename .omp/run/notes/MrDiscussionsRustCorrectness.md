# MrDiscussionsRustCorrectness

Agent output (`agent://MrDiscussionsRustCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsRustCorrectness.md), collected 2026-11-03T14:50:09.796Z.

{
  "verdict": "pass",
  "checked": [
    "Contract kept: batch cut, GlabMissing, From<NoProject>, one batch call, per-row later pages ≤10, NO_CURSOR, not_sent, WebPage::note, discussions_reply, both commands; bindings diff = contracted types/commands + WebPage doc",
    "Tests catch real bugs: first-vs-last person note (RK61 x2), resolvable&&!resolved, 20 system notes ±hasPreviousPage, 20-distinct boundary, 10 pages ok/11th refused in 10 calls, avatar once per user",
    "WebPage::note refusals cover iid 120/1, '#note_1/x', '/12/#note_1', http, other host/project, missing sub-path (RK60); a note page fails read_job_log as NotOffered (job_parts None)",
    "src-tauri: pages added only for Open rows; Pictures::offer extends; NOTE_103 notOffered→opened, note_999/evil stay notOffered (RK41); anna 404→200 (RK53)",
    "Scenario matches brief table (a)-(f), !79 d-2, !78 absent, 81 lazy, 77 err/exit; fake iids route before iid. Settings: written only when not Full, missing→Full, unknown→Broken, unknown entries kept",
    "Deviations and open risks accepted (empty-ask test placement, no 77.json, answer.rs split, `queries` field, docs left to keeper, required field like `agent`). No tests run."
  ],
  "findings": [
    {
      "file": ".omp/run/mutants/MrDiscussionsRust.survivors.txt",
      "line": 2,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "Survivor `discussions.rs:318 replace log_read with ()` is kept as wiring (c), but VF7 (c) requires the log call to have been seen in a smoke run and named there, and no smoke shows the line. log_read also counts rows itself. So nothing checks the contracted log fields or the rule that no name or body is logged. As the app grows, a silent or leaking log line goes unnoticed.",
      "fix": "Capture the info line from a fake-glab or app-session run and name that observation in the survivor's reason, or kill the survivor with a test."
    }
  ]
}
