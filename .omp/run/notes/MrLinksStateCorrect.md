# MrLinksStateCorrect

Agent output (`agent://MrLinksStateCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksStateCorrect.md), collected 2026-11-04T02:09:31.530Z.

{
  "verdict": "pass",
  "checked": [
    "RK70: `running` guard keeps one readLinks in flight (asks_run_one_at_a_time_newest_first fails without it); [iid,...queued] sends newest first, 637 before 639 asserted",
    "dropped() clears generation/map/queue and keeps `running`, so a new ask waits for the call in flight (open risk accepted); tests fail if the generation check, `queued = []`, or either list-side dropped() is removed",
    "Re-ask: asked() skips only loading/read; failed and refused are re-asked on reopen and by askLinks; useRowLinks re-asks an open box whose entry vanishes, never a closed one",
    "Branding: all 4 WebPage fields (epic/issue/parent/commit page) are branded, ftp rejected at all 6 test paths incl. shown.parent.page; isLinkedPage (http too) accepted, as Rust WebPage::linked",
    "VF7(a) holds for both survivors: :99 generation is only equality-compared; :120 the boolean flips at the same moments and the callback reads only isOpen. 11 mutated files = changed non-test TS",
    "Deviations accepted: TIMED_OUT for !636, `thrown` for non-ok outcomes, fixtureProject, types in descriptionDomain.ts. Fixture spread proven by beforeAll readLinks(640); the log never carries text"
  ],
  "findings": []
}
