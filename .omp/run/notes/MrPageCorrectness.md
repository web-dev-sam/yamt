# MrPageCorrectness

Agent output (`agent://MrPageCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrPageCorrectness.md), collected 2026-10-30T15:17:35.912Z.

{
  "verdict": "fail",
  "checked": [
    "Risk CiStatusBox:120 accepted: menuPosition clamps x≤icon.left (right edge at viewport) and y≤icon.bottom, so the box sits flush below or over the icon; no gap path, and the box is a DOM descendant of the span",
    "Risk MergeRequestsView:33 accepted: same goBack rule as SettingsView.vue:36-46 (design names it), Linux observed. Risk Filter:64 accepted: stepMenuItem closes every yamt menu on Tab; ArrowDown from the box reaches item 0 (focused -1)",
    "Risk stop.ts:36 accepted: range_window.rs:65 process_group(0), pinned by a_detached_child_leads_a_process_group_of_its_own; the sweep entry XDG_CONFIG_HOME matches appEnv start.ts:122 exactly (holdsEntry test pins no-prefix)",
    "Escape order: CiStatusBox span and the checklist's menuKey preventDefault before the window listener; MergeRequestsView checks defaultPrevented and asking. Button sits before the gear in CompareView, RangeView, RangeApp empty header",
    "PM10 tests fail if the rule is deleted; negatives cover ui/internal, requestMerge.ts, the roots importing the page. startArgs/processes tests pin --dir, --glab+--diff, --mr, and the comm+entry sweep against real spawned processes",
    "Survivors windowFence.ts:44 (both) and processes.ts:140 are equivalent (a). Screenshots in /var/tmp/yamt-mr-shots exist (c4-ci, r-light-filter viewed: Me/None first, zeros dimmed, allowed-to-fail last)"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestsView.vue",
      "line": 38,
      "severity": "block",
      "rule_id": "request rule 3",
      "problem": "After a failed first load (logged out, timeout), Retry runs as a buffered reload (mergeRequests.ts load: first = before.kind === 'notLoaded', which is false after a ListEnd failure). The page then shows nothing but a spinning Refresh: no 'Loading merge requests…', no sentence, no rows, until the load ends. Refresh of an empty list blanks the page the same way.",
      "fix": "Show LOADING_TEXT whenever a load runs and there are no rows (`loading && rows.length === 0`). Tell the slice owner that a load after a failed first load should stream its pages too."
    },
    {
      "file": "frontend/src/ui/CiStatusBox.vue",
      "line": 104,
      "severity": "block",
      "problem": "When the list scrolls while focus is on a job (Tab into the box, or a job clicked on Linux), the box unmounts with focus inside. WebKit fires no focusout when a node is removed [INFERENCE], so focusInside stays true. The next hover opens the box and leaving no longer closes it; it stays open over other rows until the next scroll.",
      "fix": "Before closing in `scrolled`, move focus to the icon when it is inside the box, or reset `focusInside = isInside(document.activeElement)` there; check it in the fixture with Tab to a job, scroll, then hover and leave the icon."
    },
    {
      "file": "frontend/scripts/app-session/processes.ts",
      "line": 147,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The kept survivor `environ !== null`→true has the wrong reason: the guard is not 'for the type'. /proc/<pid>/environ is owner-only, so a yamt run by another user gives null, and without the guard holdsEntry(null) throws and `stop` aborts before it removes the session folder. Nothing gets harder as the app grows; the tooling stays fragile.",
      "fix": "Let runningAppsWith take a reader (or a /proc root) so a test can give a yamt with an unreadable environ and expect it skipped. That kills the mutant."
    },
    {
      "file": "frontend/scripts/app-session/stop.ts",
      "line": 35,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The 'wiring' survivor reason (c) covers decisions: the `state.kind === 'app'` branch and start.ts startFolder's `existsSync` refusal. The only smoke output was `children:[]`, which is also what the mutant `→false` prints, so no run has shown a child being swept. Nothing gets harder as the app grows.",
      "fix": "In the pending smoke pass, open !13 and stop the session; it must report `children: [{role:'yamt child', result:'stopped'}]`. Test startFolder's missing-folder refusal, or name it as gate-covered."
    }
  ]
}
