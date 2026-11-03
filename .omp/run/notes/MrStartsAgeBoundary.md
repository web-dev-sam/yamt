# MrStartsAgeBoundary

Agent output (`agent://MrStartsAgeBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsAgeBoundary.md), collected 2026-11-03T19:44:12.183Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 8 touched files are in the brief's Owned globs. No ipc/ or docs/ edits and no new file, so the PM6 rows are unaffected.",
    "One writer: listedAt is assigned only at ui/mergeRequests.ts:115 (`ended`, on a listed end). A thrown call restores only listing. The view never derives it. listing.at and listedAt share one Date.now() (:112).",
    "PM10: the view imports only ../mergeRequests index, ./tooltip and its siblings, and uses v-tooltip, never title. timeTitle is pure, exported via index.ts. calendar's sameDay is not usable (calendar imports dueDate: cycle).",
    "No copy: HH:MM is written once (clockText, shared with dateTimeText, grep getHours). The words reuse agoText. timeTitle matches the createdTitle/sizeTitle names. No code comments added.",
    "Deviations accepted: inlining listingOf (approved, same behaviour). Berlin instead of a west zone: dueDate.test.ts:17 itself pins Berlin, and the :186-191 pairs still catch getUTC*. Private clockText accepted.",
    "Contract: listedAt is a Readonly<ShallowRef<number|null>> shaped like listing. No other MergeRequests constructor exists (grep). The AGENTS.md lines at ui:49 and mergeRequests:9 match the code."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 115,
      "severity": "should",
      "rule_id": "PM6",
      "problem": "`listedAt` is missing from state.md:68 and architecture.md:1269, which list only `listing` (written by `load`). The brief asked for those lines in deviations and none was given. Until the docs keeper adds them, readers won't find `listedAt`'s one writer.",
      "fix": "Give the docs keeper this clause for both rows: \"`listedAt` only by `ended` on an end without failure text (the rows' swap); null until then; a refresh in flight, a thrown call and a failure end keep it\"."
    }
  ]
}
