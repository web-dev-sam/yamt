# MrThreadsStateIpcBoundary

Agent output (`agent://MrThreadsStateIpcBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsStateIpcBoundary.md), collected 2026-11-04T15:15:27.812Z.

{
  "verdict": "pass",
  "checked": [
    "Contract kept: DiscussionId/isDiscussionId in domain.ts; the five MergeRequestSource members carry their plan rows; tauriMergeRequests calls each command with the brief's arguments; toDescription(raw, field) is shared.",
    "Approved deviations accepted: types in discussionDomain.ts (mergeRequestDomain exports toPerson/toTime/UploadedPicture, no copies); TurnCases split acyclic; index.ts re-exports only what is imported (TS16).",
    "Write to an unknown iid/discussion answers refused '404 Not Found' (DiscussionWriteReply has no notFound, bindings.ts:621) and mentions skip @all/groups; both decisions accepted. !636 comments accepted as the brief lists.",
    "Boundaries: no as/!/disables in the new files; ui/ imports only through ipc/index.ts; mergeRequests/** untouched; one DiscussionStore per source (fixtureMergeRequests.ts createDiscussionStore); no module-level mutable state (TS15).",
    "Fixture vs mr-threads-fixtures.md:85-125: d01–d13 people and order, d14–d16 on !636, d14 mayResolve false, drafts on d01 and d05, d04 place src/due.ts:4, d01's edits and sizes all match.",
    "Outside Owned: ui test files widened by the orchestrator; .omp/run/shots PNGs follow the existing evidence practice (cjl-*, mr-window-* there). map-check and tree.md rows go to the docs keeper, as the note says."
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/fixtureMergeRequestThreads.ts",
      "line": 85,
      "severity": "should",
      "rule_id": "vision-2",
      "problem": "Two files write DiscussionStore.nextNote and read it differently: seeded (fixtureMergeRequestDiscussions.ts:110-112) treats it as the next free number, samSays as the last one used (pre-increment), so one number gets skipped. Stored notes start at 9000, inside the 7000+10×index range of other rows, so a reply on row ≥200 can reuse a note page. This grows harder as more writers need note numbers.",
      "fix": "Give fixtureMergeRequestDiscussions.ts one function, `takeNote(store)`, that returns and advances the next number. Call it from seeded and samSays, and start FIRST_STORED_NOTE above every generated row's note."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestTurnCases.ts",
      "line": 154,
      "severity": "should",
      "rule_id": "TS11",
      "problem": "A file named for the turn rule's cases also holds the fixture's GitLab rendering (renderedText, inlines, mentionsIn) and the comment builder, and the preview script imports its renderer from here. A reader looking for how a fixture preview renders, or a later change to that rendering, has to land in the turn-cases data file.",
      "fix": "Move renderedText, inlines, mention, mentionsIn and textComment into their own fixture file, e.g. `fixtureMergeRequestRendering.ts`. TurnCases and Threads both import from it; tree.md gets one row for it."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestTurnCases.ts",
      "line": 168,
      "severity": "should",
      "rule_id": "TS7",
      "problem": "`textComment(iid, said, time, note)` takes three `number`s, and `replied(store, iid, discussion: string, kind, text: string)` (fixtureMergeRequestThreads.ts:89) takes two `string`s. A swapped time/note or discussion/text type-checks and silently corrupts fixture pages or bodies; `Seed` already shows the object form.",
      "fix": "Take an object parameter, e.g. `textComment({ iid, said, time, note })` and `replied(store, { iid, discussion, kind, text })`, or type `discussion` as `DiscussionId` so it cannot swap with `text`."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts",
      "line": 78,
      "severity": "should",
      "problem": "The patch adds `every_listed_row_with_open_discussions_has_that_many` again, byte-identical to the test at line 62. It is dead weight that runs twice and reports one name twice; nothing gets harder beyond the noise.",
      "fix": "Delete the second copy at lines 78-84."
    },
    {
      "file": "frontend/src/ipc/index.ts",
      "line": 75,
      "severity": "nit",
      "problem": "The `export type { AgentSessionId, … } from \"./domain\"` line moved below the localMergeDomain export, apart from the other domain exports. This is churn with no purpose; nothing gets harder.",
      "fix": "Move it back directly under the `export { … } from \"./domain\"` block."
    }
  ]
}
