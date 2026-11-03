# MrStartsRustR1

Agent output (`agent://MrStartsRustR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsRustR1.md), collected 2026-11-03T19:50:12.856Z.

{
  "summary": "`WindowKind` now holds each window's start options: `Merge`, `Compare { start }`, `Range { ai, start }`. `start_script(theme, kind)`, `open_with_data_folder(title, kind, manage, at_exit)` and `open_and_wait(app, title, kind)` lost their loose `ai`/`start` parameters. The start script only has arms for legal pairs, and the merge window passes no options. The compare window still hands its `ai` to `merge_requests::manage` for Show Diff, as before. `name()` and the start-script text are unchanged.",
  "files_changed": [
    "src-tauri/src/window.rs",
    "src-tauri/src/range.rs",
    "src-tauri/src/start_script.rs",
    "src-tauri/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "start_script::tests::the_start_script_names_the_theme_and_the_window (reshaped)",
      "proves": "Same exact script text as before for merge (light, zed-light), compare and range (ai off, Files), built from the new WindowKind payloads."
    },
    {
      "name": "start_script::tests::the_start_script_marks_ai_only_when_on (reshaped)",
      "proves": "data-ai only for Range { ai: On }; Merge, Compare { Files } and Range { ai: Off } lack it."
    },
    {
      "name": "start_script::tests::the_start_script_opens_the_merge_request_page_only_for_compare_and_range_with_mr (reshaped)",
      "proves": "Exact text for Compare { MergeRequests } and Range { On, MergeRequests }; no data-open for Merge, Compare { Files }, Range { Files }. The old (Merge, MergeRequests) case no longer compiles, so it was dropped."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt && cargo fmt --check",
      "observed": "FMT_OK (no diff)"
    },
    {
      "command": "cargo clippy -p yamt-app --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 38.86s (no warnings)"
    },
    {
      "command": "cargo nextest run -p yamt-app",
      "observed": "Summary [   8.138s] 196 tests run: 196 passed, 21 skipped"
    },
    {
      "command": "just bindings-check",
      "observed": "cargo run --quiet -p yamt-app --features bindings --bin export-bindings -- target/bindings-check.ts; diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts → empty diff, exit 0"
    },
    {
      "command": "git diff --word-diff=porcelain src-tauri/AGENTS.md",
      "observed": "only: +`= Merge | Compare { start } | Range { ai, start }, each kind with only the start options its start script reads`; open_with_data_folder `-ai, start,`; start_script `kind, ai, start)` → `kind)`"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 9 mutants to test; 9 mutants tested in 3m: 4 caught, 5 unviable; no TypeScript changes since HEAD",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "src-tauri/AGENTS.md (Owned) is one 26 KB line, so the edit tool had to replace the whole line. The word diff shows only the WindowKind, open_with_data_folder and start_script signature fragments changed.",
    "docs/architecture.md:699, the project-map tree.md:103/115 and older briefs still describe WindowKind as merge|compare(|range) and start_script loosely. They don't name the old loose signature, so I left them; they are read-only for this slice."
  ],
  "open_risks": [
    {
      "location": "src-tauri/src/start_script.rs:9-28",
      "risk": "The arms use `..` to skip `ai` in Range patterns. clippy's wildcard_enum_match_arm accepts this (clippy passed), but a new Range field would be skipped silently by those arms."
    }
  ]
}
