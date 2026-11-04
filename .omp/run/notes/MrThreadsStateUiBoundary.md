# MrThreadsStateUiBoundary

Agent output (`agent://MrThreadsStateUiBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsStateUiBoundary.md), collected 2026-11-04T15:45:00.549Z.

{
  "verdict": "fail",
  "checked": [
    "Row count: `withRow` (mergeRequests.ts:104) patches `rows` and a buffering refresh's buffer. After a swap, `dropped`'s generation drops reload answers and `boxClosed` finds no entry. `counted` runs only async.",
    "One writer each: `thread` only in mergeRequestThread.ts (show/reread/patch/setText/close/showWrite/preview), `replyTexts` only in `setText`. Stale previews and older reads never reach the panel.",
    "Contract matches the brief: DiscussionLoad.resolved, Reload, the queue's 3 members, `counted`, `withRow`'s Pick, `rowsReplaced` re-reads. Submit re-reads once (raw queue). Logs carry no text or ids.",
    "PM10: the new ui/mergeRequest* files import only ../ipc, ./problem, ./mergeRequestActions, vue. The ipc/index.ts re-exports are accepted: ui imports ipc only via index, and knip (TS16) needs an importer.",
    "Accepted deviations: the Main-approved Rows/Preview splits (the queue is the only caller of `threadRead`/`boxClosed`), `refreshed` as a property, the decided no-ops, docs left to the docs keeper.",
    "problem.ts/problemText.ts: 7 steps with the brief's exact words, and the `Record<MergeRequestStep,…>` table is complete (TS17)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestThread.ts",
      "line": 70,
      "severity": "block",
      "rule_id": "vision-2",
      "problem": "The private `writing` boolean is a second, hidden fact for 'a send is under way'. `show` (:138) resets `sending` to idle, so a thread re-shown or switched to during a write shows idle and read. The panel enables its buttons by the brief's rule, and a press does nothing (open risk 1). No exposed signal lets the panel slice fix this.",
      "fix": "Keep the running write as `{ shown, what } | null` instead of a boolean. Let `show` start `sending` from it when it is that thread's write. Expose it, or scope the one-write rule per thread, so `Thread.sending` alone decides the buttons."
    },
    {
      "file": "frontend/src/ui/mergeRequestDiscussions.ts",
      "line": 238,
      "severity": "should",
      "problem": "`discussionsOf` used only to narrow the queue; now it carries the D3 rule. The slice's `reloadDiscussions` re-reads the thread, but the one `createThreads` gets (the raw queue) does not. Two members share one name with different effects, so wiring threads to the slice's would silently double the re-read.",
      "fix": "Leave `discussionsOf` a pure narrowing. Compose the D3 reload in mergeRequests.ts (queue `reloadDiscussions` then `threadsRefreshed(iid)`), named there next to `rowsReplaced`'s re-read."
    },
    {
      "file": "frontend/src/ui/mergeRequestThread.ts",
      "line": 144,
      "severity": "should",
      "problem": "A sent text is cleared by storing \"\", so 'no text' has two forms (absent key and \"\"). Every future reader of `replyTexts` must remember `?? \"\"` (open risk 3). The map also keeps an entry per discussion ever typed in.",
      "fix": "In `setText`, delete the discussion's key when `text` is \"\", so an absent key is the only form of an empty text."
    },
    {
      "file": "frontend/src/ui/mergeRequestThread.ts",
      "line": 14,
      "severity": "nit",
      "problem": "`Discussions` is imported from `./mergeRequestDiscussionRows`, while every other importer goes through `./mergeRequestDiscussions`'s re-export. That gives two import paths for one type; nothing gets harder beyond a grep.",
      "fix": "Import `Discussions` from `./mergeRequestDiscussions`, like the other importers."
    }
  ]
}
