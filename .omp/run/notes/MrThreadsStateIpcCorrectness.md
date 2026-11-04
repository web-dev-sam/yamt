# MrThreadsStateIpcCorrectness

Agent output (`agent://MrThreadsStateIpcCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsStateIpcCorrectness.md), collected 2026-11-04T15:18:13.245Z.

{
  "verdict": "pass",
  "checked": [
    "Conversions match bindings: ids branded (anchored regex, 39/41/upper/padded cases), earlier via toPerson, mentions as sent, edited.at ms, edited.by Person, body via toDescription; tauri args exact (tauriMergeRequests.test:686)",
    "The fixture matches Rust: a blank is refused before any lookup (write.rs:71); a blank preview has no blocks; pending counts every MR draft; a resolved discussion still reads and leaves the next readDiscussions",
    "B cases match mr-threads-fixtures.md:84-125: authors, mentions (@all and the group none, code @sam none, the self-mention kept), places d01/d04. !637 is index 3 (dmitri) with 13, !636 is index 4 (sam) with 3",
    "The tests fail with the feature deleted: note uniqueness kills nextNote±, the 2** preview kills endsWith, d01 pins sizes/edits/code mentions, submit is checked on d01/d03/d05, and there is a store-per-source test",
    "Survivors per VF7: the #732 module-level ones follow the repo convention; Threads:49, Discussions:136, TurnCases:183 are equivalent. The earlier Threads:85, TurnCases:143/230/235 are now pinned",
    "Accepted deviations: the domain/turn-cases split, the brand form, knip-limited re-exports, 404 refused on an unknown write, the widened ui tests. I ran no test or mutation"
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/fixtureMergeRequestTurnCases.ts",
      "line": 126,
      "severity": "should",
      "problem": "discussionId(serial) writes the serial in hex, so the window fixture's d10–d16 are …000a–…0010. The fixtures brief's dNN (used by tests/glab/mr-threads and this brief's 'the same d01… ids') is …0010–…0016, so '…0010' is !637's d10 in the scenario but !636's d16 here. Any later cross-check between the two fixtures has to translate ids.",
      "fix": "Pad the decimal serial (String(serial).padStart(40, \"0\")) so dNN is the same hex in both fixtures; update the 636 id assertion and the '…01 to …10' wording in ipc/AGENTS.md."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestThreads.ts",
      "line": 88,
      "severity": "should",
      "problem": "replied() sends comments and drafts on !636 although its thread reports commenting 'locked'; GitLab answers 403 there. A UI regression that sends on a locked merge request would look successful in fixture-based window tests.",
      "fix": "In replied(), after the not-found check, return { kind: \"refused\", reason: FORBIDDEN } for LOCKED_THREADS_IID as resolved() does, and add the case to the 636 test."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts",
      "line": 78,
      "severity": "nit",
      "problem": "The patch adds a second, identical every_listed_row_with_open_discussions_has_that_many test (also at :62); nothing gets harder, it only runs twice.",
      "fix": "Delete the copy at :78-83."
    }
  ]
}
