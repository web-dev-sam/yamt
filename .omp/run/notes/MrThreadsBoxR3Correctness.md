# MrThreadsBoxR3Correctness

Agent output (`agent://MrThreadsBoxR3Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsBoxR3Correctness.md), collected 2026-11-04T20:04:25.996Z.

{
  "verdict": "fail",
  "checked": [
    "#2412 fixed: asking goes View→Row→Discussions→Thread. The window path returns before preventDefault (Thread.vue:107-116), so the modal's cancel runs. WebKit run (b): question dismissed, panel kept.",
    "#2413 fixed: the thread's earlier window listener returns while description!==null, so Description.vue:68-74 takes the Escape. The next one, from the opener, closes the thread. Matches WebKit run (a).",
    "With no description and no question, the order is unchanged. Field: boxKeys.ts:35-37 stops propagation and closes. After sends and Retry: focusPanel, then the element handler. Refresh: the window path. Matches WebKit step 10.",
    "VF7: no survivors, reason valid: only .vue and test-only props changed, and VF7 mutates non-test .ts. No unit test for the guard; Description's asking guard has none either. The WebKit runs are the evidence.",
    "Accepted: the deviations (closeTab raised by a script click; asking added to the SSR tests) and open risk 1 (focus on BODY after the dialog; the next Escape still closes the panel). The asking prop path is #2412's prescribed fix.",
    "No test run: the block comes from reading. The panel is not teleported, and the area span's @keydown (Discussions.vue:236 → useHoverBox.ts:88-93) is its ancestor."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 113,
      "severity": "block",
      "rule_id": "RV8",
      "problem": "The guard also runs on the panel's element @keydown (:141). Description open, focus on a panel control (Shift+Tab back from the non-modal description): Escape is no longer prevented. It bubbles to the hover-box handler (useHoverBox.ts:89), which closes the box and the thread together and leaves the description open. In R2 it closed only the thread.",
      "fix": "Guard only the window listener: register a guarded wrapper with useEventListener(window,…) and keep the unguarded keyPressed on @keydown. Add 'description open, Shift+Tab into the panel, Escape → the thread closes, the box stays' to verify step 10."
    }
  ]
}
