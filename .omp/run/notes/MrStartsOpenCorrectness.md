# MrStartsOpenCorrectness

Agent output (`agent://MrStartsOpenCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsOpenCorrectness.md), collected 2026-11-03T19:54:03.501Z.

{
  "verdict": "pass",
  "checked": [
    "B1/B3: openAtStart awaits findProject; show() only for mergeRequests+found; failed lookup → files + find problem (compareStore.test.ts:179-214, rangeStore.test.ts:175-215)",
    "Page not closed: compare adoptList writes no screen; range show(first) runs after openAtStart's show() (Promise.all); restoring the reset in show() fails the range case",
    "show→showPath: show() only from showPath/startUp; showFile/search open still reset (rangeStore.test.ts:306), missing path keeps Settings (:340); Settings-stays-open accepted",
    "Tests fail with feature deleted: screen + listing≠notLoaded (show ran) + none/failed cases; startScreenOf exact marker; main.ts dataset.open matches start_script.rs:22",
    "app-session: start-app --mr refused w/o --diff/--range; appArgs appends --mr after --ai; --open-mr w/o --mr and --mr w/o window refused; guard mutants killed",
    "Mutation: 25 survivors (implementer jsonl line 270) all on unchanged lines; empty kept list correct; main.ts unmutated, wiring seen in fixture + real-app smoke"
  ],
  "findings": []
}
