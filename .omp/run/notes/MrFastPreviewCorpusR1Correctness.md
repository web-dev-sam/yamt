# MrFastPreviewCorpusR1Correctness

Agent output (`agent://MrFastPreviewCorpusR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewCorpusR1Correctness.md), collected 2026-11-04T21:52:56.137Z.

{
  "verdict": "pass",
  "checked": [
    "#2431 closed: corpus.rs:180-189 checks each local entry's raw html for gl-emoji, math, mermaid, data-reference-type markers and any <a without class=\"anchor\". Failures name the entry.",
    "jq over all 87 entries: flipped to local, emoji, unicode, math_inline, fenced_mermaid, mention, url and link would each fail. No local entry holds a marker now, so the test passes.",
    "All local heading anchors carry class=\"anchor\" in their own tag. A > in an attribute could only cause a false alarm. Links, emoji or math GitLab adds inside code on a re-record are now caught.",
    "Accepted risk: ref_issue's html is unlinked (`see #12`), so no html check can catch it flipped to local. That is a round-0 recording limit; localPreview.test.ts still fails if the fixture alone flips it.",
    "Mutation: the change is test-only. R1 survivors file says 0 mutants and keeps no survivors, so there is nothing to check against VF7.",
    "Commit 6f27834d touches only corpus.rs and run artefacts. The throwaway flip went into the test filter, not the fixture (accepted deviation). No unwrap or as added. No tests run."
  ],
  "findings": []
}
