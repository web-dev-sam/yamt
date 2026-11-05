# MrMentionsCoreR1Correctness

Agent output (`agent://MrMentionsCoreR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsCoreR1Correctness.md), collected 2026-11-05T09:38:39.770Z.

{
  "verdict": "pass",
  "checked": [
    "#2487 fixed: test.ts:79 `mentionLines([DSCOTT],[ANNA],\"an\")` → [dscott, anna]. DSCOTT matches only by contains, ANNA by starts-with, so ranking both groups together fails it.",
    "#2488 fixed: test.ts:117-122 sends 12 known people, blank text, checks the length is MENTION_LINES and the first ten in order. Moving the slice into the non-blank branch (mentions.ts:76-78) fails it.",
    "cbb351be changes only mentions.test.ts plus run artifacts (git show --stat). mentions.ts and the contract are unchanged, so no behaviour broke and nothing grew.",
    "Mutation evidence accepted: the fix is test-only and `just mutants HEAD` reports no TS changes. The brief excludes mergeRequests/ (VF7). Planted-bug runs in notes/MrMentionsCoreR1.md fail. No kept survivors.",
    "The new tests use the public index.ts surface and the existing person/usernames helpers. The implementer reports no deviations or open risks."
  ],
  "findings": []
}
