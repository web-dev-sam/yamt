# MrFastPreviewPanelR2Correctness

Agent output (`agent://MrFastPreviewPanelR2Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewPanelR2Correctness.md), collected 2026-11-04T23:12:19.607Z.

{
  "verdict": "pass",
  "checked": [
    "#2465 closed: Off + this row's thread → isBeingRead guard, refreshing set at press (reread marks before await asked), one ask, then one read with that generation; reads/no-asks pinned by mergeRequestReload.test.ts:290-340",
    "Off tests fail if feature deleted: refreshing:true at press, the held-ask second press (one ask), threadReads [637] before ask resolves (order), loading/no-thread press asks nothing; box SSR test fails if spinning reverted",
    "Lazy/full unchanged: non-off branch is byte-identical; reread without `asked` calls read synchronously as before; a_reload_reads_the_shown_thread_again still pins running→re-read→refreshing:false",
    "Box spin: shownHere matches row iid (vue:130); Off box exists only for the shown row (boxed); spin and press guard share isBeingRead; askAgain never rejects (attempt), so awaited `asked` cannot stall the read",
    "previewHere blank move: text.trim()==='' → {kind:'empty'} before localPreview/log; ReplyField maps empty→NOTHING_TO_PREVIEW; mergeRequestThread.test.ts:489-494 pins empty for ''/whitespace with previews []; only caller is preview()",
    "Survivors VF7(a) ok: Refresh:17 →true gives undefined (falsy) for loading-less non-read loads; Thread:123 isShown false on null; :84/:223 are R1 :85/:222 shifted (−1 EMPTY, +2 reread); mergeRequests :139/:209 unchanged lines"
  ],
  "findings": []
}
