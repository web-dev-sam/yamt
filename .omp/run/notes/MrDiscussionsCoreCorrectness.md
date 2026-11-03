# MrDiscussionsCoreCorrectness

Agent output (`agent://MrDiscussionsCoreCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsCoreCorrectness.md), collected 2026-11-03T14:18:45.610Z.

{
  "verdict": "pass",
  "checked": [
    "Turn rule discussions.ts:33-35: null author or null viewer → viewer's turn. Flipping ===, dropping the null guard or making unknown 'waiting' each fails the three turn tests.",
    "Order :43-48 (rank, then createdAt desc, stable toSorted): losing rank, ascending time or reversed rank fails the order test (mine-new 50 > theirs-new 40). The ties test checks both input orders.",
    "noteExcerpt by hand: the 3-line and 280 boundaries, UTF-16 slicing (279a + 2 emoji), trimEnd at the cut, a .length check (280 emoji) and || for && are each killed by an excerpt test.",
    "Words: the 5 summary cases, placeText (line===null, not falsy), noteAuthorName via displayName, agoText at every unit boundary and future time. createdAgo uses agoText (one UNITS table). Exports match the Contract.",
    "Survivors per VF7: the label, author, rank and text consts are module-level (#732) and asserted by tests; an empty TURN_RANK gives a NaN comparator (read as 0), which fails the order test: (b). The :77 never-branch is (a). Accepted.",
    "Accepted: \\r\\n comes out as \\n (Contract silent); exact username compare; a ZWJ sequence may be split (Contract counts code points); extra turn-words test. Lint, typecheck, test and mutants are in the note; I ran no tests."
  ],
  "findings": [
    {
      "file": ".omp/run/mutants/MrDiscussionsCore.survivors.txt",
      "line": 1,
      "severity": "nit",
      "rule_id": "VF7",
      "problem": "The 14 relativeTime.ts survivors (UNITS/FORMAT, lines 7-15) are summed in the header, not listed as `file:line mutation` with a VF7 reason. A later reader cannot check them one by one; nothing else gets harder.",
      "fix": "List them individually, each marked gate-covered (#732, module-level const) and naming the agoText table test that asserts the unit."
    }
  ]
}
