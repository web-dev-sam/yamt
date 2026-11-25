# MrHeadingRust

Agent output (`agent://MrHeadingRust`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingRust.md), collected 2026-11-25T09:33:02.875Z.

{
  "summary": "`RangeStart` now carries `heading` (`Typed`, `MergeRequest { iid, names }`, `UnnamedMergeRequest { iid }`) and `totals` (all `Counted` lines summed, capped at u32::MAX). `prepare_open` reads the title and both branches from the details query: a fork's source shows as `ns:branch`, a hidden fork as `(fork) branch`. The child yamt gets them as `--mr-title=`, `--mr-source=` and `--mr-target=`, which arrive as `RangeOf` (renamed from `MarksOf`). The range window's title is now built after listing, from `range_title` over `start(heading)`, with parts two spaces apart.",
  "files_changed": [
    "crates/range/src/lib.rs",
    "crates/range/src/open.rs",
    "crates/range/src/entries.rs",
    "crates/range/tests/range.rs",
    "crates/range/tests/listing_answers.rs",
    "crates/range/AGENTS.md",
    "crates/cli/src/range.rs",
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/open.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/query/tests.rs",
    "crates/merge-requests/tests/open.rs",
    "crates/merge-requests/AGENTS.md",
    "tests/glab/merge-requests/graphql-merge-request-12.json",
    "tests/glab/merge-requests/graphql-merge-request-13.json",
    "tests/glab/merge-requests/graphql-merge-request-14.json",
    "tests/glab/merge-requests/graphql-merge-request-15.json",
    "tests/glab/merge-requests/graphql-merge-request-16.json",
    "tests/glab/merge-requests/graphql-merge-request-17.json",
    "tests/glab/merge-requests/graphql-merge-request-18.json",
    "tests/glab/merge-requests/graphql-merge-request-19.json",
    "tests/glab/README.md",
    "src-tauri/src/args.rs",
    "src-tauri/src/args/tests.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/src/range.rs",
    "src-tauri/src/range/tests.rs",
    "src-tauri/src/window.rs",
    "src-tauri/src/second_window.rs",
    "src-tauri/src/reviewed/tests.rs",
    "src-tauri/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "entries::tests::totals_sum_every_counted_file_and_skip_not_counted",
      "proves": "two Counted files are summed and a NotCounted file adds nothing"
    },
    {
      "name": "entries::tests::totals_saturate_at_u32_max",
      "proves": "u32::MAX plus 1 stays u32::MAX on both sides"
    },
    {
      "name": "tests/range.rs start_carries_the_heading_it_is_given_and_the_listed_files_totals",
      "proves": "on a real repo with a binary file, each of the three headings is carried, and totals equal the hand-computed sum of start.files' Counted rows (+2 −2)"
    },
    {
      "name": "query::tests::the_details_query_is_one_line_with_balanced_braces_and_its_argv_is_exact",
      "proves": "the details query argv is exactly the contract's text, on one line, with balanced braces"
    },
    {
      "name": "tests/open.rs an_opened_merge_request_carries_its_title_and_branches",
      "proves": "!13 gives names { Snooze a reminder, snooze, main }"
    },
    {
      "name": "tests/open.rs a_fork_s_source_is_its_namespace_then_its_branch",
      "proves": "!18 (source project 12 of 7, namespace sam) gives source sam:feature"
    },
    {
      "name": "tests/open.rs a_fork_gitlab_does_not_show_is_marked_as_a_fork",
      "proves": "!19 (sourceProject null) gives source (fork) feature, never feature"
    },
    {
      "name": "args::tests::mr_names_with_review_of_name_the_merge_request",
      "proves": "the three flags with --review-of, in either order, give RangeOf::MergeRequest with names: Some"
    },
    {
      "name": "args::tests::mr_names_without_review_of_partial_or_twice_are_refused",
      "proves": "one flag, two flags or a flag twice gives the 'together' refusal; all three without --review-of gives the 'go with' refusal; compare with --review-of keeps its refusal; --help still wins"
    },
    {
      "name": "args::tests::a_title_holding_quotes_equals_newlines_and_a_leading_dash_is_one_value",
      "proves": "--mr-title=--diff=x \"it's\" = −\\n!7 é is parsed as one title value"
    },
    {
      "name": "args::tests::review_of_without_names_names_no_names, the_usage_names_the_mr_names",
      "proves": "an older yamt's arguments give names: None; USAGE has the three new lines right after the --review-of lines"
    },
    {
      "name": "second_window::tests round trip (..._with_the_windows_ai_marks_and_names)",
      "proves": "RK42 round trip with the awkward title, for both Ai values, parses back to RangeOf::MergeRequest { names: Some(..) }"
    },
    {
      "name": "range::tests: a_typed_window_s_title_..., a_merge_request_window_s_title_..., an_unnamed_merge_request_s_title_...",
      "proves": "the exact title strings that manage_range_in returns (two spaces between parts, +1 −1), with no ·, | or • in them"
    },
    {
      "name": "range::tests: a_control_character_in_the_title_is_a_space_in_the_title_bar, open_range_answers_the_heading_and_totals",
      "proves": "a \\n and a \\t in the title become spaces; open_range answers the mergeRequest heading JSON and totals {1,1}"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt --check; cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "FMT=0; clippy printed no warnings or errors"
    },
    {
      "command": "cargo test -p yamt-range -p yamt-merge-requests -p yamt-cli -p yamt-app",
      "observed": "every 'test result: ok', 0 failed (yamt-app 247 passed; 48 ignored, the existing child-process helpers); all new tests listed as ok, e.g. range::tests::open_range_answers_the_heading_and_totals ... ok, a_fork_gitlab_does_not_show_is_marked_as_a_fork ... ok"
    },
    {
      "command": "just bindings; just bindings-check",
      "observed": "diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts gave no differences (exit 0). Generated: MergeRequestNames = { title, source, target: string }; RangeHeading = { kind: \"typed\" } | { kind: \"mergeRequest\"; iid: number; names: MergeRequestNames } | { kind: \"unnamedMergeRequest\"; iid: number }; RangeTotals = { added, removed: number }; RangeStart gains heading and totals. bindings.ts then reverted."
    },
    {
      "command": "just fixtures; git diff --stat frontend/fixtures",
      "observed": "range/empty.json | 7 +++++++ ; range/review.json | 7 +++++++ ; 2 files changed, 14 insertions(+). The only additions are \"heading\": { \"kind\": \"typed\" } and \"totals\": { added 0, removed 0 } (empty) / { added 64, removed 67 } (review). Both reverted with git checkout."
    },
    {
      "command": "just arch-check",
      "observed": "arch-check: ok"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 41 mutants tested in 6m: 19 caught, 22 unviable; no TypeScript changes since HEAD",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Step 3's lsp rename was not possible: rust-analyzer is not installed for toolchain 1.99.0 (LSP exited: \"Unknown binary 'rust-analyzer'\"). I renamed `MarksOf` → `RangeOf` and `marks` → `range_of` by hand at every grep hit; the compiler and the whole test run confirm none was missed.",
    "Parsing design left open by the brief: the private `NameFlag` enum and `NameFlags` collect the three flags, and `RangeOf::named` attaches them after --review-of is parsed. Partial or repeated names are refused before the --review-of check, so compare + --review-of + partial names gets the 'together' refusal. With all three names the --review-of refusal still wins (tested).",
    "`OpenDiff` now holds `names` instead of `target_branch`; the fetch reads `diff.names.target`, so the target branch is stored in one place.",
    "Doc updates in the owned AGENTS.md files: I edited the stale sentences in place and added one #199 paragraph each in merge-requests and src-tauri. I checked both rewrites with a word diff: only the intended words changed. crates/cli/AGENTS.md names no RangeStart fields, so it is unchanged.",
    "At my start the ownership hook did not match the `graphql-merge-request-1[2-9].json` glob; Main re-owned the eight literal paths and I then wrote them."
  ],
  "open_risks": [
    {
      "location": "frontend/** (bindings.ts, fixtures, test literals of RangeStart)",
      "risk": "Expected: once bindings and fixtures are regenerated with this patch, the web typecheck is red (RangeStart literals lack heading/totals) until mr-heading-web lands."
    },
    {
      "location": "crates/merge-requests/src/open.rs:132-144 shown_source",
      "risk": "[INFERENCE] from the design: GitLab answers sourceProject null both for a deleted project and for one the reader may not see. Both cases are shown as '(fork) branch'."
    },
    {
      "location": "src-tauri/src/args.rs:233-272 parse",
      "risk": "parse is at about the 40-line limit; clippy too_many_lines passes now, but one more flag arm would need it split."
    }
  ]
}
