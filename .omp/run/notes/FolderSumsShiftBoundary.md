# FolderSumsShiftBoundary

Agent output (`agent://FolderSumsShiftBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/FolderSumsShiftBoundary.md), collected 2026-11-25T10:58:05.667Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: only RangeApp.vue and ui/AGENTS.md changed, both Owned. RangeCounts.vue, RangeFileRow.vue and useShiftHeld.ts are untouched. No new component, so no test was required.",
    "Contract: one `const shift = useShiftHeld()` (RangeApp.vue:59), the shared composable that RangeMessage:32, RangeThreadBox:38 and MergeRequestFilter:56 use. No second listener, no useKeyModifier.",
    "Rule 2 and #200: `:class=\"{ invisible: !shift }\"` (RangeApp.vue:138) falls through to RangeCounts' single `<span v-if>` root. It uses visibility, not v-if/v-show. File rows and the check span are unchanged.",
    "VU16/growth: one composable call plus one class binding, so no new job. No new state, and the one writer stays keyHold.ts. The ui→ui/useShiftHeld edge is fine; PM9 holds (no merge/compare root, no lsp/).",
    "ui/AGENTS.md line 9 states the Shift rule (useShiftHeld, invisible, file rows always shown) and cites the request. It agrees with plan §2 #200. No prose comment was added in the .vue change.",
    "Deviations accepted: seeded reviews so a folder check exists, base text via a temporary HMR revert, real-app line outside the brief. The no-test open risk is accepted: the brief allows a test only with a new component."
  ],
  "findings": [
    {
      "file": ".omp/skills/project-map/state.md",
      "line": 80,
      "severity": "should",
      "rule_id": "PM6",
      "problem": "The held-Shift row (also architecture.md:1809 and tree.md:310) names only merge-request readers. It omits RangeApp's folder counts and #198's RangeMessage/RangeThreadBox, and no doc line was proposed in deviations as the brief asked. A reader asking what Shift changes gets an incomplete answer.",
      "fix": "Docs keeper: make the row window-neutral and add RangeApp (#200) and RangeMessage/RangeThreadBox (#198) to state.md:80, architecture.md:1809 and tree.md:310. Note the Shift-only folder counts in tree.md:287."
    }
  ]
}
