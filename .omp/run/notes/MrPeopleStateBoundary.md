# MrPeopleStateBoundary

Agent output (`agent://MrPeopleStateBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleStateBoundary.md), collected 2026-11-03T23:03:17.136Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all files Owned except ui/mergeRequestsList.ts (approved split; mergeRequests.ts now 240 lines). PM10 holds: the new ui files import only ipc, core, mergeRequestActions, problem, text.",
    "Contract matches the brief: domain types, both source methods, PeopleChanges, createPeopleChanges, withPeople, step words. rerequests keeps replaced(iid, reviewers), adapted in peopleOf.",
    "State: withPeople is the one row-people writer (rows + running.buffer, as the old rerequestsOf). peopleSearch, peopleAsks, openPeopleBoxes have one writer each. setRow reused. Map docs go to the docs keeper.",
    "Rule 9 (mergeRequestsShown.ts) keeps list order: core searched/filtered only filter, so the Set is safe. An open box can't bring back a dropped row. Summary and review order use the same set.",
    "Accepted: deviations (list split, peopleCalls() split, wording, failed-before-rita order); open risks (lastTurns growth; withPeople can't throw). Known red: pnpm unused for contracted types.",
    "Comments: SEARCH_PAUSE_MS cites its GitLab source (CP1); contract doc lines as given; no TODO or narration. tauri calls use converted(toResult(...)) like rerequestReview."
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/fixtureMergeRequestPeople.ts",
      "line": 79,
      "severity": "should",
      "rule_id": "TS9",
      "problem": "Removing an unknown username returns `unchanged`, but Rust's is_shown (people_change.rs:205) returns `changed` for any remove whose person is no longer listed. The fixture answers something Rust never would, the deviation's claim of matching Rust is wrong, and the test (adding_then_removing… with 'nobody') pins the wrong answer. Growth: later fixture smokes inherit the gap.",
      "fix": "Answer `unchanged` for an unknown username only on add, and let a remove go through listAfter to `changed`. Update the 'nobody' assertion to match; the AGENTS.md sentence ('an add of … anyone unknown') is then already right."
    },
    {
      "file": "frontend/src/ui/mergeRequestPeople.ts",
      "line": 137,
      "severity": "should",
      "problem": "`failureOf` reads like a pure lookup but also calls `deps.replaced(iid, reply.people)`, so a reader of `answer` can't see that the row's lists get written. As more reply kinds are added, the hidden write gets easier to miss.",
      "fix": "Have failureOf only map the outcome to a PeopleChangeFailure, and make the `replaced` call in `answer` when the reply is changed or unchanged (or rename it to say it settles the reply)."
    },
    {
      "file": "frontend/src/ui/mergeRequestPeople.ts",
      "line": 94,
      "severity": "should",
      "problem": "The stale-answer counter is named `calls` (`sent === calls`). The same decision is named `generation` in mergeRequestDiscussions.ts:51 and searchRun.ts:48, so there are now two names for one pattern and a reader has to work out that `calls` counts cancellations. Growth: nothing beyond reader load.",
      "fix": "Rename `calls` to `generation` and `sent` to the captured generation, as in mergeRequestDiscussions.ts."
    }
  ]
}
