# LineRangesWindowBoundary

Agent output (`agent://LineRangesWindowBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesWindowBoundary.md), collected 2026-10-31T12:19:17.896Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 16 files are in Owned; ipc/** and editor/** untouched. No new import edge (rangeThreadText.ts imports isOneLine from ../ipc). Only new comment text is the AGENTS.md paragraph Change 5 asks for.",
    "Contract: startThread(file, place) in RangeThreads/RangeDrafts, the draft's `place`, shownFor {key, place, shown} in rangeThreads and rangeOpen, addThread sends draft.place (:130), and rangeThreadParts events.startThread(place) all match.",
    "rangeDrafts.ts:121 samePlace = sameDiffLine(start) plus the same shownLine(end) column and line, from ipc helpers; old sameLine deleted. Survivor :130 is equivalent: other drafts have no `file`.",
    "threadPlaceText: brief's 4 cases; placeEnd is the one path/number rule (no other .left/.right + 1 text in ui/). The box header, aria-label (RangeThreadBox.vue:42-45, 157, 161) and askContext (rangeStore.ts:122) use it.",
    "Plan #113: RELATIVE_FILE_PATH_WITH_LINE kept. firstMessage.ts:14 is exactly the brief's text and the only copy. No contradiction of plan #145-#148; #148's wording is design §1.",
    "Growth: no new state, writer or module job. AGENTS.md names place, identity, text cases. Open risk (renamed mixed-side range names both paths) is the design's table; accepted."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/RangeThreadBox.vue",
      "line": 43,
      "severity": "should",
      "rule_id": "VU",
      "problem": "The local `shown` holds a ThreadPlace, but in this window `shown` already means ShownThread.shown ('open' | 'collapsed' | 'draft'), so a reader may take it for a visibility state. Nothing gets harder as the app grows; only this computed is misleading.",
      "fix": "Rename the computed to `placeText` (template lines 157 and 161) and the local to `place`."
    },
    {
      "file": "frontend/src/ui/rangeThreads.test.ts",
      "line": 538,
      "severity": "nit",
      "problem": "Some addThread fakes still name their second parameter `line` (here, :782, and rangeAi.test.ts:1052, :1111) while the other fakes now say `place`, so the test fakes do not agree on what addThread takes. Nothing gets harder.",
      "fix": "Rename `line` to `place` in those four fakes."
    }
  ]
}
