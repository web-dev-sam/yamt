# MrRowColoursCorrectness

Agent output (`agent://MrRowColoursCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrRowColoursCorrectness.md), collected 2026-10-31T09:03:21.857Z.

{
  "verdict": "pass",
  "checked": [
    "No sizeText callers left: only ui/choiceText.ts's unrelated private byte-size helper. index.ts exports sizeParts with no alias. Stale docs are fixed in 78411a0d, tree.md:187 and architecture.md:1509/1521.",
    "Traced Row.vue:108-118: every newline sits inside a tag or a mustache, so condense keeps no whitespace nodes. textContent is '!32 · created 1 day ago · +75 −12 · 5 files' as before; separators are plain text (#2044).",
    "Colours: +X text-success-signal and −Y text-problem-error (the pair at RangeCounts.vue:14-15), files text-fg. The iid, age and · inherit the p's text-fg-muted. Both tokens are in style.css and in every theme.",
    "One span with :title=size.title wraps all three parts and the inner ' · ', so the hover covers the size. With a null size the v-if skips it: the line reads '!27 · created 3 days ago' (WebKit read).",
    "A hyphen fails size.test.ts:8 (toEqual '\\u221240') and :14 (codePointAt 0x2212). Plurals are pinned both ways at :9 and :18. Mutants: 17/17 killed, none kept; the Doc slice's 'not run' meets VF7 (Markdown only).",
    "No risk-register rows for MergeRequestRow or mergeRequests/. Notes carry all acceptance evidence: unit tests, mutants, WebKit text and per-part colours on dark and webstorm-light, both screenshots. I ran no tests."
  ],
  "findings": []
}
