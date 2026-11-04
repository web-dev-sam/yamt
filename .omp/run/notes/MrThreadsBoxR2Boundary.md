# MrThreadsBoxR2Boundary

Agent output (`agent://MrThreadsBoxR2Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsBoxR2Boundary.md), collected 2026-11-04T17:17:58.945Z.

{
  "verdict": "fail",
  "checked": [
    "#2398/#2401 fixed: Thread.vue:119-122 retry() focuses the panel before retryThread(), as publish() does; @click=\"retry\" at :201. retryThread is sync (mergeRequestThread.ts:51), so no `void` is needed.",
    "#2399 fixed, no copy: Discussions.ts:87 asking uses the exported mentionsIn(said), the fixture's one mentions rule shared with textComment (Rendering.ts:48,70). personNamed is still used by TurnCases.",
    "#2400/#2403: View.vue:111 skips while thread is set, like description. The page listener runs first and the menu still wins. An in-panel Escape is preventDefaulted by the element handler, so the hover box and window skip it.",
    "Open risk 2 accepted: thread!==null iff a panel is mounted. Discussions.vue:320 v-if open&&shownId; showThread only while open (:97-100); a box close or unmount runs closeThread (:102-106, :118-122).",
    "Fixture fail-once: a per-source flag, only !637 d13; the new test pins iid, discussion, once and fresh source. The touched read-only files are the ones the findings' fixes name.",
    "Escape guards compared: ServerLogView.vue:86, View.vue:103, Description.vue:69 all skip while a question is open. Thread.vue:107 is the only window Escape without that skip, and it ignores a shown description."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 107,
      "severity": "block",
      "rule_id": "growth-copy",
      "problem": "The new window Escape copies MergeRequestDescription's rule but drops its `asking` guard (open risk 1). With a QuestionDialog over the page (e.g. RangeApp's keepAiChanges on window close), Escape closes the panel behind the dialog and preventDefaults the key. [INFERENCE: that stops the dialog's cancel.] The old element handler never fired there.",
      "fix": "Return early while a question is open: pass the page's `asking` to the panel as the description gets it, or move the skip-while-asking Escape guard into one helper the page, description and panel share. Add 'question over a panel, Escape' to verify step 10."
    },
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 52,
      "severity": "block",
      "rule_id": "RK73",
      "problem": "Window listeners run in mount order. A pinned box keeps its panel when focus Tabs away. Enter on a row's info button (no pointerdown, so the box stays) opens the description. Its Escape reaches the earlier panel listener first: the thread closes, Discussions moves focus to a box row, and the description stays open.",
      "fix": "Also return from keyPressed while useMergeRequests().description.value !== null. Add 'panel shown, Tab to a row's info, Enter, Escape → description closes, panel stays' to verify step 10."
    }
  ]
}
