# MrHeadingRustBoundary

Agent output (`agent://MrHeadingRustBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingRustBoundary.md), collected 2026-11-25T09:35:45.870Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: every patched file is in Owned; bindings.ts and fixtures left to the orchestrator. No new dependency edge (merge-requests→range, src-tauri→range already exist); PM1 holds.",
    "Contract matches: types, derives and serde tag; Range::start(heading); RangeToOpen.names; DETAILS_QUERY pinned exactly; RangeOf/range_of; flag, refusal and USAGE texts; range_arguments order; open_with_data_folder.",
    "Title: three forms, one TITLE_GAP; only the title loses control chars; window_title end kept; no ·|• (VU18). Heading derived before review_of takes range_of; title built after listing.",
    "One source per fact: names built once in open_diff (the fetch reads names.target); entries::totals feeds both title and open_range; is_from_fork reused; no is_control helper copied.",
    "Deviations accepted: hand rename, NameFlags, parse ~40 lines, hidden fork as (fork). Stale MarksOf in architecture.md:783, state.md:39, tree.md:129-130, risk-register:93 goes to the docs keeper.",
    "Comments: shown_source cites GitLab's presenter (CP1); new /// lines say what each pub item is; no narration or TODO. The AGENTS.md paragraphs for range, merge-requests and src-tauri match the code."
  ],
  "findings": [
    {
      "file": "src-tauri/src/args.rs",
      "line": 270,
      "severity": "should",
      "problem": "range_of? and names? now run before window?, so `--diff --diff=a..b --review-of=g/p` gets the --review-of refusal instead of DIFF_TWICE, and `--diff --review-of=g/p!1 --mr-title=x` gets MR_NAMES_APART instead of REVIEW_OF_WITHOUT_RANGE. The brief keeps --review-of's precedence, and no test pins the order.",
      "fix": "Check `window?.started_on(start)` and `range_of?` first, as before. Attach names after invocation's window/--review-of match, and test both orders.",
      "rule_id": "DR1"
    },
    {
      "file": "crates/merge-requests/src/open.rs",
      "line": 134,
      "severity": "nit",
      "problem": "shown_source borrows Details and clones source_branch for every same-project merge request, while open_diff moves title and target_branch out right after. This is one avoidable allocation per open; nothing gets harder as the app grows.",
      "fix": "Destructure Details in open_diff and pass source_branch by value (with the ids and source_project) to shown_source, returning it unchanged in the same-project case."
    }
  ]
}
