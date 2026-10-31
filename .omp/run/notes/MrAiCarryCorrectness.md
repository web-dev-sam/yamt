# MrAiCarryCorrectness

Agent output (`agent://MrAiCarryCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrAiCarryCorrectness.md), collected 2026-10-31T10:18:15.260Z.

{
  "verdict": "pass",
  "checked": [
    "Flag paths: lib.rs Compare{ai}→window::run_compare→open_compare→merge_requests::manage(…, ai); range.rs:58 manage_range_in passes run_range's ai; merge_requests.rs:122 opened→start_range(&range, state.ai).",
    "Merge window never gets --ai: start_merge (second_window.rs:19) uses merge_arguments, unchanged; both Resolve (:256) and Continue (:268) pass start_merge; merge_arguments test still parses back to Invocation::Merge.",
    "Compare start script: window.rs:99 still passes Ai::Off to open_with_data_folder; start_script.rs:9-12 emits data-ai only for (Range, On), pinned at start_script.rs:52-54.",
    "Round trip: second_window test loops Ai::Off/On through args::parse to Range{ai}, so a dropped or always-pushed --ai fails it; args tests pin --diff→Compare{Off}, --diff --ai and --ai --diff→Compare{On}.",
    "Mutation: 5 caught, 5 unviable, no kept survivors, so nothing to grade under VF7. Smoke swap to merge-requests scenario accepted: mr-conflicts graphql files have no diffRefs.",
    "Deviations accepted: plan §2 #144 now records the amendment of #108/#132 (docs/plan.md:176); USAGE continuation line and open_compare doc comment are accurate; AGENTS.md updated for Compare{ai}, start_range(range, ai)."
  ],
  "findings": [
    {
      "file": "src-tauri/src/range.rs",
      "line": 58,
      "severity": "should",
      "problem": "No test checks that a window's own --ai reaches MergeRequestState or that `opened` passes state.ai to start_range. Changing range.rs:58, window.rs:96 or merge_requests.rs:122 to Ai::Off would pass every test. The range-window path has no smoke evidence either. A later refactor of manage could drop the flag without any test failing.",
      "fix": "In merge_requests/tests.rs, open `crate::range::tests::open_range_window_with(Ai::On)` and `(Ai::Off)` and assert `webview.state::<MergeRequestState>().ai` equals the flag each time."
    }
  ]
}
