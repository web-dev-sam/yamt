# MrDiffStats

Agent output (`agent://MrDiffStats`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrDiffStats.md), collected 2026-10-31T07:30:18.897Z.

{
  "summary": "The list query now asks for `diffStats { additions deletions }` (one entry per changed file) instead of `diffStatsSummary`. `change_size` adds up the files' counts: each count is clamped to 0..u32::MAX, the sums saturate, `files` is the entry count, and a null or empty list gives `None`. The recorded pages hold `diffStats` lists that give the same sizes as before. A new test checks that the query never asks for `diffStatsSummary`. The crate's AGENTS.md names the field and why.",
  "files_changed": [
    "crates/merge-requests/src/page.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/page/tests.rs",
    "crates/merge-requests/AGENTS.md",
    "tests/glab/merge-requests/graphql-page-1.json",
    "tests/glab/merge-requests/graphql-page-2.json",
    "tests/glab/merge-requests-timeout/graphql-page-1.json",
    "tests/glab/mr-conflicts/graphql-page-1.json"
  ],
  "tests_added": [
    {
      "name": "page::tests::a_size_sums_each_file_s_counts_and_counts_the_files",
      "proves": "Three entries give additions 17, deletions 7, files 3: each sum and the entry count."
    },
    {
      "name": "page::tests::no_files_or_null_stats_is_no_size",
      "proves": "`diffStats` set to [], set to null, or missing all give `size: None`."
    },
    {
      "name": "page::tests::a_negative_count_is_0_a_huge_sum_saturates_and_another_or_no_source_project_is_a_fork",
      "proves": "A count of -3 is read as 0 (sum 6, not 3); a sum past u32 saturates to u32::MAX instead of overflowing. Keeps the existing fork assertions."
    },
    {
      "name": "page::tests::the_recorded_pages_give_the_sizes_their_summaries_gave",
      "proves": "Every row of merge-requests page 1, page 2 and mr-conflicts parses to the size its old summary gave; page 2's null and !27's empty list give None."
    },
    {
      "name": "query::tests::the_list_query_asks_per_file_diff_stats_never_the_summary",
      "proves": "Pins the cause of the bug: the list query has `diffStats {` and no `diffStatsSummary`. A comment cites the gitlab.com measurement of 2026-10-31."
    }
  ],
  "smoke_evidence": [
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-merge-requests",
      "observed": "Summary [   2.110s] 62 tests run: 62 passed, 1 skipped"
    },
    {
      "command": "cargo clippy -p yamt-merge-requests --all-targets -- -D warnings && cargo fmt --check",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.53s / FMT_OK (no warnings, fmt clean)"
    },
    {
      "command": "<hermetic prefix> cargo nextest run -p yamt-app merge_requests",
      "observed": "Summary [   6.045s] 6 tests run: 6 passed, 169 skipped"
    },
    {
      "command": "just bindings-check",
      "observed": "cargo run … export-bindings -- target/bindings-check.ts; diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts — exited 0 with no diff output"
    },
    {
      "command": "(cwd /home/wds/Projects/glab-yamt-playground) glab api graphql -f 'query=<list_query() text taken from query.rs, MAX_FAILED_JOBS=50>' -f fullPath=samubr/glab-yamt-playground -F first=100 | jq (per node: iid, status, conflicts, size computed the way change_size does)",
      "observed": "errors null; complexity {score:130,limit:250}\n!4 DRAFT_STATUS conflicts:false size 1/0/1 files\n!3 MERGEABLE conflicts:false size 1/0/1\n!2 MERGEABLE conflicts:false size 1/0/1\n!1 CONFLICT conflicts:true diffStats [{2,1},{6,0}] size 8/1/2"
    },
    {
      "command": "just mutants HEAD",
      "observed": "Found 5 mutants to test; 5 mutants tested in 14s: 3 caught, 2 unviable; mutants: no TypeScript changes since HEAD"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — 5 mutants: 3 caught, 2 unviable, 0 missed",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Real run: the playground is /home/wds/Projects/glab-yamt-playground (`../` does not resolve from this worktree). The SP1 hook blocks files outside the repo, so the query text went inline. I built it from query.rs lines 21-39 with a read-only sed/tr pipeline. The sizes come from jq, which mirrors change_size.",
    "!27 in mr-conflicts now records `diffStats: []` and page 2's first row records `null`, so the scenario pages cover both 'no size' cases.",
    "Read-only docs still name `diffStatsSummary`; the docs keeper should update them: docs/architecture.md lines 689-690 and 711-712, and docs/plan.md row 138."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/query.rs:15-17",
      "risk": "The doc comment says the query costs 'about 119' complexity. Its full text cost 130 on the real playground (4 merge requests). I did not change it: that comment is outside this slice's Change, and per-file `diffStats` may cost more on merge requests with many files."
    }
  ]
}
