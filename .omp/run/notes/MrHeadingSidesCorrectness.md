# MrHeadingSidesCorrectness

Agent output (`agent://MrHeadingSidesCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingSidesCorrectness.md), collected 2026-11-25T09:18:09.627Z.

{
  "verdict": "pass",
  "checked": [
    "Contract: fileListKey.ts:26 checks screen before the other guards. SideColumn.vue:16 v-show adds onFiles. App.vue:75 and RangeApp.vue:109 pass on-files; CompareApp.vue:72 v-show adds the screen check.",
    "Keys read the ref the screens write: store.ts:128 refs.screen goes to createMergeSearch and fileListKey state; settingsScreen writes it. rangeStore.ts:203,239 pass state. No copy, no second writer.",
    "As it was: v-show only, so nothing unmounts and no state is written on leave. usePanelWidth.ts reads width only when a drag starts, so display:none cannot store 0. WebKit probes show width, scrollTop, tree and query unchanged.",
    "Tests fail if the feature is deleted: fileListKey.test.ts covers 3 off-files kinds with presses shown to match on files. searching.test.ts and the 3 store tests fail at the settings step without the check.",
    "Mutation: fileListKey.ts 24/24 killed, survivor list empty, no VF7 reasons to check. The .vue changes are not mutated; the WebKit smoke covers them in all three windows, dark and light.",
    "Deviations accepted: oxfmt line split, extra mergeSearch.test.ts literal, test naming. Step 4 serverLog not reached (fixture has no server) but covered by the shared expression and the unit test. Open risk is by design (AGENTS.md:7)."
  ],
  "findings": []
}
