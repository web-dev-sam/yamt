# MrStartsRustBoundary

Agent output (`agent://MrStartsRustBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsRustBoundary.md), collected 2026-11-03T19:42:27.498Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: only Owned files touched (args, lib, start_script, window, range, second_window, AGENTS.md); no frontend, docs or bindings change, so PM1-PM10 and IPC untouched.",
    "Contract: start_script.rs:14-21 emits the exact dataset.open line only for Compare/Range + MergeRequests; lib.rs:50 reads YAMT_AI once via AI_VAR and passes it to parse.",
    "Callers of parse, run_compare, run_range, open_with_data_folder, open_and_wait, start_script all updated; Merge has no start; started_on turns Merge+--mr into Compare (args.rs:95).",
    "Deviations accepted: third start_script test, /tmp sh wrappers for smoke. Open risk accepted: child inherits YAMT_AI, gets --ai exactly when parent ai is On, so they agree.",
    "RS17 is L1-planned only (no disallowed-methods in clippy.toml, no env read has the #[expect]), so an #[expect] would go unfulfilled; not a finding here.",
    "Comments: StartScreen /// and widened Ai doc fit CP2; AGENTS.md matches the new shape; no plan §2 row contradicted (#108, #144 hold)."
  ],
  "findings": [
    {
      "file": "src-tauri/src/start_script.rs",
      "line": 8,
      "severity": "should",
      "rule_id": "vision-4",
      "problem": "Window kind, ai and start screen travel as three loose parameters through open_with_data_folder, open_and_wait and start_script. So (Merge, MergeRequests) is representable again, as a dead \"\" arm, and open_merge passes StartScreen::Files. Each future per-window start option adds a parameter to three signatures and one more dead Merge arm.",
      "fix": "Move the start options into the window kind's payload (e.g. WindowKind::Compare { start }, WindowKind::Range { ai, start }), so start_script matches only legal combinations and open_merge passes none."
    },
    {
      "file": "src-tauri/src/args.rs",
      "line": 424,
      "severity": "nit",
      "rule_id": "RS11",
      "problem": "yamt_ai_unset_empty_or_zero_is_off_and_any_other_value_on also asserts the USAGE line for YAMT_AI, which its name does not say. A help-text failure would therefore report as a parsing failure; nothing else gets harder.",
      "fix": "Move the USAGE assertion into the_usage_names_mr, or into its own the_usage_names_yamt_ai test."
    }
  ]
}
