# MrPeopleCoreBoundary

Agent output (`agent://MrPeopleCoreBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleCoreBoundary.md), collected 2026-11-03T22:42:40.908Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 6 touched files are in Owned. The tree.md row for suggestions.ts belongs to the docs keeper (orchestrate §6), so that deviation is accepted. No import leaves mergeRequests/ (PM3), and there is no cycle.",
    "Contract: ME_WORD, SUGGESTED_PEOPLE, KnownPeople, Suggestion, peopleSuggestions and searchedText match the brief verbatim, and index.ts exports all six.",
    "Deviations accepted: GroupedPeople widens rowPeople/peopleOf and ListedRequest still fits. The private Counted type widens byCountThenLabel. The row's copy winning per username is an open choice the brief left.",
    "No copied decision: peopleOf and byCountThenLabel are reused, not copied. searchedText differs from search.ts searched and narrowed. The only non-test \"Me\" is filters.ts:43.",
    "The order matches design §1.6: Me first (from the row, else a loaded row, else null), then the row's people in role order, then the others by count, then by displayName. Me is not repeated, and the cap of 20 counts Me.",
    "Comments: SUGGESTED_PEOPLE cites the GitLab LIMIT (CP1). The AGENTS.md paragraph cites rule 2 and plan #169. No state is added, so state.md is untouched."
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/suggestions.ts",
      "line": 68,
      "severity": "nit",
      "problem": "`own.get(me) ?? others.find((person) => person.username === me)` searches the sorted list line by line for a value the `loaded` map already holds by username, so a reader has to work out why `others` is used here. Nothing gets harder as the app grows.",
      "fix": "Use `own.get(me) ?? loaded.get(me) ?? null`."
    }
  ]
}
