# MrPersonDiscussionsCoreR1Correctness

Agent output (`agent://MrPersonDiscussionsCoreR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsCoreR1Correctness.md), collected 2026-11-05T14:01:14.434Z.

{
  "verdict": "pass",
  "checked": [
    "#2505 fixed (personDiscussions.ts:113): fits is floored and cut is len−(slots−1), equal to the old rule for integer fits 0,1,4–7. Without floor, test.ts:225 folds 3 not 4, and :226 fails. Ceil and round also fail.",
    "#2503 fixed: personLines (:130) runs eachUsernameOnce over the rows' peopleOnRow plus non-null writers, the same result as the old knownMentions(null,…). Null filter tested: writers at test.ts:238 holds a null.",
    "No new cycle: people.ts imports only filters; mentions, personDiscussions and discussions import people. eachUsernameOnce stays internal and is not re-exported from index.ts.",
    "knownMentions unchanged in behaviour (mentions.ts:39–40); callers ReplyField.vue:112 and RangeMessageEditor.vue:35 untouched. foldedWriters has no UI caller yet, so no second floor exists.",
    "Survivors: none of the 19 sits on a changed line (review-state tables, NO_PEOPLE_TEXT, PERSON_GROUPS). PERSON_GROUPS was already kept as VF7 (b), accepted. Mutants on the new lines are killed.",
    "Open risk accepted: fences.test.ts took 5021ms against the 5000ms timeout under load. That is outside the patch, and it passed alone. I ran no tests."
  ],
  "findings": []
}
