# MrPersonDiscussionsThreadsBoundary

Agent output (`agent://MrPersonDiscussionsThreadsBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsThreadsBoundary.md), collected 2026-11-05T13:46:14.034Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: only Owned files plus the two granted ones. mergeRequests/Shown/Refresh untouched and still type-check (`thread` is computed, Readonly<Ref>). The test builder is still one literal (test:86-106).",
    "Contract: all five refs present, actions take a discussion, isWritable shared. dropUnlessShown keeps records = panel or expanded; tokens at records:136; show trick gone; all callers migrated.",
    "Split: shell keeps root, placement, Escape (unchanged), focus, header. Body `beside` = old classes; `inline` drops four. ReplyField: cancel/focusHost, host writable.",
    "Boundaries: PM10 prefix; slice reached only via useMergeRequests; no root or lsp import. The type re-export has precedent (mergeRequestDiscussions.ts:25). VU2 order matches ReplyField.",
    "Deviations accepted: retry keeps sending/preview; tokens kept; reread always tokens; show-trick test replaced. Docs items flagged (tree.md, state.md 89-90, AGENTS.md:63). ml-auto keeps DOM.",
    "Acceptance: all 9 named tests present (thread.test.ts; Panel.test.ts:441). Implementer smoke covers open, comment, resolve, preview and both Escapes. No gates run (RV6)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestThreadRecords.ts",
      "line": 175,
      "severity": "should",
      "rule_id": "TS11",
      "problem": "setText and backToWriting change only the reply text and the preview, and nothing in the records file calls them, yet they live there next to the read logic. Answering \"what writes replyTexts / preview\" therefore takes two files (preview() is in mergeRequestThread.ts), and state.md row 90 will have to name both files.",
      "fix": "Move setText and backToWriting into mergeRequestThread.ts, with backToWriting using `patch(state, record.shown, { preview: WRITING })`. The file stays under 300 lines."
    },
    {
      "file": "frontend/src/ui/mergeRequestThreadRecords.ts",
      "line": 160,
      "severity": "should",
      "problem": "`shownRecord` reads like a getter but returns void, creates a record and starts a read. A reader of showThread/expandThread cannot tell it has side effects without opening it, and every future host's action will call it.",
      "fix": "Rename it to a verb that says what it does, e.g. `ensureRecord` or `showRecord`, and update its two callers in mergeRequestThread.ts."
    },
    {
      "file": "frontend/src/ui/mergeRequestThread.ts",
      "line": 213,
      "severity": "nit",
      "problem": "createThreads repeats ThreadDeps' shape inline (records:41). A dependency added to only one copy still type-checks one way, so the two can drift apart.",
      "fix": "Export ThreadDeps from the records file and write `deps: ThreadDeps` in createThreads. The shape is unchanged, so the Contract holds."
    }
  ]
}
