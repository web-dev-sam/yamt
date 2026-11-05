# MrPersonDiscussionsStateBoundary

Agent output (`agent://MrPersonDiscussionsStateBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsStateBoundary.md), collected 2026-11-05T14:33:26.239Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: every changed file is in Owned or granted (QueueSplit, Pages, FirstComment). Shown.ts changes only keptInPlace; Refresh.ts only exports askAgain; DiscussionRows.ts is untouched.",
    "Contract: the queue gains wantRows/retryRows/reloadRows/viewLeft; PersonView types and createPersonView deps match the brief; Opening is still exported from mergeRequests.ts; the 'off' reload rule (offWithout) matches.",
    "Core keptInPlace (internal/keptInPlace.ts) behaves as the removed copy; shownOf passes row⇒row.iid; orderedOf re-sorts only on an order change, per the Rules.",
    "PM10 holds; no import cycle; mergeRequestDiscussionQueue.ts is imported only by mergeRequestDiscussions.ts; askAgain is reused, not copied.",
    "expandThread/collapseThread do nothing when already expanded/not expanded (mergeRequestThread.ts:209-218); `expanded` is the view's alone, so leave() collapsing all fits E4.",
    "Accepted: open risks (pre-flush watch, lazy computed previous, reloadRows taking a pre-ask answer for a still-loading row) and deviations (splits, listed via queuedLast, shared askAgain promise, boxClosed per iid)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestDiscussions.ts",
      "line": 194,
      "severity": "block",
      "rule_id": "RK61",
      "problem": "viewLeft keeps every running-call iid queued and loading. The call holds the whole queue, Rust answers only 10, so settle keeps the rest and send fires more readDiscussions calls after Back (27 open rows, Back mid-call → 2 more calls). This breaks design #11 'nothing asked after Back' and amended RK61 under off.",
      "fix": "Make viewLeft (setting not 'full') do what becameLazy does: put the running call's non-reloading iids in `unhovered`. Add a running call of more than 10 iids to leaving_under_lazy_or_off_sends_nothing_more."
    },
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 229,
      "severity": "should",
      "problem": "A list refresh reaches the view through a createState closure calling `replaced`, a const destructured three lines later from shownAndViewOf (a helper that exists only for the line cap). Readers must trace this forward reference, and a synchronous rowsReplaced call during construction would throw a TDZ error.",
      "fix": "Assign a `viewReplaced` field on state once after createPersonView, or build the view next to shownOf inline and pass its rowsReplaced explicitly."
    },
    {
      "file": "frontend/src/ui/mergeRequestDiscussionQueue.ts",
      "line": 136,
      "severity": "should",
      "problem": "Queue is now exported, and its fields are written in two files: unhovered by becameLazy/asked/reload in mergeRequestDiscussions.ts and by queuedLast/marked/settle here. state.md row 88 names one file and the deviations give no line to fix it, so 'what changes unhovered?' needs two files.",
      "fix": "Add to deviations_from_brief a state.md row 88 line naming both files as the Queue's only writers (or move becameLazy's unhovered writes into the queue file)."
    },
    {
      "file": "frontend/src/ui/mergeRequestsPages.ts",
      "line": 34,
      "severity": "should",
      "rule_id": "TS11",
      "problem": "findProject (GitLab project discovery, which writes `project`) moved into a file and type named Pages next to openChanges/openPage, which are a different concept. A reader looking for project discovery will not look here, and the next 'misc' function will land in the same file.",
      "fix": "Keep findProject in mergeRequests.ts (or its own small module) and leave mergeRequestsPages.ts to Opening, openChanges, openPage and pageProblem."
    }
  ]
}
