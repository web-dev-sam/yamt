# MrFastPreviewCorpusCorrectness

Agent output (`agent://MrFastPreviewCorpusCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewCorpusCorrectness.md), collected 2026-11-04T21:41:32.316Z.

{
  "verdict": "pass",
  "checked": [
    "Verdicts match the brief: 18 false / 44 true among the 62 recorded. Extras: 6 false (mixed_bullets S5, fence_blank_edges K3, strike_single_tilde T2, code_language_upper K1, fence_info_words S13, quick_action S14). 87 total, 63 true.",
    "Ran a jq trigger scan on every local:true text: hits only in code, fences, heading markers, ~~ runs and rules after a blank line. ¹: no <a, <gl-emoji or js-render-math in code or pre. ²: paragraph `text` then table a,b/1,2. Both true.",
    "The 62 recorded {text,html} hash the same as PlanFastPreviewCorpus.json, and the name order equals its key order. The 25 extra texts are byte-identical to the brief's JSON block (jq output compared with cmp).",
    "Extras are real GitLab answers: data-sourcepos byte lengths match the texts (80, 32, 29), and the markup is GitLab-only (data-lang-params, <copy-code>, start=10 for `010.`). `recorded` matches the plan's date and command.",
    "Test 1 catches any reducer change and names the entry. Test 3 pins the exact name order. Test 2 matches the serde shapes and catches mention, url, link or task flipped to local. Open risks and deviations accepted.",
    "The empty survivors file is right: the changed lines are #[test] code and JSON, which cargo-mutants in-diff (justfile:134-150) does not mutate. No test was run, since no block depended on one."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/description/tests/corpus.rs",
      "line": 150,
      "severity": "should",
      "problem": "Test 2 reads only reduced blocks, and the reducer flattens code and gl-emoji to text. So a re-record where GitLab links refs inside code would pass all three tests, and so would unicode, emoji or ref_issue flipped to local. The local slice's code exemption then rests only on a smoke note.",
      "fix": "Add a test asserting that no local entry's html holds <gl-emoji, js-render-math, data-reference-type, or any <a except the heading anchor, with the failure naming the entry."
    }
  ]
}
