# MrPeopleStateCorrect

Agent output (`agent://MrPeopleStateCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleStateCorrect.md), collected 2026-11-03T23:03:42.800Z.

{
  "verdict": "fail",
  "checked": [
    "RK65: `calls` is bumped by every search/end call and read when the timer fires, so only the newest answer is written. Both drop tests fail without the guard. calls-=1 survivor is equivalent",
    "Per-row queue: one promise chain per iid. Both waiting tests fail with a single global chain, and the dedupe test checks group, action and username. Open risks (lastTurns, replaced throwing) accepted",
    "RK64: an unchanged reply calls replaced and adds notDone{unchanged}, both tested. withPeople writes both lists to rows and to a buffering refresh; the buffer test fails without that. Rerequest passes only reviewers",
    "Rule 9: shownOf keeps a row when it matches or its box is open, in list order; reviewOrdered drops nothing. Tests cover the filter, the search order [640,630], the summary count and a row a refresh dropped",
    "List-load move: loadList, received, ended and checked match the old code. withPeople reads the same state object loadList writes. The mergeRequestsList.ts:106 survivor is equivalent",
    "Fixture survivors :18/:22/:24/:60 hold on the fixed data. Domain, tauri and problemText tests check conversions, arguments and the failure table. No test run: no block depends on one"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestPeople.ts",
      "line": 102,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "The `immediate:false→true / {}` survivor is kept as wiring, but this option decides whether a search is sent. With isClient, vueuse 15 starts the timer at creation, so the window sends searchPeople(undefined) 250 ms after load and writes its answer. No node test can see this.",
      "fix": "In searchOf, use a plain setTimeout/clearTimeout handle so nothing starts by default, or kill the mutant with a test that stubs window/document before importing the module (vi.hoisted + vi.resetModules)."
    }
  ]
}
