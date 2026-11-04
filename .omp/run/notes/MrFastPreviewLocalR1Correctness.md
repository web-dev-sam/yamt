# MrFastPreviewLocalR1Correctness

Agent output (`agent://MrFastPreviewLocalR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewLocalR1Correctness.md), collected 2026-11-04T22:15:50.829Z.

{
  "verdict": "fail",
  "checked": [
    "#2437 closed: the GL/iteration/projectPath triggers fire. Tree.add merges adjacent texts (markdownTree.ts:148), so a path is never split. The four new cases are non-vacuous (failing path pasted).",
    "#2439/#2442/#2443 closed: a coding: line and leading blanks are skipped; NUL is checked on the whole text; NESTING_LIMIT is still 15; the `> `x15 quote fails without the depth check (pasted).",
    "#2440 closed: commonMarkNeighbours skips `~` both ways (a reached edge is space); the yamt mode is unchanged; the new test fails without the skip. #2441 closed: otherWhiteSpace catches NBSP/U+3000/U+FEFF.",
    "Corpus: the fixture has 63 local:true and 24 local:false entries (jq), which matches the pasted pass. The RULE stop keeps star_rule local (failing path pasted). I did not rerun the tests.",
    "Accepted: RULE is exported; over-triggers send doubtful text to GitLab (A2). Mutation: editor/ is excluded and the brief's failing paths stand in, so there are no survivors.",
    "#2438's named texts are caught (layers traced). A tsx probe of the gap failed (import.meta.glob in ipc/fixture.ts), so the finding is traced by hand."
  ],
  "findings": [
    {
      "file": "frontend/src/editor/internal/localPreview.ts",
      "line": 94,
      "severity": "block",
      "rule_id": "R-#2438",
      "problem": "#2438 is partly open: CONTAINER_PREFIX, SETEXT and FENCE allow only 0-3 leading spaces, so an item continuation at column 4+ (`10.` items, third-level items) gets no layers. `10. Title\\n    ===` and `- a\\n  - Title\\n    ---` render as a paragraph or a rule where GitLab shows a heading. `- a\\n  - b\\n    -     code` loses its indented code, and S13 misses there too.",
      "fix": "In containerLayers, accept any leading indent before a marker (`^ *`) and add the indent-stripped line as a layer. Add these texts and a nested S13 fence as trigger cases, and keep the corpus green."
    }
  ]
}
