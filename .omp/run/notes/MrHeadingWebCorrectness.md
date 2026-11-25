# MrHeadingWebCorrectness

Agent output (`agent://MrHeadingWebCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingWebCorrectness.md), collected 2026-11-25T09:56:57.731Z.

{
  "verdict": "pass",
  "checked": [
    "rangeDomain/rangeText tests fail without the feature: iid -1/1.5 naming heading.iid (both variants); 4 columnNames rows plus mergeBase on the right; 40-char test checks columnText, emptyRangeText and headingLine",
    "rangeSearch MR test uses short-id labels, so ignoring the heading fails; fixtureRange.test expects {...REVIEW_START, heading}, covers nosuch/empty/toString, sums committed totals",
    "Wording traced by hand: MR left=target with branchedOff=source; '...' only for a mergeBase left label; unnamed source=right.shortId; line is first bar, v-if files screen; since view keeps SINCE_REVIEW_HEADING",
    "Survivors OK: rangeDomain.ts:85 typed->'' equivalent (default returns heading); :98, rangeText.ts:139,188 unreachable never arms; HEADINGS/FORK_* #732 static, pinned by the ?heading= test.each",
    "Deviations accepted: unexported heading/totals types (no importer, knip TS16), isColumns rename, spaces inside spans (SSR test shows them), missingCase typed, open risk 3 (copy spacing asked only for headers)",
    "app-session: refuses partial --mr-* (6 cases) or names without --review-of; test pins --mr-* order right after --review-of=. No tests were run (no block depends on one)."
  ],
  "findings": [
    {
      "file": ".omp/run/mutants/MrHeadingWeb.survivors.txt",
      "line": 2,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The reason kept for the CASE schema survivors (fixtureRange.ts:98-106) is wrong: askedHeading replaces the heading after the CASE parse, so the ?heading= tests never reach that schema. The real killers are typecheck (the parsed shape must fit Generated.RangeStart) and the refusal tests. Kept as is, the record teaches the wrong precedent.",
      "fix": "Split the line: name typecheck (VF7 b) and the refusal tests in fixtureRange.test.ts for the CASE heading/totals schema, and keep the ?heading= tests only for FORK_*/HEADINGS."
    },
    {
      "file": "frontend/src/ui/RangeHeadingLine.vue",
      "line": 22,
      "severity": "nit",
      "problem": "The chip's class string is copied four times in this one component. A change to the chip's look needs four identical edits, and if one is missed the chips drift apart.",
      "fix": "Hold the chip classes in one `const CHIP` in the script, or render the two chips from a `v-for` over the line's two names, so the look is written once."
    }
  ]
}
