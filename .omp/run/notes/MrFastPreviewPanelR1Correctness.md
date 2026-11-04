# MrFastPreviewPanelR1Correctness

Agent output (`agent://MrFastPreviewPanelR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewPanelR1Correctness.md), collected 2026-11-04T22:46:48.500Z.

{
  "verdict": "fail",
  "checked": [
    "#2459 fixed: loadList sets listing loading before awaiting the ask; its guard stops a second ask. Refresh test: disabled+spinning while ask held; mergeRequests.test.ts:535-542: one ask for two presses",
    "#2460 fixed (lazy/full): row marked running/LOADING at the press; isReloading/pressedAgain stop repeat asks; read sent only after askFirst (Discussions.test.ts:729-775, Reload.test.ts:250-266, box spin SSR)",
    "Off/replaced mid-ask: generation check drops the read; dropped() clears reloads. Lazy switch mid-ask (open risk): untested but harmless; row not in queued, becameLazy keeps it, read sent for the open box",
    "Deviation accepted: a press on a `loading` row does nothing in lazy/full. The row is already queued or in flight; each call sends all queued iids; in lazy the open box's askDiscussions clears unhovered.",
    "#2461: survivors at Thread.ts:85/124/222, mergeRequests.ts:139/209, List.ts:110, Discussions.ts:89/141/150, fixture:179 are truly equivalent. Fixture :43/:60-72 are #732 static mutants, mislabelled 'wiring'",
    "No tests run. Block from reading code: reload() returns on Off before askFirst runs; MergeRequestDiscussions.vue:68 keeps the box and its reload button while a thread is shown"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestDiscussions.ts",
      "line": 205,
      "severity": "block",
      "problem": "The shown thread's re-read now sits inside askFirst, and reload() returns before askFirst when mode is Off. So with Off and a thread still shown (the box stays because shownId !== null, MergeRequestDiscussions.vue:68), the box's Reload button does nothing: no spin, no ask, no thread re-read. Before R1 the wrapper always called refreshed(iid).",
      "fix": "When the queue won't read the row (Off), refreshDiscussions should still run the ask and threadsRefreshed(iid), guarded by the thread's own refreshing state. Add a mergeRequestReload test: mode Off, a shown thread, press, one ask and then one thread read."
    }
  ]
}
