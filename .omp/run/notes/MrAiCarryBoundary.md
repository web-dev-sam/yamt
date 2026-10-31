# MrAiCarryBoundary

Agent output (`agent://MrAiCarryBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrAiCarryBoundary.md), collected 2026-10-31T10:18:15.374Z.

{
  "verdict": "pass",
  "checked": [
    "Ai sits in MergeRequestState (merge_requests.rs:59-64), Copy, set once by manage, read only in opened → start_range(&range, state.ai). No IPC change; compare window has no AiState; start script still Ai::Off (window.rs:99).",
    "manage(app, folder, app_folder, ai): all 3 callers updated with the window's own flag: window.rs:96 compare, range.rs:61 range (same ai as ai::manage), merge_requests/tests.rs:32 Ai::Off. start_merge unchanged: no --ai.",
    "No second mutable AI source: AiState, data-ai and MergeRequestState.ai all set once at start from the parsed Invocation. The split is what brief Change 3 and plan #144 ask for. New args::Ai imports match the existing ones.",
    "src-tauri/AGENTS.md matches the code: args Compare { ai } never stored, range/merge_requests/second_window/window.rs ai entries, compare never manages AiState (commands.rs). Only its plan citations are stale (finding 1).",
    "Deviations accepted: smoke used range-repo.sh/merge-requests because mr-conflicts has no diffRefs (a fixture risk); the plan amendment went to the orchestrator (DR5, now #144); the USAGE line was flagged.",
    "Rust shape: exhaustive match on Ai in range_arguments; the renamed test covers both Ai values through args::parse; both `--diff --ai` orders tested; lib.rs Invocation match exhaustive."
  ],
  "findings": [
    {
      "file": "src-tauri/src/args.rs",
      "line": 51,
      "severity": "should",
      "rule_id": "R-open-1",
      "problem": "The `Ai` doc comment cites only #108, and so does AGENTS.md's args.rs entry. That row still says only `Invocation::Range { ai: Ai }` keeps the flag, so a reader who follows the citation finds the opposite of the code. This keeps misleading every later reader.",
      "fix": "Cite `plan §2 #108, #144` in the `Ai` doc. In AGENTS.md, add #144 to the args.rs, merge_requests.rs and second_window.rs entries."
    },
    {
      "file": "src-tauri/src/window.rs",
      "line": 92,
      "severity": "should",
      "rule_id": "R-open-1",
      "problem": "The new `///` comment on the private `open_compare` states a design decision (ai kept for Show Diff, start script stays off) with no source, which the reviewer test flags. Nothing gets harder as the app grows.",
      "fix": "Add `(plan §2 #144)` to the comment, or drop it and let the `Ai::Off` argument and AGENTS.md's window.rs entry carry the decision."
    },
    {
      "file": ".omp/skills/project-map/state.md",
      "line": 61,
      "severity": "should",
      "problem": "The state rows for MergeRequestState omit the new `ai` field: state.md:61, architecture.md:509 (the struct) and architecture.md:1045 (§5.1) list only gitlab and pages. So the table no longer answers where Show Diff's --ai comes from. These files are outside Owned and belong to the docs keeper.",
      "fix": "Docs keeper: add '`ai` (the window's own `--ai`), set at start only by `manage`, read only by `opened`' to state.md:61 and architecture.md:1045, and add `ai` to the struct at architecture.md:509."
    },
    {
      "file": "src-tauri/src/args.rs",
      "line": 21,
      "severity": "nit",
      "problem": "The USAGE text says only `--diff` passes the flag on. A `--diff=<range> --ai` window's merge-request page passes it on too (range.rs:61, plan #144), so `--help` understates the behaviour. Nothing gets harder as the app grows.",
      "fix": "Reword the continuation as '…in its own checkout; with --diff or --diff=<range>, the changes windows its merge-request page opens get it too'."
    }
  ]
}
