# MrPersonDiscussionsStateR1Boundary

Agent output (`agent://MrPersonDiscussionsStateR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsStateR1Boundary.md), collected 2026-11-05T14:49:16.891Z.

{
  "verdict": "fail",
  "checked": [
    "#2510 fixed: leftView puts the running call's non-reloading iids in `unhovered` (queue.ts:172); settle drops the unanswered ones, so no call follows Back. Test uses BATCH+2 iids, 10 answered (test.ts:937-963)",
    "#2514 fixed: leftView drops every pending-ask `loading` entry, so afterAsk sends only reloading rows. Open risks 1 (lazy box reload dropped, unreachable) and 2 (reloading read rows still sent, per Contract) accepted",
    "#2511 fixed: no forward-referenced closure; `state.viewReplaced` is written only by personViewOf (mergeRequests.ts:239) and read only in rowsReplaced (:202); shownAndViewOf is gone",
    "#2512 fixed: grep finds every write to queued/unhovered/running/generation and entries/reloads `.value` in mergeRequestDiscussionQueue.ts. state.md row 88 line is in deviations. The moved setRow import adds no cycle",
    "#2513 fixed: findProject is back in mergeRequests.ts:150 and on the MergeRequests type; Pages has no project. Callers (startScreen.ts:18, tests) use slice.findProject unchanged",
    "Growth: the queue file has one job, the queue state machine; its internals (isReloading, sentFirst, marked, afterAsk, LOADING, RUNNING) are now private. No import edge breaks §2 or PM10"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestDiscussions.ts",
      "line": 50,
      "severity": "block",
      "rule_id": "vision-2",
      "problem": "The viewLeft Contract lines added here say \"read entries stay. So does a `loading` entry a pending ask holds, and the running call's iids its answer lacks\". That reads as \"these stay\", but leftView drops both, so a reader of the spec could undo #2510/#2514. The wantRows doc (:40-41) also still credits `unhovered` only to a switch to \"lazy\".",
      "fix": "Reword it: \"…loses its `loading` entry and leaves the queue, as does every `loading` entry a pending ask holds; the running call's iids its answer lacks are dropped when it lands; read entries stay.\" Add \"or a Back\" to wantRows' note."
    }
  ]
}
