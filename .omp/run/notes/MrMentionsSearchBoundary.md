# MrMentionsSearchBoundary

Agent output (`agent://MrMentionsSearchBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsSearchBoundary.md), collected 2026-11-05T09:35:07.630Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: only the 6 Owned files touched; .vue edits are calls only. Docs untouched; AGENTS.md line proposed in deviations (accepted); state.md/architecture go to the docs keeper (design §417).",
    "Contract matches brief: PeopleSearcher {state, search, end}, createPeopleSearch, PeopleChanges.peopleSearch, MergeRequests.mentionSearch. 'rows 169, 191' accepted: palette.ts HEX_COLOUR flags #169.",
    "Clean cutover: no searchPeople/endPeopleSearch/peopleSearch.value left in ui code; only AGENTS.md:75 (owned by mr-mentions-list). Other searchPeople hits are ipc source methods.",
    "Guard (mergeRequestPeople.ts:119-124) runs before stop(): timer and state kept; refused/failed ask again; search('') on field open still empties, so the people box is unchanged.",
    "No new import edge; PM2/PM3/PM10 hold. The two instances share no state (own shallowRef, calls, pause per closure), so rule 6 holds by construction.",
    "File placement fixed by Contract (TS11 not raised). Survivor 'calls -= 1' accepted as equivalent. Second vi.useFakeTimers() after rig() accepted: rig fakes only Date."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 289,
      "severity": "should",
      "problem": "Adding mentionSearch inline puts createMergeRequests exactly at the 40-line max-lines-per-function limit (implementer's open risk), so the next slice member trips lint and must first restructure the composer.",
      "fix": "Return `mentionSearch: createPeopleSearch(source)` from peopleOf (typed `Rerequests & PeopleChanges & Pick<MergeRequests, \"mentionSearch\">`) beside peopleSearch, and drop the inline line."
    }
  ]
}
