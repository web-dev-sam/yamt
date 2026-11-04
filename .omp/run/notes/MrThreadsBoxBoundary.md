# MrThreadsBoxBoundary

Agent output (`agent://MrThreadsBoxBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsBoxBoundary.md), collected 2026-11-04T16:27:00.970Z.

{
  "verdict": "fail",
  "checked": [
    "B5: box words, header, panel words (wordsOf) and reviewOrdered all use turnOf/turnCounts with row.author?.username ?? null. No other turn computation in frontend/src (grep).",
    "Boundaries: box imports MergeRequestThread.vue, mergeRequestThreadText RESOLVED (reused, deviation accepted), useShiftTaps, isTypingTarget. No window root or lsp (PM10). mergeRequests/ stays self-contained (PM3).",
    "Contract matches the brief: core types and functions; pinned is a document capture pointerdown, only while open && pinned; boxed = (not off && count > 0) || shown; panel props as contracted.",
    "Deviations accepted: SSR test name (TS1149), mergeRequests.test.ts (granted), B2 as an equivalent union, mergeRequestsShown.ts unchanged. Open risks 1–3 go to the panel slice or correctness.",
    "Docs: mergeRequests/AGENTS.md:19 and ui/AGENTS.md:61 match the code, except C11 (finding 2). Review order counts marked rows until close, consistent with the row count staying 13 (C10).",
    "Comments: new doc comments cite request or design rules (CP1/CP2). No narration, no TODO. Shots under .omp/run/shots follow the existing convention."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestDiscussions.vue",
      "line": 51,
      "severity": "block",
      "rule_id": "VU2",
      "problem": "The computed `shownId` (l.48) comes before `useHoverBox` (a composable, classed as state). `useElementBounding`, `useRowDiscussions` and the `pointed`/`focused` shallowRefs follow it too. check-sfc-order.ts reports 'state after computed', so `just check` (sfc-order) fails, as in #1730. The note lists no sfc-order run.",
      "fix": "Put all state calls above every computed. Make `pinned` read a hoisted `function shownHere(): DiscussionId | null`, and have `shownId = computed(shownHere)` sit in the computed section."
    },
    {
      "file": "frontend/src/ui/MergeRequestDiscussions.vue",
      "line": 104,
      "severity": "block",
      "rule_id": "C10/C11",
      "problem": "Only `watch(open)` ends the thread and the marks. Leaving the page with the box open (open risk 1: Escape left the screen) unmounts the box, so closeThread and boxClosed never run. [INFERENCE] On return the row stays boxed under Off, a hover reopens the old panel, and the marks and count stay.",
      "fix": "Move the watch body into one `boxClosedHere()`. Call it from both `watch(open)` and `onBeforeUnmount` when `open.value`, so an unmount closes the thread and calls boxClosed."
    },
    {
      "file": "frontend/src/mergeRequests/internal/discussions.ts",
      "line": 57,
      "severity": "should",
      "rule_id": "principles-1",
      "problem": "`isPerson(person, username): person is Person` is a username comparison posing as a type guard. Its false branch narrows a Person to `never` (l.75 and l.103 pass `starter: never` to personsTurn), so later edits in those branches go unchecked. The name also reads as 'is not deleted': `!isPerson(last.author, author)` means 'not the author'.",
      "fix": "Rename it to `isUser(person, username): boolean` and drop the type predicate. No call site needs the narrowing."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts",
      "line": 255,
      "severity": "should",
      "rule_id": "ownership",
      "problem": "The brief makes ipc/** read-only ('keep the call compatible'), but three expected review orders changed, and only mergeRequests.test.ts was granted. mr-review-mode-design.md:203-208 still pins the old orders and their coverage claims (e.g. !622 as 'a due row without the turn'). A later reader then finds two sources that disagree.",
      "fix": "Record the grant in the board. Have the docs keeper add a line under the review-mode design table naming the B5 orders and the row that now covers each case (!623 for the due row without the turn)."
    },
    {
      "file": "frontend/src/ui/MergeRequestDiscussions.vue",
      "line": 145,
      "severity": "nit",
      "problem": "`shownDiscussion` falls back to `thread.value.load` without checking that the thread is this row's. With `shownId` null it returns another row's discussion; only the template's v-if keeps that from showing. Nothing gets harder unless panelWords gets a second reader.",
      "fix": "Return null at the top when `shownId.value === null`."
    }
  ]
}
