# MrDiffStatsCorrectness

Agent output (`agent://MrDiffStatsCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrDiffStatsCorrectness.md), collected 2026-10-31T07:32:11.477Z.

{
  "verdict": "pass",
  "checked": [
    "Sums/file count: change_size (page.rs:226) adds clamped counts with saturating_add, files=len; a_size_sums_each_file_s_counts test (17/7/3) fails if only one file is summed or files is off by one.",
    "Null/empty/missing → None: is_empty() gives None; a missing key reads as None (node_with's base has no diffStats); single-entry fixture rows catch a `len() <= 1` boundary bug.",
    "Negative/saturation: -3→0 gives 6 (3 without the clamp); wrapping_add gives 7, not MAX; + panics in debug. The test catches each.",
    "Pages keep sizes: hand-summed every list against the old summaries (page 1, page 2, all 11 mr-conflicts rows; !27 []→None); timeout page = page 1 (same blob f9f5c6c); nothing else reads diffStatsSummary/fileCount.",
    "Query test fails if diffStatsSummary comes back (with or without diffStats); `diffStats {` doesn't match the summary. Mutants 3 caught/2 unviable, no survivors kept (nothing for VF7). No tests run.",
    "Real run accepted: !2,!3 MERGEABLE, !1 CONFLICT, !4 DRAFT_STATUS; jq-mirrored sizes OK since unit tests pin change_size. No contract change (bindings-check clean); docs keeper updated architecture.md:711 and plan #138."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/query.rs",
      "line": 16,
      "severity": "should",
      "problem": "Implementer's open risk: the doc comment says 'about 119' of 250, but the real run measured 130. It was stale before this patch. GitLab scores complexity from the query text, so the risk's 'grows with file count' is wrong. Fields added later get planned against a budget 11 points short.",
      "fix": "Change the comment to '130 of GitLab's complexity limit of 250 (measured on gitlab.com 2026-10-31, `docs/slices/briefs/mr-diff-stats.md`)'; the fixture's 119 can stay."
    }
  ]
}
