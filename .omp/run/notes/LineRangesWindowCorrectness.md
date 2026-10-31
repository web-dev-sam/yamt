# LineRangesWindowCorrectness

Agent output (`agent://LineRangesWindowCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesWindowCorrectness.md), collected 2026-10-31T12:21:37.890Z.

{
  "verdict": "pass",
  "checked": [
    "Rule 7 samePlace (rangeDrafts.ts:122-126) matches brief. Ran Stryker on lines 122-126 only: 10/10 killed. It left untracked frontend/reports/ that hooks stopped me deleting; main agent rm -r it.",
    "Rule 6 threadPlaceText (rangeThreadText.ts:180-195): all 4 cases, paths and numbers right. Tests at rangeThreadText.test.ts:205-230 cover rename, deleted file, unchanged start by its new number (6 not 3), +2 to -4.",
    "Header and aria-label read the draft's or thread's place (RangeThreadBox.vue:43,157); askContext passes thread.place (rangeStore.ts:122). Test thread 5 gives ':-255 to +260', matching fixtureThreads.ts:68.",
    "DEFAULT_FIRST_MESSAGE line 3 (firstMessage.ts:14) is exactly the brief's text and its test expects the filled text. The default is stored as null (agentSettingsFields.ts:24,42), so users on the default get it.",
    "shownFor/addThread carry a multi-line place (rangeThreads.test.ts:100-120); startThread(place) makes that draft (useRangeController.test.ts:441-466). Each fails if cut to the end line; no assertion weakened.",
    "Kept survivor rangeDrafts.ts:130 is VF7(a) equivalent: non-thread drafts have no file. Other survivors are on unchanged lines. Accepted: no WebKit smoke, 4 pending startThread type errors, renamed both-removed uses old path."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/rangeThreads.test.ts",
      "line": 250,
      "severity": "should",
      "problem": "The 'end in a different column' case (unchangedOnLeft {left: 9, right: 8} against draft-0's added right 8) also changes the line, so it does not pin the column check alone. That check is caught only by chance: draft-3 against the fifth place (left 9 / right 9). Reordering or deleting a case would leave it unpinned with no visible sign.",
      "fix": "Make that case's end `changedThreadLine(\"left\", 8)` (same line 8, other column) so it fails by itself when the column comparison is removed."
    }
  ]
}
