# MrHeadingWebBoundary

Agent output (`agent://MrHeadingWebBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingWebBoundary.md), collected 2026-11-25T09:56:35.874Z.

{
  "verdict": "pass",
  "checked": [
    "Contract kept: ColumnName/ColumnNames/HeadingLine and the five rangeText functions match the brief table; sideHeading gone with no caller or doc mention left (grep src, skills, architecture)",
    "Deviations accepted: unexported heading/totals types (TS16, no importer); isColumns rename; two SSR tests; runtime case literals gain heading/totals; ?heading applied at parse so the iid is still branded",
    "Boundaries: rangeText.ts imports shared mergeRequestsText.ts (PM9/PM10 allow it, no cycle); no vue in ipc/; every touched file is Owned or a RangeStart test literal",
    "Growth: columnNames is the one naming rule (headers, rangePanes, emptyRangeText); columns derived once in RangeApp; totals passed through; no new state or writer; tree.md left to docs keeper (design 5)",
    "VU18 and looks: no separator text in RangeHeadingLine (only the arrow and the range's dots); first bar-stack child, files screen only; RangeCounts ml-auto; since view keeps its heading",
    "app-session: --heading follows reviewed, needs --range-case; --mr-* prefixes match src-tauri args.rs and follow --review-of=; no comments added"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/RangeHeadingLine.vue",
      "line": 22,
      "severity": "should",
      "problem": "The chip's 100-character class string is written four times (lines 22, 29, 45, 52), so a later change to the chip's look must edit four copies and can leave one behind; nothing else gets harder.",
      "fix": "Hold the chip classes in one `const CHIP_CLASS` in the script and bind `:class=\"CHIP_CLASS\"` on the four `<code>` chips."
    },
    {
      "file": "frontend/src/ipc/fixtureRange.ts",
      "line": 119,
      "severity": "should",
      "rule_id": "TS17",
      "problem": "HEADINGS is keyed by `string` and read with `Object.hasOwn(...) ? HEADINGS[asked] : undefined`, while the sibling fixture tables (fixtureGitLab.ts GITLAB_SCRIPTS, fixtureMergeRequests.ts SCRIPTS) key by a known union with an `is…` guard: a second convention for the same `?param=` lookup, which the next fixture author must choose between.",
      "fix": "Declare `type HeadingName = \"mergeRequest\" | \"fork\" | \"hiddenFork\" | \"unnamed\"`, type HEADINGS as `Readonly<Record<HeadingName, Generated.RangeHeading>>` and look up through an `isHeadingName` guard as fixtureGitLab.ts does."
    },
    {
      "file": "frontend/scripts/app-session/startArgs.ts",
      "line": 270,
      "severity": "should",
      "problem": "The app arguments are built by `Object.entries(opens.names)` turning field names into `--mr-<field>=`, so renaming or adding a MergeRequestNames field silently changes the app's argv, and `names` beside a separate `reviewOf: string | null` can be non-null without a review (the parser forbids it, the type does not).",
      "fix": "Spell the three arguments out (`--mr-title=${names.title}`, …) and, to stay under 300 lines, make the range opening's review one field `review: { of: string; names: MergeRequestNames | null } | null`."
    },
    {
      "file": "frontend/src/ui/RangeView.vue",
      "line": 63,
      "severity": "nit",
      "problem": "`isColumns` reads as a type test rather than \"the file shows two columns\"; nothing gets harder.",
      "fix": "Name it `showsColumns`."
    }
  ]
}
