# MrDescriptionLookCorrect

Agent output (`agent://MrDescriptionLookCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionLookCorrect.md), collected 2026-11-03T23:30:09.800Z.

{
  "verdict": "pass",
  "checked": [
    "showCode: guard, blockNode, replaceChildren correct. #shown={source:null} deviation accepted: a null source never matches a block, so a later show(\"\" too) rebuilds; [] would append. paintCode's live() drops stale paints.",
    "Browser tests fail with the feature broken: lost language fails the colour poll; append or #shown=[] gives 2-3 children or [PRE,H1,P]; innerHTML creates an img; no guard leaves the host non-empty. CM1-CM9 n/a.",
    "eslintRules.test uses the real config (src/ui/Sample.vue matches **/*.vue). Without the new line, recommended's warn gives [1], not [2]; an ignored file gives no ruleId and fails.",
    "useMarkdownCode tests pin call order, host swap, null host and dispose; code() is read fresh on a host change. Open risk 1 accepted: the page brief passes props (`() => ({ language, text })`), which trigger only on change.",
    "Deviations accepted: useMarkdown.test.ts added to Owned; private WebKit copy (#1445), filtered run 8/8; tree.md and plan #171 go to the docs keeper; Ruby def is keyword. Evidence present for the 7 tests and 4 commands.",
    "Survivor: Stryker runs with no TS checker (justfile:155) and flush is typed 'pre'|'post'|'sync' (runtime-core.d.ts:1508), so the gate kills it. No register row covers markdown code; RK66 is still proposed."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/useMarkdown.ts",
      "line": 44,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The kept survivor `flush \"post\" → \"\"` is labelled (c) wiring, but it is no registration or log call and no smoke observed it (the brief has none). The real reason is (b): vue-tsc (`web-typecheck`) rejects `\"\"` because `flush` is typed 'pre'|'post'|'sync'. A wrong label teaches later slices to keep timing options as 'wiring'.",
      "fix": "Relabel the survivor as (b) gate-covered by `web-typecheck` (`\"\"` not assignable to WatchEffectOptions.flush) in MrDescriptionLook.survivors.txt."
    }
  ]
}
