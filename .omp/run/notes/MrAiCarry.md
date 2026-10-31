# MrAiCarry

Agent output (`agent://MrAiCarry`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrAiCarry.md), collected 2026-10-31T10:16:25.160Z.

{
  "summary": "`--diff --ai` now keeps the flag as `Invocation::Compare { ai }`. `MergeRequestState` holds the window's `Ai`; the compare window and the range window each set it from their own flag through `merge_requests::manage`. \"Show Diff\" passes it to `second_window::start_range`, which adds `--ai` to the started yamt's arguments only when it is `On`. The merge window and the compare window's start script are unchanged.",
  "files_changed": [
    "src-tauri/src/args.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/src/window.rs",
    "src-tauri/src/range.rs",
    "src-tauri/src/merge_requests.rs",
    "src-tauri/src/merge_requests/tests.rs",
    "src-tauri/src/second_window.rs",
    "src-tauri/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "second_window::tests::the_second_yamt_is_asked_for_the_range_in_its_repository_with_the_windows_ai",
      "proves": "Renamed from …_without_ai. For Ai::Off and Ai::On, range_arguments parses back through args::parse to the same Range with the same ai, so --ai is present only when the flag is On."
    },
    {
      "name": "args::tests::ai_is_accepted_with_every_mode_and_reaches_the_range_and_compare_windows",
      "proves": "Renamed and extended: `--diff --ai` and `--ai --diff` both parse to Compare { ai: On }; the merge window still drops the flag."
    },
    {
      "name": "args::tests::diff_opens_the_compare_window",
      "proves": "Updated: plain `--diff` parses to Compare { ai: Off }."
    }
  ],
  "smoke_evidence": [
    {
      "command": "hermetic_git env + cargo nextest run -p yamt-app",
      "observed": "Summary [6.806s] 168 tests run: 168 passed, 7 skipped"
    },
    {
      "command": "cargo clippy -p yamt-app --all-targets -- -D warnings; cargo fmt --check",
      "observed": "Finished `dev` profile …, no warnings; FMT_OK"
    },
    {
      "command": "just bindings-check",
      "observed": "diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts printed no differences"
    },
    {
      "command": "scripts/range-repo.sh /tmp/mrai-rr; just app-session start-app --name mrai-on --diff --ai --dir /tmp/mrai-rr --glab merge-requests; click 'Merge requests'; click 'Show Diff' --nth 1 (!12); pgrep -af 'yamt --diff'",
      "observed": "839472 …/target/debug/yamt --diff --ai\n850094 …/target/debug/yamt --diff=531ea52dfb892e20206010fb6cd6161d9c88964a..9c1ba3fc606a3776061d23006b83e2af2a357112 --repo /tmp/mrai-rr --ai"
    },
    {
      "command": "same steps without --ai (session mrai-off, fresh /tmp/mrai-rr)",
      "observed": "861892 …/target/debug/yamt --diff\n862513 …/target/debug/yamt --diff=531ea52dfb892e20206010fb6cd6161d9c88964a..9c1ba3fc606a3776061d23006b83e2af2a357112 --repo /tmp/mrai-rr"
    },
    {
      "command": "just app-session stop (both sessions); pgrep -af 'debug/yamt'",
      "observed": "Both stops reported children [{role: yamt child, result: stopped}]; pgrep found nothing (NO_YAMT); /tmp folders removed"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — 10 mutants tested in 2m: 5 caught, 5 unviable; no TypeScript changes",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Smoke used scripts/range-repo.sh with --glab merge-requests instead of mr-conflict-repo.sh/mr-conflicts. The mr-conflicts scenario's graphql-merge-request-*.json have no diffRefs, so Show Diff on !21 answered 'GitLab is still preparing the changes of !21' and started no window. start-app does accept --ai directly.",
    "docs/plan.md §2 #108 ('only Invocation::Range { ai } keeps it') and #132 ('… without --ai') need amending; that file is not in Owned, so it is left to the docs keeper.",
    "USAGE's --ai line gained a continuation line: 'with --diff: the changes windows its merge-request page opens get it too'.",
    "Added a one-line doc comment on window.rs open_compare explaining why the compare window keeps ai but its start script gets Ai::Off."
  ],
  "open_risks": [
    {
      "location": "tests/glab/mr-conflicts",
      "risk": "The mr-conflicts scenario cannot exercise Show Diff (no diffRefs), so the brief's exact smoke recipe is not reproducible; the smoke ran on the merge-requests scenario instead."
    }
  ]
}
