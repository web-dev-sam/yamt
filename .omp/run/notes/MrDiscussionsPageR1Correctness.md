# MrDiscussionsPageR1Correctness

Agent output (`agent://MrDiscussionsPageR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsPageR1Correctness.md), collected 2026-11-03T15:54:52.713Z.

{
  "verdict": "pass",
  "checked": [
    "#2215 fixed: useRowDiscussions (mergeRequestDiscussions.ts:201) watches [open, entry undefined]; a lazy swap empties the map and the open box re-asks; the flip back re-calls ask, which returns on the entry. Off/full: no-op",
    "No ask loop: entries vanish only via dropped, becameLazy or settle's unhovered; a re-ask is never unhovered. Watching open (not open&&undefined) keeps the unhovered keep-on-hover rule reachable",
    "an_open_box_asks_again test fails with old watch(open) (note's fails-before run), with the open source dropped (no first ask) and with the isOpen guard dropped (closed box asks [638] early)",
    "#2217/#2218 explanation holds: listing.at set at end (mergeRequests.ts:122); show() reloads at >= RECHECK_PAUSE_MS (:183); the swap re-asks per design 1.7:186; new test pins 30 s minus 1 ms: none, 30 s: one round",
    "Survivor :207 ===→!== is VF7 (a) equivalent: watch compares each source; a boolean and its negation flip together; callback reads only isOpen. Pre-existing ones were kept in the State R1 and Page runs",
    "#2214: glabRefusalText words unchanged; list, re-request reply and box call it; no stale discussionsRefusedText outside historical briefs. useRowDiscussions uses only public Discussions API: no second writer"
  ],
  "findings": []
}
