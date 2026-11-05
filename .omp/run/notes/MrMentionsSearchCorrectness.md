# MrMentionsSearchCorrectness

Agent output (`agent://MrMentionsSearchCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsSearchCorrectness.md), collected 2026-11-05T09:35:02.241Z.

{
  "verdict": "pass",
  "checked": [
    "Guard (mergeRequestPeople.ts:119-124) runs before stop(); only searching/found match. the_same_text_again_asks_nothing kills: guard removed, a kind dropped, guard after stop(), guard widened to failed/refused.",
    "the_people_box_and_mention_searches_never_touch_each_other (mergeRequests.test.ts:1477) fails with one shared instance (one call, not [er,an]) or a shared calls counter (held ann answer dropped).",
    "Vue paths unchanged except the mandated same-text no-op: toggleAdding search(\"\"), closeField/boxClosed/fieldClosed end(). No old member in frontend/src; MergeRequestPeople*/Lines tests untouched.",
    "RK65: newest answer per instance; a same-text no-op keeps the in-flight answer (calls not bumped). RK54: the search path only reads source.searchPeople and writes nothing.",
    "Survivors (VF7): calls -= 1 is (a) equivalent, accepted (equality vs snapshot, still monotone). mergeRequests.ts:146 is not in the hunks (26, 65, 289): a pre-existing gap outside SP11. Mutation run and smoke 1-5 are present.",
    "Deviations accepted (contract comment 'rows 169, 191', AGENTS.md line handed off). Docs keeper: arch §5.1:1648, state.md:78 and tree.md:283,293 are stale; mentionSearch has no state row."
  ],
  "findings": []
}
