# MrThreadsStateIpcR1Boundary

Agent output (`agent://MrThreadsStateIpcR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsStateIpcR1Boundary.md), collected 2026-11-04T15:30:47.596Z.

{
  "verdict": "pass",
  "checked": [
    "#2355: takeNote (Discussions.ts:106) is nextNote's only writer (grep); seeded passes it as Seed.takeNote, samSays (Threads.ts:82) calls it; no skip; test pins 12000/12027-12029.",
    "#2355: store starts at 7000+10*listedRows. Row notes use at 0/1 only (Discussions.ts:76-77), so max is 7000+10*(listedRows-1)+1, below the start for any row count. FIRST_STORED_NOTE fully gone.",
    "#2356: rendering, textComment, personNamed, Said, FixtureComment live only in fixtureMergeRequestRendering.ts; preview (Threads.ts:145) and TurnCases import it; grep: no second copy in ipc/.",
    "#2357: textComment and replied take object params; all 3 textComment callers and the 1 replied caller migrated; neither goes through ipc/index.ts, so no IPC contract drift.",
    "Ownership OK (slices.json lists Rendering.ts, TurnCases.ts). Accepted: tree.md row for Rendering.ts goes to the docs keeper; rendering tests sit in Threads.test.ts (hook refused a new test file).",
    "Decimal discussionId matches tests/glab/mr-threads (d10=...0010, !636 ...0014-16); row ids iid*100+at never hit serials 1-16; AGENTS.md 21/23 updated, no stale 9000/firstNote."
  ],
  "findings": []
}
