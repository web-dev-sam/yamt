# MrHeadingRustR1

Agent output (`agent://MrHeadingRustR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingRustR1.md), collected 2026-11-25T09:40:38.125Z.

{
  "summary": "Fixed #2591. `parse` now runs the window and `--review-of` checks first (through `invocation`) and attaches the `--mr-*` names last with a new `Invocation::named`. `RangeOf::named` now takes `MergeRequestNames` directly. Two tests pin the order, and `src-tauri/AGENTS.md` states it.",
  "files_changed": [
    "src-tauri/src/args.rs",
    "src-tauri/src/args/tests.rs",
    "src-tauri/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "window_and_review_of_refusals_come_before_the_mr_names_refusals",
      "proves": "`--diff --diff=a..b --review-of=g/p` gives DIFF_TWICE; `--diff --review-of=g/p!1 --mr-title=x` gives REVIEW_OF_WITHOUT_RANGE; diff twice, review-of twice and diff with repo each win over a partial name"
    },
    {
      "name": "mr_names_without_a_range_or_review_of_are_refused",
      "proves": "with no window flag, `--diff` or `--mr`: all three names give MR_NAMES_WITHOUT_REVIEW_OF and two of them give MR_NAMES_APART"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo test -p yamt-app args::",
      "observed": "test args::tests::window_and_review_of_refusals_come_before_the_mr_names_refusals ... ok; test args::tests::mr_names_without_a_range_or_review_of_are_refused ... ok; test result: ok. 34 passed; 0 failed (every existing refusal test still passes)"
    },
    {
      "command": "cargo clippy -p yamt-app --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 35.36s (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "FMT_OK"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 3 mutants to test; 3 mutants tested in 74s: 3 unviable",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [],
  "open_risks": [
    {
      "location": "src-tauri/src/args.rs:138-144",
      "risk": "The Help/Version arm of `Invocation::named` can never run, because `parse` returns them early. It is listed only so the match covers every variant (RS9)."
    },
    {
      "location": "just mutants HEAD",
      "risk": "All 3 mutants were unviable (none built). I could not list them because `mutants.out` was not in the working tree. [INFERENCE] They are return-value replacements with `Ok(Default::default())`, which cannot build because `Invocation` and `RangeOf` have no `Default`."
    }
  ]
}
