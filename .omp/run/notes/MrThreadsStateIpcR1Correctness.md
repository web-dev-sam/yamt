# MrThreadsStateIpcR1Correctness

Agent output (`agent://MrThreadsStateIpcR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsStateIpcR1Correctness.md), collected 2026-11-04T15:30:39.236Z.

{
  "verdict": "pass",
  "checked": [
    "#2360 fixed: TurnCases.ts:123 pads the decimal serial, so d10=…0010 and d14–16=…0014–16, as in tests/glab/mr-threads. Discussions.test.ts:182 and :190-194 fail on hex.",
    "#2360 callers: DRAFTS, PLACES and row ids (Discussions.ts:96) use discussionId; no hex id left in frontend, tests, scripts or docs (grep); ui tests use only d01; fixtureMergeRequests.test.ts:514 is updated.",
    "#2361 fixed: Threads.ts:102 refuses comment/draft on !636 with 403 after not-found. Threads.test.ts:261-268 checks both kinds and that d15 stays 2 comments/0 drafts, so it fails without the guard.",
    "Growth: only takeNote writes nextNote (grep). Numbering starts at 7000+10×rows, above every row note. Threads.test.ts:211 pins 12000, 12027, 12028, 12029, so none are skipped. The rendering move adds no import edge.",
    "VF7: static-constant survivors are (b) per #732, pinned by the new rendering and 403 tests. Rendering:49 is not truly equivalent ('@sam`x`' differs), but it is a fixture-only gap below the block bar (RV8).",
    "No test run, as no block depended on one. #2355–2357 belong to the boundary lens; the tree.md row for fixtureMergeRequestRendering.ts goes to the docs keeper."
  ],
  "findings": []
}
