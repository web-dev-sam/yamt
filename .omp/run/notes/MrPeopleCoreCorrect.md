# MrPeopleCoreCorrect

Agent output (`agent://MrPeopleCoreCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleCoreCorrect.md), collected 2026-11-03T22:44:17.334Z.

{
  "verdict": "pass",
  "checked": [
    "Contract met: ME_WORD only \"Me\" literal outside tests (grep); index.ts exports all six; peopleOf/byCountThenLabel exported and reused (suggestions.ts:46,57), not copied; AGENTS.md:27 cites rule 2 and #169.",
    "Traced vs design §1.6: Me person from own, then others, else null; own in role order, first-seen; others by group count, then displayName; Me dropped from known; cap 20 counts Me. 9 tests present, arrays correct.",
    "Tests catch: Me person from only row or only rows, Me not deduped, last-seen or name-sorted own order, counts over all roles, people already in the group filtered out, cap without Me (21), and a missing second trim or every @ stripped.",
    "Survivor ME_WORD \"Me\"→\"\" is valid VF7(b): choices.test.ts:60,69,108 assert \"Me\". Changed meChoice lines :69/:71 killed by choices.test.ts:107 and :242. The other 17 survivors are on unchanged lines.",
    "Accepted deviations: GroupedPeople/Counted are additive; row entry wins (open in brief). tree.md row for suggestions.ts is missing (PM6), but it is outside Owned and the docs keeper's (orchestrate §6). The open risk only affects counts.",
    "Post-commit amendments 3a135eb1 (rule 9, open question 3) touch state/page only, not this core. No bash run; no block needed one."
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/suggestions.test.ts",
      "line": 99,
      "severity": "should",
      "problem": "In this test every fixture's username sorts in the same order as its display name (abe/Abe Moss, ben/Ben Ode, zed/Zed Ash; zack's blank name already falls back to his username). So `label: person.username` in place of `displayName(person)` would still pass, and the 'then by name' half of the acceptance line goes unpinned. Nothing else builds on it.",
      "fix": "Add a count-0 person whose username and name sort in opposite orders (e.g. face(\"aaron\", \"Yuri Vale\") placed before zed). Assert they sort by the name."
    }
  ]
}
