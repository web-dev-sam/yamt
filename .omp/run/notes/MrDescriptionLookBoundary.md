# MrDescriptionLookBoundary

Agent output (`agent://MrDescriptionLookBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionLookBoundary.md), collected 2026-11-03T23:30:24.263Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all files are in Owned, plus useMarkdown.test.ts, which Main added mid-slice (accepted). No edits in internal/**, markdownFence.ts or docs/**. Both signatures match the Contract.",
    "Boundaries: the test imports ./index and its own ./internal/syntax, which PM5 allows. useMarkdown.ts is still the only MarkdownView importer (PM2). No new edges, no Vue state, no state.md row needed.",
    "Deviation 1 accepted: with #shown=[], show() would append after the code node. A null source never matches, so show() rebuilds. A stale paint is stopped by host.contains (markdown.ts:17).",
    "eslint.config.js:28: no-v-html is an error in the **/*.vue block, placed after flat/recommended so it overrides the warning. eslintRules.test.ts lints with the real config file and asserts severity 2.",
    "The showCode JSDoc is the Contract's own text. The AGENTS.md line cites the proposed plan #171 (design §1.7). The tree.md updates at :199 and :272 are the docs keeper's (deviation 6). All accepted.",
    "Open risks accepted: watch(code) re-renders only when what the getter reads changes. The plain check is sound because paintCode returns before its await when languageNamed is null (codeBlock.ts:26-29)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/useMarkdown.ts",
      "line": 30,
      "severity": "block",
      "rule_id": "principles §2 / growth check (copied decision)",
      "problem": "useMarkdownCode copies useMarkdown's lifecycle line for line: one view per host element, flush \"post\", destroy on swap and on scope end. The view-lifecycle rule now lives twice, so every fix must be made twice. The mutation run shows it: the same flush survivor appears at :18 and :44.",
      "fix": "Add a private useView<T>(host, source: () => T, render: (view, value: T) => void) that holds the watches and the destroy. useMarkdown then passes (v, t) => v.show(t), and useMarkdownCode passes (v, c) => v.showCode(c.language, c.text)."
    }
  ]
}
