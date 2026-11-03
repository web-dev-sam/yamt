# MrStartsRust

Agent output (`agent://MrStartsRust`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsRust.md), collected 2026-11-03T19:39:59.034Z.

{
  "summary": "`yamt --mr` now works. With no `--diff` flag it opens the compare window, as `--diff` would; with `--diff` or `--diff=<range>` it only chooses the start screen. The choice is a new `StartScreen` sum type (`Files`/`MergeRequests`) carried by `Invocation::Compare`/`Range`. `start_script` adds `document.documentElement.dataset.open = \"mergeRequests\";` for compare/range windows only. `parse` takes `YAMT_AI` (unset/empty/`0` off, anything else on, `--ai` wins); `lib.rs` reads it once via `AI_VAR`. Help shows the new lines; AGENTS.md is updated.",
  "files_changed": [
    "src-tauri/src/args.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/src/start_script.rs",
    "src-tauri/src/window.rs",
    "src-tauri/src/range.rs",
    "src-tauri/src/second_window.rs",
    "src-tauri/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "args::tests::mr_alone_or_with_diff_in_either_order_opens_the_compare_window_on_its_page",
      "proves": "B1: --mr, --diff --mr, --mr --diff and --mr twice all give Compare { ai: Off, start: MergeRequests }"
    },
    {
      "name": "args::tests::mr_with_a_range_opens_the_range_window_on_its_page",
      "proves": "B1: --diff=a..b --mr and --mr --diff=a..b --repo p give Range with start MergeRequests and the right repo"
    },
    {
      "name": "args::tests::mr_with_a_repo_and_no_range_is_refused_as_diff_with_a_repo",
      "proves": "B2: --mr --repo p and --repo p --mr refused with DIFF_WITH_REPO"
    },
    {
      "name": "args::tests::help_and_version_win_over_mr",
      "proves": "--mr with --help gives Help; with --version gives Version"
    },
    {
      "name": "args::tests::the_usage_names_mr",
      "proves": "USAGE has the `yamt --mr` form and the --mr option line"
    },
    {
      "name": "args::tests::yamt_ai_unset_empty_or_zero_is_off_and_any_other_value_on",
      "proves": "C1: YAMT_AI unset/\"\"/\"0\" → Off, \"1\"/\"yes\" → On; USAGE names YAMT_AI=1"
    },
    {
      "name": "args::tests::ai_flag_wins_over_yamt_ai_zero",
      "proves": "C1: --ai with YAMT_AI=0 is On"
    },
    {
      "name": "args::tests::yamt_ai_that_is_not_utf8_is_on",
      "proves": "Contract: a non-UTF-8 YAMT_AI value (Unix) is On"
    },
    {
      "name": "start_script::tests::the_start_script_opens_the_merge_request_page_only_for_compare_and_range_with_mr",
      "proves": "dataset.open line, exact text, for compare/range with MergeRequests (after the ai line); never for merge; never with Files"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo nextest run -p yamt-app",
      "observed": "Summary [   7.102s] 196 tests run: 196 passed, 21 skipped"
    },
    {
      "command": "cargo clippy -p yamt-app --all-targets -- -D warnings && cargo fmt --check && just bindings-check",
      "observed": "Finished `dev` profile ... (no warnings); FMT_OK; `diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts` printed no diff"
    },
    {
      "command": "target/debug/yamt --help",
      "observed": "usage: yamt [--repo <path>]\n       yamt --mr\n       yamt --diff [--mr]\n       yamt --diff=<a>..<b> [--repo <path>] [--mr]\n       yamt --diff=<a>...<b> [--repo <path>] [--mr]\n...\n  --mr              open the merge-request page at start; without --diff=<range> it means --diff\n  --ai              with --diff=<range>: ...\n  YAMT_AI=1         in the environment: every start behaves as with --ai (unset, empty or 0: off)\nexit=0"
    },
    {
      "command": "target/debug/yamt --repo /tmp --mr",
      "observed": "yamt: --diff compares pasted text and takes no --repo\nusage: ... \nexit=2"
    },
    {
      "command": "just app-session start-app --name mrs-mr --binary /tmp/mrstarts-wrap/yamt-mr (sh wrapper: exec target/debug/yamt \"$@\" --mr) --diff --dir /tmp/mrstarts-repo --glab mr-conflicts; read [dataset.open, dataset.window]",
      "observed": "{\"value\":\"[\\\"mergeRequests\\\",\\\"compare\\\"]\"}"
    },
    {
      "command": "just app-session start-app --name mrs-plain --diff --dir /tmp/mrstarts-repo --glab mr-conflicts; read [String(dataset.open), dataset.window]",
      "observed": "{\"value\":\"[\\\"undefined\\\",\\\"compare\\\"]\"}"
    },
    {
      "command": "start-app --name mrs-rmr --binary yamt-mr wrapper --range main...develop --repo /tmp/mrstarts-repo; read open/window",
      "observed": "{\"value\":\"[\\\"mergeRequests\\\",\\\"range\\\"]\"}"
    },
    {
      "command": "start-app --name mrs-ai1 --binary wrapper (YAMT_AI=1 exec target/debug/yamt \"$@\") --range main...develop --repo /tmp/mrstarts-repo; read [String(dataset.ai), window, String(open)]",
      "observed": "{\"value\":\"[\\\"on\\\",\\\"range\\\",\\\"undefined\\\"]\"}"
    },
    {
      "command": "start-app --name mrs-ai0 --binary wrapper (YAMT_AI=0) --range main...develop --repo /tmp/mrstarts-repo; read [String(dataset.ai), window]",
      "observed": "{\"value\":\"[\\\"undefined\\\",\\\"range\\\"]\"}"
    },
    {
      "command": "just app-session stop --name <each>; pgrep -a yamt",
      "observed": "each stop: session ended, tauri-driver and xvfb stopped, folder removed; pgrep listed only cargo-mutants' own test binaries under /var/tmp/yamt-mutants, no app; wrappers and /tmp/mrstarts-repo removed afterwards"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 17 mutants to test; 17 mutants tested in 4m: 8 caught, 9 unviable; mutants: no TypeScript changes since HEAD",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "start_script.rs: the brief said to extend its two tests. I left those two as they were (now passing StartScreen::Files) and put the --mr marker cases in a new third test, the_start_script_opens_the_merge_request_page_only_for_compare_and_range_with_mr.",
    "Real-app smoke: app-session has no --mr flag and no way to pass environment variables. I used its --binary option with throwaway /bin/sh wrappers in /tmp/mrstarts-wrap that append --mr or set YAMT_AI=1/0 and exec target/debug/yamt. The wrappers were deleted afterwards.",
    "Built target/debug/yamt with `cargo tauri build --debug --no-bundle` (pages built in), as skill://verification asks for start-app.",
    "Docs lines outside Owned, for the docs keeper: docs/architecture.md (and ipc-contract, if they describe args/start_script) should name `--mr` → StartScreen on Compare/Range, `<html data-open=\"mergeRequests\">`, and YAMT_AI read once in lib.rs (AI_VAR) and passed to `args::parse(args, ai_variable)`. The README should list --mr and YAMT_AI=1 beside --ai (request rules B3, C2)."
  ],
  "open_risks": [
    {
      "location": "src-tauri/src/second_window.rs:44",
      "risk": "A second yamt (a range window from the list, or a merge window) inherits YAMT_AI from this process's environment. That is harmless: the merge window ignores ai, and a range window would get On anyway, since the parent read the same variable."
    },
    {
      "location": "src-tauri/src/args.rs:95",
      "risk": "--mr is applied after all flags are read (`started_on`), so `--diff --diff=a..b --mr` still gives DIFF_TWICE, and `--mr` with only `--repo` is refused as `--diff --repo` is. This follows B2, but the message names --diff, not --mr."
    }
  ]
}
