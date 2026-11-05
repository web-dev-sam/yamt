# MrPersonDiscussionsIpcR1Correctness

Agent output (`agent://MrPersonDiscussionsIpcR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsIpcR1Correctness.md), collected 2026-11-05T14:10:21.680Z.

{
  "verdict": "pass",
  "checked": [
    "#2506/#2509 fixed: test now calls core personGroupOf (index.ts:130) with each listed row; Group, groupOf, turnOf import and hand filters gone (grep src/ipc: no groupOf(, 'reviewer or other' or turnOf left)",
    "Expectations sound: 'other' for p1-p7 matches ipc/AGENTS.md:23 'none reviewed by either'; reviewer test keeps sam !638 / anna !632; a missing row throws instead of passing a null author",
    "#2507 fixed: changes sits on each PERSON_CASES entry (FORMATTED_FIRST on p1 only), required by Pick<Script>; FORMATTED_FIRST precedes PERSON_CASES; p1/p2 body test pins output",
    "#2508 fixed: fixtureMergeRequestData.ts:22 comment names fixtureMergeRequestPersonCases.ts",
    "Survivors PersonCases.ts:33,54,63,72,81,101,109 accepted as VF7 (b) per #732 static-mutant precedent: each contradicts a pinning test (p1 body; a non-function change throws in scripted)",
    "No growth harm: no new import edge, state or export; no test run needed (no block)"
  ],
  "findings": []
}
