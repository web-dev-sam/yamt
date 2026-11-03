# MrDiscussionsStateR1Correctness

Agent output (`agent://MrDiscussionsStateR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsStateR1Correctness.md), collected 2026-11-03T15:32:26.912Z.

{
  "verdict": "pass",
  "checked": [
    "#2212 fixed: settle drops unanswered unhovered iids (Discussions.ts:88-97), so the queue empties under lazy and no further glab call runs. Tests :303, :319 and :337 each fail without their guarded line",
    "#2212 edges: hovering keeps a row asked; a failure drops unhovered rows; lazy→full, off and replaced clear unhovered; a stale-generation call gives sent=∅. All traced by hand",
    "#2213 fixed: a failed first load calls replaced([]) (mergeRequests.ts:173). Test mergeRequests.test.ts:474 needs size 0 and the second [open] call, so it fails without the line",
    "#2208/#2209: discussionsOf exposes only the public three; test :493 pins it. No stale state.discussions or unsentDropped refs. Deviation accepted (300-line cap). unhovered has one writer",
    "Survivors are VF7 (a): :88/:145/m.ts:173 string vs numeric iid; :137 -=1 (generation compared only by equality); :167 never. m.ts:183/:235 are pre-existing code, as in round 0. The old :87 ?.kind mutant is now killed",
    "Accepted open_risk: under full, a failure marks every queued iid failed (#164). Not block-bar: a box open across lazy→full→lazy during one call can stay Loading. No tests run"
  ],
  "findings": []
}
