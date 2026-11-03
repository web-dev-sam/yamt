# MrDiscussionsStateBoundary

Agent output (`agent://MrDiscussionsStateBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsStateBoundary.md), collected 2026-11-03T15:22:06.658Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 27 touched files are Owned. bindings.ts, mergeRequests/**, settingsStore.ts, .vue files and docs are untouched. PM10: mergeRequestDiscussions.ts imports only ../ipc, ./mergeRequestActions, ./problem.",
    "Queue matches brief and design §1.6–1.7: one call at a time, generation bumped by replaced and off, unsent asks dropped on lazy, lazy ask first and once, full re-lists on switch, refused/failed kept, count-only log.",
    "One source for discussionDetails (settings ref → getter → computed); entries written only in mergeRequestDiscussions.ts. Reuses setRow and attempt; TS3 default, LogFields and createdAt doc match the domain.",
    "Settings: discussionDetails in startSettings, storedSettings, sameStored (rest guard), adopt and setDiscussionDetails via send. tauri.ts and fixtureSettings copied/setter mirror setAntialiasing.",
    "Deviations accepted: fixtureDiscussions(iid, listed) as fixtureJobLog; discussionsScript split (300-line cap); Place/Note local (knip); DiscussionQueue named; blank line removed; iids comma-joined.",
    "Open risk accepted: an empty answer would loop, but design Option A has Rust pin a non-empty prefix. compareStore/rangeStore refs already carry settings: ShallowRef<SettingsInUse>, so no root edit is needed."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 297,
      "severity": "should",
      "rule_id": "PM10",
      "problem": "`...state.discussions` also spreads `listed`/`replaced`, the entries' writers, onto the slice every component gets from useMergeRequests(); dueDatesOf (same file) picks only the public part. Only the type hides the writers, so a widened type could quietly give the entries a second writer.",
      "fix": "Add `discussionsOf(state): Discussions` returning `{ discussions, discussionDetails, askDiscussions }`, as dueDatesOf does, and spread that instead."
    },
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 91,
      "severity": "should",
      "problem": "The State field `discussions` (the queue: listed/replaced) and the slice field `discussions` (the entries ref) share a name, so `state.discussions.listed` and `slice.discussions.value` mean different things. A reader tracing 'what writes discussions' has to tell them apart every time.",
      "fix": "Rename the State field to `discussionQueue` (State type, createState and the two calls in received/ended)."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestDiscussions.ts",
      "line": 75,
      "severity": "should",
      "problem": "Discussion 0's author comes from building the next row (`fixtureRows(index + 1, 1)[0]?.author`), and sam from searching the rows' authors. The brief's `PEOPLE[(index + 2) % PEOPLE.length]` is encoded through the data file's author cycle, so a reader must open that file. Nothing else builds on it.",
      "fix": "Have the orchestrator export PEOPLE (and FIXTURE_ME's Person) from fixtureMergeRequestData.ts, then index PEOPLE directly as the brief states and drop sam()."
    },
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 225,
      "severity": "nit",
      "problem": "`const mode = deps.discussionDetails` is a one-use alias, and `{ ...deps, mode, … }` passes screen, report and storage to a function that takes only source, mode and rows. Nothing gets harder.",
      "fix": "Call `createDiscussions({ source: deps.source, mode: deps.discussionDetails, rows: () => rows.value })`."
    }
  ]
}
