# MrFastPreviewLocalR3Correctness

Agent output (`agent://MrFastPreviewLocalR3Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewLocalR3Correctness.md), collected 2026-11-04T22:38:43.932Z.

{
  "verdict": "pass",
  "checked": [
    "#2462 closed: in `    >>>` the ` {0,3}` alternative fails and `^ +` strips the indent, so S6 reads a `>>>` layer. Old `^ *` gave `>>`,`>`,``. Pinned by test.ts:71; the `{0,4}` hand mutant is killed too.",
    "#2463 closed: the R3 survivors file keeps no survivor. VF7 does not mutate editor/, so `just mutants` has no TS change. The R2 equivalence claim is refuted by 2 tests that fail on `^ *` (note smoke).",
    "Deviation accepted (A2): item b holds `- - -`. In CommonMark, §4.1 puts a break ahead of a list item and §4.3 bans spaced setext; comrak follows cmark. html.rs:150-176 reduces `<li>b<hr></li>` to [Paragraph b, Rule], which the test pins.",
    "Only lines with a 4+ indent then `>` or a marker change; the one loss is S15 under a RULE layer. `a\\n    - - -`, `- a\\n    - - -`, `- a\\n      - - -` and the quote form draw as CommonMark does. Blank before: S2.",
    "AGENTS.md:21 wording matches the regex, and the brief and design need no update. No risk-register row owns localPreview. I ran no tests: no block depends on one."
  ],
  "findings": []
}
