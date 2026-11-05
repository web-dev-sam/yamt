# MrPersonDiscussionsCoreBoundary

Agent output (`agent://MrPersonDiscussionsCoreBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsCoreBoundary.md), collected 2026-11-05T13:53:51.416Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all 8 touched files are in Owned. index.ts re-exports exactly Change 3; starterOf/wroteIn/isUser stay internal. The window's own keptInPlace copy stays until the state slice, as the brief says.",
    "Contract signatures match the brief word for word for every new export and the generic narrowed. narrowed's one caller (MergeRequestMenu.vue:23) still infers Choice<V>.",
    "personGroupOf imports starterOf/wroteIn/turnOf/isUser from ./discussions and copies none. Exporting isUser is accepted: it avoids a second copy of the null-writer rule. Each turn is computed once in personEntries.",
    "Deviations accepted: folded is P[] per the fixed Contract, not the design's number; a me-kind chosen marks Me (pinned in the test). Typecheck is red only in ipc/ from the parallel `first` change.",
    "PM3 holds (only sibling internal/ imports); TS10 holds; no as or !; TS7 fine. AGENTS.md paragraph names each function and its rule, and keptInPlace shared by rows and entries.",
    "Comments: only the Contract's doc lines and two test-helper one-liners, no narration (CP2)."
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/personDiscussions.ts",
      "line": 130,
      "severity": "block",
      "rule_id": "principles §2",
      "problem": "personLines dedups by calling knownMentions(null, …) with row people passed as 'writers', against its doc ('a null row: the writers only'). The mention list's people function gets a hidden second job: a change to the @ list (a cap, the viewer left out) silently changes the person menu.",
      "fix": "Move mentions.ts's private eachUsernameOnce into people.ts as an internal export. Call it from knownMentions and from personLines over rows' peopleOnRow plus the non-null writers, and drop the knownMentions import and its AGENTS.md note. This widens Owned to mentions.ts and people.ts."
    }
  ]
}
