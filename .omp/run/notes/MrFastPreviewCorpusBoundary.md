# MrFastPreviewCorpusBoundary

Agent output (`agent://MrFastPreviewCorpusBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewCorpusBoundary.md), collected 2026-11-04T21:40:26.449Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: only the 3 Owned files change; tests.rs adds `mod corpus;` and a blank line (accepted deviation); no throwaway dump tests left in description/tests/.",
    "Contract: Corpus/Entry fields, test names, include_str path and described(&html, None) match the brief; the reducer (html.rs, element.rs) is untouched.",
    "Verdicts: 87 entries in brief order; the 18 recorded local:false names match exactly; 6 extras false, ¹ and ² true; 63 true in total.",
    "holds_remote_part fits the serialised shapes: kind link/image/details (tag=\"kind\"), TaskBox a string (fixture :1855); its Value match has no wildcard arm.",
    "Growth: no new import edge; holds_ bool naming has precedent (compare holds_text); 181 lines, fns ≤40 (RS6); doc comments follow tests.rs (CP2); body matches plan #182.",
    "Deviations accepted: jq body from extras.json sends the same JSON; the serde-order re-dump keeps the data (md5); open_risks 1-2 stay within the brief's verdicts."
  ],
  "findings": [
    {
      "file": "frontend/fixtures/markdown/gitlab-preview.json",
      "line": 1,
      "severity": "should",
      "rule_id": "PM6",
      "problem": "The new folder frontend/fixtures/markdown/ is missing from tree.md's frontend/fixtures row (:308-312), which lists every fixture folder and how each is made, and no line for it was proposed. As the app grows, readers cannot tell this hand-recorded file, shared by the Rust and TS tests, from the generated ones.",
      "fix": "Propose a tree.md line for the docs keeper: markdown/gitlab-preview.json is recorded once on gitlab.com, its blocks come from the reducer, and corpus.rs and the local preview's tests read it."
    }
  ]
}
