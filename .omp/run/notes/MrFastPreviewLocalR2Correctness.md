# MrFastPreviewLocalR2Correctness

Agent output (`agent://MrFastPreviewLocalR2Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewLocalR2Correctness.md), collected 2026-11-04T22:32:46.153Z.

{
  "verdict": "fail",
  "checked": [
    "Hand traces: #2455's four texts (10. setext, 2nd-level dash setext, 3rd-level indented code, nested S13 fence) now hit S1/S2/S13 and return null. Tests at localPreview.test.ts:56-88.",
    "The four new tests would fail without the fix: the implementer's failing path shows all four fail before it and three fail without `|^ +`. I accept that evidence.",
    "Corpus: jq gives 63 local / 24 other. I traced the 5 local entries with indented lines (nested_list, list_with_para, nested_ordered, ordered_para_items, fenced_plain): no trigger fires. The corpus test checks full blocks.",
    "R2 only adds layers; the RULE stop and MAX_NESTING=16 are unchanged, so it cannot turn a null into a local preview. Extra nulls such as `a\\n    ---` are the A2 open risk, which I accept.",
    "AGENTS.md deviation accepted except the `>` case in the first finding. I ran no tests; bash-guard blocked a tsx probe, so all results are hand traces."
  ],
  "findings": [
    {
      "file": "frontend/src/editor/internal/localPreview.ts",
      "line": 94,
      "severity": "block",
      "rule_id": "R-2455",
      "problem": "`^ *(?:> ?|…)` matches before `|^ +` can, so a line with 4+ spaces then `>` never gets an indent-stripped layer. For `- a\\n  - b\\n    >>>\\n    q\\n    >>>` the layers are `>>`, `>`, `` and never `>>>`. S6 does not fire, and yamt draws nested quotes where GitLab draws a multi-line quote [INFERENCE: comrak]. #2455 stays open for S6.",
      "fix": "Use `/^ {0,3}(?:> ?|(?:[-*+]|\\d{1,9}[.)])(?: |$))|^ +/` so a 4+ indent is stripped first. Add trigger `- a\\n  - b\\n    >>>\\n    q\\n    >>>` (S6 in a second-level item)."
    },
    {
      "file": "frontend/src/editor/internal/localPreview.ts",
      "line": 94,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "The kept survivor `^ *`→`^ {0,3}` is not equivalent. On the nested `>>>` text the mutant returns null and the patch returns blocks. On `- a\\n  - b\\n    - - -` the mutant stops at RULE and stays local, while the patch reaches `-` and S15 sends it to GitLab. No test kills it.",
      "fix": "Drop the survivor. Adopt the mutant form (first finding) and keep the nested S6 trigger as the test that tells the two forms apart."
    }
  ]
}
