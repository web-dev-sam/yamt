# CiJobLogPageBoundary

Agent output (`agent://CiJobLogPageBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogPageBoundary.md), collected 2026-11-03T11:15:24.991Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: changed files are in Owned except mergeRequestLogText.ts(+test), agreed with main (291/300 lines). Accepted; tree.md row needed. docs drift (shiftHeldAfter, taps row) is the docs keeper's.",
    "PM2/PM3/PM10: CiStatusJobLog/CiStatusBox import ../ipc types, ../mergeRequests, ../search and ui/ siblings only. No window root, no lsp/. The slice comes through useMergeRequests().",
    "Contract matches the brief: useKeyHold<S>(KeyHold<S>, readonly string[]), pointer.pressed, ShiftState/shiftAfter, useShiftTaps, runClasses, jobLog step. Every useKeyHold caller migrated.",
    "One listener set: only useShiftState wraps useKeyHold (its test proves it). altHold keeps heldAfter. X11 note kept. useLeaving is a max-lines split (accepted).",
    "Accepted: useFollowEnd(() => shown.load); <style> only for ::highlight (VU1); navigator.platform as ProblemBar; HALF as paneSplit.ts; the log is inside area, so a scroll in it closes nothing.",
    "Comments: only the brief's JSDoc one-liners and the existing X11 note; no narration or TODO. The ui/AGENTS.md Held and Job logs text matches the code."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/CiStatusBox.vue",
      "line": 93,
      "severity": "block",
      "problem": "`pointed` is cleared only by the `<li>`'s own pointerleave. If the CI box closes while the pointer rests on a job (Escape), the li is removed without that event and `pointed` keeps the old job. After the box reopens from its icon or by Tab, a Shift tap opens that job's log although no job is pointed, and it takes precedence over the focused job.",
      "fix": "In the existing `watch(open)`, when it turns false set `pointed` and `focused` to null. Better: move the tap rule (pointed ?? focused, open, page, typing) into a pure .ts function with a test for the reopened-box case."
    },
    {
      "file": "frontend/src/ui/CiStatusBox.vue",
      "line": 113,
      "severity": "should",
      "problem": "Focus goes back by index: `view.jobs.findIndex` points into `querySelectorAll('li > button')`, which copies the list's order into a DOM selector, and a reorder during the close focuses a neighbour. As the box grows, every new button inside an `li` shifts the index silently.",
      "fix": "Put `:data-job-page=\"job.page\"` on the job button and focus `box.value?.querySelector` with that attribute, as KeymapList's `data-keymap-row` does."
    },
    {
      "file": "frontend/src/ui/CiStatusBox.vue",
      "line": 22,
      "severity": "should",
      "problem": "A shared merge-request page file now imports `ui/rangeKeys.ts`. That file's `range*` prefix marks it as range-window root under PM9 (windowFence WINDOW_FILE classifies it as `range`), so a merge-window consumer depends on a module named for another window. If PM9 is tightened, this edge breaks. The brief prescribed the import.",
      "fix": "Orchestrator follow-up: move `isTypingTarget` and its tests to a window-neutral `ui/typingTarget.ts`, imported by rangeKeys.ts and CiStatusBox.vue."
    }
  ]
}
