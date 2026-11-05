# MrMentionsCoreBoundary

Agent output (`agent://MrMentionsCoreBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsCoreBoundary.md), collected 2026-11-05T09:35:25.761Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: only Owned files touched; suggestions.ts change is `export` on peopleOnRow (:21), not re-exported from index.ts",
    "Contract signatures match (mentions.ts:5-83); index.ts re-exports next to suggestions; mentions.ts imports only ./filters, ./suggestions (PM3/PM5/TS8); test imports ../index like siblings",
    "Rules match design §2.1-2.2: end-anchored @word regex = code-point scan back, prefix /[\\s([{]/u, end via search; starts/contains on name+username key; blank -> known; first wins; cut 10",
    "No copied decision: knownMentions reuses peopleOnRow as design requires; no prior username-dedupe helper in frontend/src; narrowed not reused; no new state, no state.md row",
    "Note accepted: both survivors equivalent per VF7 (caret 0 -> empty slice; global \\s vs \\s+); mutating mergeRequests/ harmless; surrogate-half caret risk accepted",
    "Others' job: tree.md lacks mentions (docs keeper, PM6); plan #191-192, RK76 not yet recorded (DR5); AGENTS.md names all four functions, rules, peopleOnRow reuse"
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/mentions.ts",
      "line": 61,
      "severity": "nit",
      "problem": "`matching` calls `matchOf` twice for each person, once per filter, which rebuilds both terms each time. Nothing gets harder as the app grows.",
      "fix": "Map each person to `{ person, match: matchOf(person, query) }` once, then filter for \"starts\" and then for \"contains\"."
    }
  ]
}
