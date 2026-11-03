# MrStartsAgeCorrectness

Agent output (`agent://MrStartsAgeCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsAgeCorrectness.md), collected 2026-11-03T19:46:27.052Z.

{
  "verdict": "pass",
  "checked": [
    "A1/A3: ended writes listedAt only on a listed end (the rows-swap flag); load's catch path never touches it. Tests :549-618 use distinct times, so an early write, an unconditional write or a reset at the click fail.",
    "A2: timeTitle tests (dueDate.test.ts:175-191) cover 23:59/00:00 both ways, ahead of now same day and across midnight, and UTC-vs-local pairs. West-zone swap accepted: it still kills getUTC*.",
    "Minute update: age is computed from nowMs (useNow, one minute). A refresh ending after the last tick gives a negative age, which agoText shows as 'just now'. The lag up to 59 s comes from the brief's `now`; accepted.",
    "View: v-if on age !== null, so nothing shows before a list (read, not seen in the smoke). ml-auto moved to the group. vTooltip has `updated`, so the tip follows a new listedAt (tooltip.ts:159).",
    "All 26 survivors read from the transcript (jsonl l.207/210): dueDate.ts:4 x8 and :6 x15 (static regex); mergeRequests.ts:177, 187, 239 unchanged. None is on a changed line.",
    "Deviations accepted: listingOf inlined (failure unchanged, no refs left); clockText leaves dateTimeText output unchanged (:170-173); hoisted `at` keeps listing.at (:297). No test run needed."
  ],
  "findings": [
    {
      "file": ".omp/run/mutants/MrStartsAge.survivors.txt",
      "line": 1,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The survivors file gives only the count (26 survived) and lists none as file:line mutation with a reason, unlike the precedent (MrDuePicker.survivors.txt). The claim that none is on a changed line could only be checked from the transcript; nothing in the app gets harder, only later audits.",
      "fix": "Write the five survivor locations (dueDate.ts:4 x8, :6 x15 static regex; mergeRequests.ts:177, 187, 239 unchanged lines) into the file, each with its reason."
    },
    {
      "file": "frontend/src/ui/mergeRequests.test.ts",
      "line": 602,
      "severity": "nit",
      "problem": "'a refresh whose call throws keeps listedAt' sends no pages, so rows stay empty and the second call takes the unbuffered first-load path, not the refresh of a shown list its name describes. Nothing gets harder: the buffered failure path is covered by the {ok:false} case at :586.",
      "fix": "Send a page in the first call (or use `loaded(live)` and then a throwing source) so the thrown call refreshes a non-empty list."
    }
  ]
}
